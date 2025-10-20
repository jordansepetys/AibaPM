# Aiba PM - Skills System Implementation Plan

## 📋 Overview

**Feature:** Project-Specific Skills & Global Skills
**Purpose:** Enable users to create reusable AI instruction packages (like "Claude Skills") that automatically apply when relevant
**Benefit:** Consistent formatting, captured best practices, faster interactions

---

## ⭐ **Architecture Decision: Option B+ (Production-Ready)**

**Selected Approach:** Scored matching + Strict precedence + Token budgeting

### **Why This Approach?**

This plan synthesizes the best of pragmatic iteration with architectural foresight:

**From Pragmatic Recommendation:**
- ✅ Scored keyword matching (phrase/word/partial)
- ✅ Observable output (matches, scores, reasons)
- ✅ Iterative improvement (defer fuzzy until proven need)

**From Architectural Safeguards:**
- ✅ **Strict Precedence:** Project skills ALWAYS beat globals (deterministic, not probabilistic)
- ✅ **Token Budgeting:** Hard cap prevents prompt bloat and cost overruns
- ✅ **Compression:** Graceful degradation when budget exceeded

### **What We're Deferring:**

- ⏸️ **Fuzzy Matching (Levenshtein):** Add only if analytics show >10% typo-related misses
- ❌ **Stemming:** Too many false positives
- ❌ **ML/Embeddings:** Extreme overkill for this use case

### **Decision Rationale:**

**Precedence is a Rule, Not a Suggestion:**
A +0.5 score boost is insufficient. Project-specific skills MUST override globals regardless of score. This ensures the system is predictable and user-controllable.

**Token Control is Operational Necessity:**
Prompt bloat directly threatens performance, UX, and cost. The token budget is a foundational safety mechanism that prevents runaway context windows.

**Build the Right Foundation Now:**
We get immediate accuracy (scored matching) on a foundation that's scalable, predictable, and operationally sound from day one.

### **Expected Behavior Example:**

**Scenario:** User types "help me write a status update"

**Available Skills:**
1. **Global Skill:** "Weekly Status Format" (keywords: `["status", "update"]`, 500 tokens)
   - Score: 4 (phrase match)
2. **Project Skill:** "Marketing Status Format" (keywords: `["status"]`, 800 tokens)
   - Score: 2 (word match)
3. **Global Skill:** "Technical Documentation" (keywords: `["documentation"]`, 1200 tokens)
   - Score: 0 (no match)

**Step 1 - Scoring:**
```
Global "Weekly Status Format": score = 4
Project "Marketing Status Format": score = 2
Global "Technical Documentation": score = 0 (dropped)
```

**Step 2 - Strict Precedence (CRITICAL):**
```
// Sort by: scope > score > timestamp
1. Project "Marketing Status Format" (score=2, scope=project) ⭐ WINS
2. Global "Weekly Status Format" (score=4, scope=global)
```

**Step 3 - Token Budgeting:**
```
Budget: 2000 tokens
Current: 0

Add Project "Marketing Status Format": 800 tokens (current = 800) ✅
Add Global "Weekly Status Format": 500 tokens (current = 1300) ✅

Both fit! No compression needed.
```

**Final Output:**
```javascript
[
  {
    id: 42,
    name: "Marketing Status Format",
    scope: "project",
    score: 2,
    matches: ["word:'status'"],
    estimatedTokens: 800,
    compressed: false
  },
  {
    id: 15,
    name: "Weekly Status Format",
    scope: "global",
    score: 4,
    matches: ["phrase:'status update'"],
    estimatedTokens: 500,
    compressed: false
  }
]
```

**Result:** AI receives project-specific format FIRST (even though global had higher score), then gets general guidance second.

---

## 🎯 Project Goals

1. **Project-Specific Skills** - Custom guidance for individual projects (e.g., "Status Update Format for Marketing Project")
2. **Global Skills** - Universal guidance across all projects (e.g., "Technical Documentation Standards")
3. **Automatic Activation** - Skills auto-apply based on keyword matching
4. **Manual Control (MVP)** - Simple "Disable Skills for this message" toggle in chat (Phase 2)
5. **Template Library** - Pre-built skills users can clone and customize

---

## 🏗️ Architecture Overview

### Database Layer
- New `skills` table for skill metadata
- New `skill_usage` table for analytics (optional)
- Skills stored as markdown files in `backend/storage/skills/`

### Backend Services
- `backend/src/services/skillMatcher.js` - Skill relevance detection
- Enhanced `backend/src/routes/chat.js` - Inject skills into prompts
- New `backend/src/routes/skills.js` - CRUD operations

### Frontend Components
- `frontend/src/components/Skills/SkillsManager.jsx` - Main management UI
- `frontend/src/components/Skills/SkillEditor.jsx` - Create/edit interface
- `frontend/src/components/Skills/SkillCard.jsx` - Display component
- Enhanced `frontend/src/components/Chat/AIChat.jsx` - Show active skills

---

## Phase 1: Database & Backend Foundation

### 1.1 Database Schema

**File:** `backend/src/db/database.js`

**Tasks:**
- [ ] Create `skills` table schema
- [ ] Create `skill_usage` table schema (optional, for analytics)
- [ ] Add prepared statements for skill CRUD operations
- [ ] Test database operations

**Schema Design:**
```sql
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,  -- Auto-generated from name, must be unique
  description TEXT,
  content TEXT NOT NULL,
  is_global BOOLEAN DEFAULT 0,
  project_id INTEGER,
  trigger_keywords TEXT, -- JSON array
  auto_activate BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Composite unique constraint: prevents slug conflicts within same scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_slug_scope
  ON skills(slug, COALESCE(project_id, 0));

CREATE TABLE IF NOT EXISTS skill_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  chat_message_id INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  FOREIGN KEY (chat_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);
```

**Slug Generation Strategy:**

**Auto-generate on creation:**
```javascript
/**
 * Generate URL-safe slug from skill name
 * @param {string} name - Skill name (e.g., "Marketing Status Format")
 * @returns {string} Slug (e.g., "marketing-status-format")
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/-+/g, '-')       // Collapse multiple hyphens
    .substring(0, 50);         // Max 50 chars
}

/**
 * Ensure slug is unique within scope (global vs project)
 * @param {string} baseSlug - Generated slug
 * @param {number|null} projectId - Project ID or null for global
 * @returns {string} Unique slug (may append -2, -3, etc.)
 */
function ensureUniqueSlug(baseSlug, projectId) {
  let slug = baseSlug;
  let counter = 2;

  // Check if slug exists in same scope
  while (db.getSkillBySlug.get(slug, projectId || 0)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
```

**Example:**
- Name: "Marketing Status Format" → Slug: `marketing-status-format`
- Conflict (same project): → Slug: `marketing-status-format-2`
- Different scopes OK: Global `status-format` + Project `status-format` (both allowed)

**Checkpoint 1.1:** ✅ **COMPLETE**
- [x] Tables created successfully
- [x] Foreign key constraints working
- [x] Composite unique index prevents slug conflicts within scope
- [x] Can insert/query skills
- [x] Slug auto-generation works (generateSlug + ensureUniqueSlug)
- [x] Slug uniqueness enforced (same slug allowed in different scopes)
- [x] Cascade delete works (delete project → deletes project skills)

---

### 1.2 File Storage Structure

**Directory:** `backend/storage/skills/`

**Tasks:**
- [ ] Create `backend/storage/skills/global/` directory
- [ ] Create `backend/storage/skills/project-{id}/` pattern
- [ ] Add `.gitkeep` files to preserve structure
- [ ] Update `.gitignore` if needed

**Structure:**
```
backend/storage/
├── skills/
│   ├── global/
│   │   ├── status-updates.md
│   │   ├── technical-docs.md
│   │   └── meeting-notes.md
│   └── project-1/
│       ├── code-review-guidelines.md
│       └── sprint-planning-format.md
```

**Checkpoint 1.2:**
- [ ] Directories created
- [ ] Can read/write skill markdown files
- [ ] Path resolution works for global vs project skills

---

### 1.3 Skill Matcher Service ⭐ **Option B+ (Production-Ready)**

**File:** `backend/src/services/skillMatcher.js` (NEW)

**Architecture:** Scored matching + Strict precedence + Token budgeting

**Features:**
- **Phase 1:** Scored phrase/word matching with observability
- **Phase 2:** Strict precedence (project > global) + token budgeting
- **Phase 3 (Deferred):** Fuzzy matching (only if needed)

**Matching Algorithm:**

**Step 1: Score Each Skill**
```javascript
for (keyword in skill.keywords) {
  if (keyword contains space) {
    if (exact phrase match) score += 4
  } else {
    if (exact word match) score += 2
    else if (partial match) score += 1
  }
}
```

**Step 2: Apply Strict Precedence**
```javascript
// Sort order (deterministic):
1. Scope (project-scoped ALWAYS beats global, regardless of score)
2. Score (descending)
3. Updated timestamp (newer wins on ties)
```

**Step 3: Apply Token Budget**
```javascript
MAX_TOKENS = 2000  // Reserve space for conversation
current = 0
for (skill in sorted_skills) {
  tokens = estimateTokens(skill.content)
  if (current + tokens > MAX_TOKENS) {
    if (canCompress(skill)) {
      skill.compressed = true
      tokens = tokens / 2
    } else {
      break  // Drop this skill
    }
  }
  current += tokens
  include(skill)
}
```

**Output Format:**
```javascript
{
  id: 42,
  name: "Status Update Format",
  slug: "status-update-format",
  scope: "project",  // or "global"
  score: 6,          // 4 (phrase) + 2 (word)
  matches: ["phrase:'status update'", "word:'weekly'"],
  estimatedTokens: 450,
  compressed: false,
  reason: "Matched 2 keywords with score 6"
}
```

**Tasks:**
- [ ] Create `findRelevantSkills(userMessage, projectId, tokenBudget)` function
- [ ] Implement scored keyword matching (phrase/word/partial)
- [ ] Add strict precedence sorting (scope > score > timestamp)
- [ ] Implement token estimation and budgeting
- [ ] Add compression logic for large skills
- [ ] Create `buildSkillsContext(skills)` for prompt injection
- [ ] Add observability (matches array, reason, tokens)
- [ ] Handle edge cases (no skills, no project, budget exceeded)

**Function Signatures:**
```javascript
/**
 * Find relevant skills with scoring, precedence, and token budgeting
 * @param {string} userMessage - User's chat message
 * @param {number|null} projectId - Optional project ID
 * @param {number} tokenBudget - Max tokens for skills (default: 2000)
 * @returns {Promise<Array>} Scored and ranked skills with metadata
 */
export async function findRelevantSkills(userMessage, projectId, tokenBudget = 2000) { }

/**
 * Score a skill based on keyword matches
 * @param {Object} skill - Skill object with trigger_keywords
 * @param {string} normalizedMessage - Lowercased user message
 * @param {Array<string>} messageWords - Tokenized message words
 * @returns {Object} {score, matches: Array<string>}
 */
function scoreSkill(skill, normalizedMessage, messageWords) { }

/**
 * Apply strict precedence sorting
 * @param {Array} skills - Skills with scores
 * @returns {Array} Sorted by scope > score > timestamp
 */
function applySortPrecedence(skills) { }

/**
 * Estimate token count for skill content (rough heuristic)
 * @param {string} content - Markdown content
 * @returns {number} Estimated tokens (~4 chars/token)
 */
function estimateTokens(content) { }

/**
 * Compress skill content (extract key sections only)
 * @param {string} content - Full markdown content
 * @returns {string} Compressed version
 */
function compressSkillContent(content) { }

/**
 * Build context string for system prompt with token awareness
 * @param {Array} skills - Ranked skills with token metadata
 * @returns {string} Formatted markdown for prompt
 */
export function buildSkillsContext(skills) { }

/**
 * Get all global skills (auto_activate = true)
 * @returns {Promise<Array>} Global skills from database
 */
export async function getGlobalSkills() { }

/**
 * Get project-specific skills (auto_activate = true)
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Project skills from database
 */
export async function getProjectSkills(projectId) { }
```

**Checkpoint 1.3:**
- [ ] Service loads without errors
- [ ] Scoring algorithm works (phrase=4, word=2, partial=1)
- [ ] Strict precedence: project skills ALWAYS beat globals
- [ ] Token budgeting prevents prompt bloat
- [ ] Compression works for large skills
- [ ] Observable output includes score, matches, tokens
- [ ] Returns empty array when no matches
- [ ] Deterministic sorting (same input = same output)

---

### 1.4 Skills API Routes

**File:** `backend/src/routes/skills.js` (NEW)

**Endpoints:**
```javascript
// List skills
GET /api/skills?projectId={id}&global={true|false}

// Get single skill
GET /api/skills/:id

// Create skill
POST /api/skills
{
  "name": "Status Update Format",  // Required
  "description": "Weekly status update guidelines",  // Optional
  "content": "markdown content...",  // Required
  "isGlobal": false,  // Default: false
  "projectId": 1,  // Required if isGlobal=false, null if isGlobal=true
  "triggerKeywords": ["status", "update", "weekly"],  // Required (can be empty array)
  "autoActivate": true  // Default: true
}

// Note: Slug is AUTO-GENERATED by backend from name
// Backend will:
// 1. Generate slug from name ("Status Update Format" → "status-update-format")
// 2. Ensure uniqueness within scope (append -2, -3 if conflict)
// 3. Return generated slug in response

// Response:
{
  "message": "Skill created successfully",
  "skill": {
    "id": 42,
    "name": "Status Update Format",
    "slug": "status-update-format",  // AUTO-GENERATED
    "description": "Weekly status update guidelines",
    "isGlobal": false,
    "projectId": 1,
    "triggerKeywords": ["status", "update", "weekly"],
    "autoActivate": true,
    "createdAt": "2025-01-19T10:30:00Z"
  }
}

// Update skill
PUT /api/skills/:id
{
  "name": "...",
  "content": "...",
  ...
}

// Delete skill
DELETE /api/skills/:id
```

**Tasks:**
- [ ] Create router module
- [ ] Implement GET /api/skills (with filters)
- [ ] Implement GET /api/skills/:id
- [ ] Implement POST /api/skills (validate + save file)
- [ ] Implement PUT /api/skills/:id (update DB + file)
- [ ] Implement DELETE /api/skills/:id (remove DB + file)
- [ ] Add validation middleware
- [ ] Mount router in server.js

**Checkpoint 1.4:**
- [ ] All CRUD operations work via curl/Postman
- [ ] Markdown files created in correct directories
- [ ] Validation prevents invalid data
- [ ] Error handling returns proper status codes
- [ ] Filters work (global, project-specific)

---

### 1.5 Chat Integration

**File:** `backend/src/routes/chat.js` (MODIFY)

**Changes:**
- Import skillMatcher service
- Find relevant skills before AI call
- Inject skills into system prompt
- Track which skills were used (optional)

**Tasks:**
- [ ] Import skillMatcher
- [ ] Add skill finding logic before AI response
- [ ] Modify system prompt to include skills context
- [ ] Log which skills are active
- [ ] (Optional) Track usage in skill_usage table

**Code Location:** Around line 220 in chat.js POST handler

**Modified Flow:**
```javascript
// In POST /api/chat handler
const { message, projectId, disableSkills = false } = req.body;  // ⭐ Accept disableSkills flag

// 1. Build project context (existing)
const contextData = projectId ? await buildProjectContext(projectId) : { hasContext: false };

// 2. Find relevant skills (NEW) - Skip if manually disabled
const relevantSkills = disableSkills
  ? []
  : await findRelevantSkills(message, projectId);
const skillsContext = buildSkillsContext(relevantSkills);

// 3. Build system prompt with context + skills (MODIFIED)
let fullSystemPrompt = SYSTEM_PROMPT;
if (contextData.hasContext) {
  fullSystemPrompt += `\n\n---\n\n# Project Context\n\n${contextData.context}`;
}
if (skillsContext) {
  fullSystemPrompt += skillsContext; // ADD THIS
}

// 4. Log active skills (NEW)
if (disableSkills) {
  console.log('⏸️ Skills manually disabled for this message');
} else if (relevantSkills.length > 0) {
  console.log(`🎯 Applied ${relevantSkills.length} skills:`,
    relevantSkills.map(s => s.name));
}

// 5. Get AI response (existing)
const aiResponse = await getAIResponse(aiMessages, fullSystemPrompt);

// 6. Save messages (existing)
// ...

// 7. Track skill usage (OPTIONAL) - Only if skills were used
if (!disableSkills && relevantSkills.length > 0) {
  for (const skill of relevantSkills) {
    await trackSkillUsage(skill.id, aiMessageResult.lastInsertRowid);
  }
}
```

**Checkpoint 1.5:**
- [ ] Chat works without errors
- [ ] Skills are found and logged
- [ ] AI response reflects skill guidance
- [ ] disableSkills flag works (empty array when true)
- [ ] Can chat with and without skills
- [ ] Both global and project skills activate
- [ ] Skill usage tracked when skills used (not when disabled)

---

**Phase 1 Complete! ✅**
Backend foundation ready. Skills database, matching service, API routes, and chat integration complete.

---

## Phase 2: Frontend - Skill Management UI

### 2.1 Skills Manager Component

**File:** `frontend/src/components/Skills/SkillsManager.jsx` (NEW)

**Features:**
- List all skills (global + project)
- Filter by global/project
- Create new skill button
- Edit/delete existing skills
- Search/filter skills

**Layout:**
```
┌─────────────────────────────────────────┐
│  Skills Manager                    [+ New Skill] │
├─────────────────────────────────────────┤
│  Filters: [ All | Global | Project ]   │
│  Search: [______________]               │
├─────────────────────────────────────────┤
│  📚 Global Skills (3)                   │
│  ┌───────────────────────────────────┐ │
│  │ Status Update Format          [⚙️][🗑️] │
│  │ Weekly updates guidelines         │
│  │ Keywords: status, update, weekly  │
│  └───────────────────────────────────┘ │
│                                         │
│  📁 Marketing Project Skills (2)        │
│  ┌───────────────────────────────────┐ │
│  │ Brand Voice Guidelines       [⚙️][🗑️] │
│  │ Tone and style for marketing copy  │
│  │ Keywords: copy, brand, voice      │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create component structure
- [ ] Fetch skills from API
- [ ] Display in grouped lists (global / by project)
- [ ] Add search/filter functionality
- [ ] Implement delete with confirmation
- [ ] Add "New Skill" button (opens editor)
- [ ] Add edit button (opens editor)

**Checkpoint 2.1:**
- [ ] Skills list displays correctly
- [ ] Filters work (all/global/project)
- [ ] Search filters skills
- [ ] Delete removes skill and updates UI
- [ ] New/Edit buttons open editor

---

### 2.2 Skill Editor Component

**File:** `frontend/src/components/Skills/SkillEditor.jsx` (NEW)

**Features:**
- Modal/drawer interface
- Form fields for all skill properties
- Markdown editor for content
- Live preview (optional)
- Keyword tag input
- Save/cancel buttons

**Form Fields:**
```
Name: [_________________________]
Description: [_________________________]
Scope: ( ) Global  (•) Project: [Dropdown]
Content (Markdown):
┌─────────────────────────────────────┐
│                                     │
│  ## When writing status updates... │
│                                     │
└─────────────────────────────────────┘
Trigger Keywords: [tag] [tag] [+ Add]
[✓] Auto-activate when keywords match

[Cancel]  [Save Skill]
```

**Tasks:**
- [ ] Create modal/drawer component
- [ ] Build form with all fields
- [ ] Add markdown textarea (with syntax highlighting if possible)
- [ ] Implement tag input for keywords
- [ ] Add validation (name required, content required)
- [ ] POST to API on save
- [ ] PUT to API on edit
- [ ] Handle errors gracefully

**Checkpoint 2.2:**
- [ ] Editor opens/closes smoothly
- [ ] All form fields work
- [ ] Validation prevents invalid submissions
- [ ] Create skill → appears in list
- [ ] Edit skill → updates correctly
- [ ] Cancel discards changes

---

### 2.3 Skills Tab Integration

**File:** `frontend/src/App.jsx` (MODIFY)

**Tasks:**
- [ ] Add "Skills" tab to navigation
- [ ] Import SkillsManager component
- [ ] Add tab content section
- [ ] Update routing/tab state

**Tab Order:**
1. 🎤 Record
2. 📋 Meetings
3. 📚 Wiki
4. 🎯 Skills (NEW)
5. 📁 Projects

**Code Changes:**
```jsx
// Add tab button
<button onClick={() => setAppTab('skills')} className={...}>
  🎯 Skills
</button>

// Add tab content
{appTab === 'skills' && (
  <SkillsManager />
)}
```

**Checkpoint 2.3:**
- [ ] Skills tab visible in navigation
- [ ] Clicking tab shows SkillsManager
- [ ] Tab switching works smoothly
- [ ] Skills tab badge shows count (optional)

---

### 2.4 Chat Skills Indicator + Manual Control Toggle ⭐

**File:** `frontend/src/components/Chat/AIChat.jsx` (MODIFY)

**Features:**
- Show which skills are active in current context
- **MVP Manual Control:** "Disable Skills for this message" toggle
- Display below project selector, above message input
- Update when project changes

**UI Element:**
```
┌─────────────────────────────────────────────────────┐
│ Project: [Marketing ▼]                              │
├─────────────────────────────────────────────────────┤
│ 🎯 Active Skills (2):                               │
│ [Status Update Format] [Technical Docs]             │
│                                                      │
│ ☐ Disable skills for this message                   │ ⭐ MVP Manual Control
└─────────────────────────────────────────────────────┘
│ [Type your message here...]                         │
│ [🎤 Voice]  [📤 Send]                               │
└─────────────────────────────────────────────────────┘
```

**Component State:**
```javascript
const [skillsDisabledForMessage, setSkillsDisabledForMessage] = useState(false);
```

**Behavior:**
1. **Default:** Toggle is OFF, skills are active (auto-matched based on keywords)
2. **User checks toggle:** Skills disabled for NEXT message only
3. **After send:** Toggle automatically resets to OFF (one-time override)
4. **Visual feedback:** When checked, skill badges appear grayed/strikethrough

**Backend Integration:**
```javascript
// When sending message
const response = await chatAPI.sendMessage(
  userMessage,
  currentProjectId,
  { disableSkills: skillsDisabledForMessage }  // Pass flag
);

// After message sent
setSkillsDisabledForMessage(false);  // Reset toggle
```

**Backend Changes (chat.js):**
```javascript
// In POST /api/chat handler
const { message, projectId, disableSkills = false } = req.body;

// Only find skills if not disabled
const relevantSkills = disableSkills
  ? []
  : await findRelevantSkills(message, projectId);
```

**Tasks:**
- [ ] Add skillsDisabledForMessage state to AIChat component
- [ ] Add checkbox toggle above message input
- [ ] Fetch and display active skills (read-only in MVP)
- [ ] Gray out skill badges when toggle checked
- [ ] Pass disableSkills flag to backend
- [ ] Auto-reset toggle after message sent
- [ ] Update when project changes
- [ ] Add tooltip explaining toggle purpose

**Future Enhancement (Post-MVP):**
- Click individual skill badges to disable specific skills (not all)
- Persist disabled skills in localStorage
- Add "Always disable [skill name]" option

**Checkpoint 2.4:**
- [ ] Active skills display in chat (even if just count)
- [ ] Manual control toggle works
- [ ] Sending message with toggle ON excludes skills
- [ ] Toggle auto-resets after send
- [ ] Visual feedback when skills disabled
- [ ] Backend respects disableSkills flag
- [ ] Visual design matches app theme
- [ ] Doesn't clutter chat interface

---

**Phase 2 Complete! ✅**
Frontend UI ready. Users can create, edit, delete, and view skills. Active skills visible in chat with manual control toggle.

**Note:** Remember to update `frontend/src/services/api.js`:
```javascript
// Update chatAPI.sendMessage to accept options
export const chatAPI = {
  sendMessage: async (message, projectId = null, options = {}) => {
    try {
      const response = await api.post('/api/chat', {
        message,
        projectId,
        ...options  // Includes disableSkills flag
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
  // ... rest of chatAPI
};
```

---

## Phase 3: Advanced Features & Polish

### 3.1 Skill Templates Library

**Goal:** Pre-built skills users can clone and customize

**Templates to Create:**
1. **Status Update Format** (Global)
2. **Technical Documentation** (Global)
3. **Meeting Notes Template** (Global)
4. **Code Review Comments** (Global)
5. **Email Drafts** (Global)
6. **Sprint Planning** (Project)

**Tasks:**
- [ ] Create markdown templates in `backend/storage/skills/templates/`
- [ ] Add "Templates" section to SkillsManager
- [ ] Implement "Clone Template" button
- [ ] Pre-populate form with template content
- [ ] Allow customization before saving

**Checkpoint 3.1:**
- [ ] Templates library visible in UI
- [ ] Clone template → opens editor with content
- [ ] User can customize and save
- [ ] Templates don't count against skill list

---

### 3.2 Skill Analytics (Optional)

**Goal:** Track which skills are most useful

**Metrics:**
- Times used
- Last used date
- Success rate (user thumbs up/down - future feature)
- Most common keywords triggering skill

**Tasks:**
- [ ] Track usage in skill_usage table
- [ ] Create analytics aggregation query
- [ ] Add analytics view to skill card
- [ ] Display usage count in SkillsManager

**Checkpoint 3.2:**
- [ ] Usage tracked on every chat
- [ ] Analytics display in UI
- [ ] Most-used skills highlighted
- [ ] Can identify unused skills for deletion

---

### 3.3 Fuzzy Keyword Matching ⏸️ **DEFERRED (Phase 3 Optional)**

**Status:** Not part of MVP. Add only if user feedback demonstrates clear need.

**Why Deferred:**
- Phrase + scored matching already handles 95% of cases
- Risk of false positives ("chat" matching "that")
- Adds complexity without proven value
- Can be added later without breaking changes

**If Implemented Later:**

**Enhancements:**
- Levenshtein distance = 1 for short words (≤6 chars)
- Only activate on near-misses (not wild guesses)
- Require at least one exact match before using fuzzy

**Simple Levenshtein Implementation:**
```javascript
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Add to scoreSkill() only if exact matches exist
if (exactMatches.length > 0 && word.length <= 6) {
  if (levenshtein(word, keyword) === 1) {
    score += 1;
    matches.push(`fuzzy:"${keyword}"`);
  }
}
```

**Decision Criteria:**
- [ ] Analytics show > 10% of searches fail due to typos
- [ ] Users explicitly request typo tolerance
- [ ] Skill library has > 20 skills (increases typo likelihood)

**Do NOT Implement:**
- ❌ Stemming (too aggressive, many false positives)
- ❌ Synonym expansion (maintenance burden, scope creep)
- ❌ ML/embeddings (extreme overkill for this use case)

---

### 3.4 Skill Preview/Testing

**Goal:** Test skill before saving

**Features:**
- "Preview" button in editor
- Shows how skill would affect AI response
- Test with sample messages

**Tasks:**
- [ ] Add preview mode to editor
- [ ] Send test message to AI with skill applied
- [ ] Display AI response
- [ ] Allow iteration without saving

**Checkpoint 3.4:**
- [ ] Preview shows realistic AI response
- [ ] User can iterate on skill content
- [ ] Preview doesn't save to database
- [ ] Clear feedback on how skill affects output

---

### 3.5 Skill Import/Export

**Goal:** Share skills between instances or users

**Features:**
- Export skill as .md file with metadata
- Import skill from .md file
- Batch export (all global skills)

**Tasks:**
- [ ] Add export button to skill card
- [ ] Generate .md with frontmatter (YAML metadata)
- [ ] Add import button to SkillsManager
- [ ] Parse imported .md and create skill
- [ ] Validate imported skills

**Example Export Format:**
```markdown
---
name: Status Update Format
description: Weekly status update guidelines
isGlobal: true
triggerKeywords: [status, update, weekly]
autoActivate: true
---

# Status Update Format

When asked to write status updates:

## Format
**This Week:**
- [Achievement] - [Impact]
...
```

**Checkpoint 3.5:**
- [ ] Export creates valid .md file
- [ ] Import parses and creates skill
- [ ] Metadata preserved
- [ ] Can share skills across instances

---

**Phase 3 Complete! ✅**
Advanced features implemented. Skill templates, analytics, improved matching, preview, and import/export ready.

---

## Phase 4: Testing & Documentation

### 4.1 End-to-End Testing

**Test Scenarios:**

**Scenario 1: Create Global Skill**
1. [ ] Navigate to Skills tab
2. [ ] Click "New Skill"
3. [ ] Fill out form (global, keywords: "status update")
4. [ ] Save skill
5. [ ] Verify appears in global skills list

**Scenario 2: Use Skill in Chat**
1. [ ] Open chat
2. [ ] Select project
3. [ ] Type message with trigger keyword
4. [ ] Verify skill activates (shown in UI)
5. [ ] AI response follows skill guidance

**Scenario 3: Edit Skill**
1. [ ] Find skill in list
2. [ ] Click edit
3. [ ] Modify content
4. [ ] Save changes
5. [ ] Verify updated in database and file

**Scenario 4: Delete Skill**
1. [ ] Click delete on skill
2. [ ] Confirm deletion
3. [ ] Verify removed from list
4. [ ] Verify file deleted
5. [ ] Verify no longer activates in chat

**Scenario 5: Project-Specific Skill**
1. [ ] Create skill for Project A
2. [ ] Switch to Project A in chat
3. [ ] Skill activates
4. [ ] Switch to Project B
5. [ ] Skill does NOT activate

**Checkpoint 4.1:**
- [ ] All scenarios pass
- [ ] No errors in console
- [ ] UI updates correctly
- [ ] Database and files in sync

---

### 4.2 Error Handling

**Edge Cases to Handle:**

**Backend:**
- [ ] Skill file doesn't exist but DB entry does
- [ ] Invalid markdown content
- [ ] Missing required fields
- [ ] Duplicate skill names (allow or prevent?)
- [ ] Invalid trigger keywords (empty, special chars)
- [ ] Project deleted but skills remain (cascade delete)

**Frontend:**
- [ ] Network error during save
- [ ] Validation errors display clearly
- [ ] Loading states during async operations
- [ ] Empty states (no skills yet)
- [ ] Large skill content (performance)

**Checkpoint 4.2:**
- [ ] Graceful error messages
- [ ] No crashes or blank screens
- [ ] User can recover from errors
- [ ] Validation prevents bad data

---

### 4.3 Documentation

**Files to Create/Update:**

**README.md Updates:**
- [ ] Add Skills section to features
- [ ] Document how to create skills
- [ ] Show example skills
- [ ] Explain global vs project-specific

**New: SKILLS_GUIDE.md**
- [ ] What are skills?
- [ ] When to use skills vs regular chat
- [ ] Best practices for writing skills
- [ ] Keyword selection tips
- [ ] Example skills library
- [ ] Troubleshooting

**API Documentation:**
- [ ] Document /api/skills endpoints
- [ ] Request/response examples
- [ ] Error codes

**Code Comments:**
- [ ] Add JSDoc to all functions
- [ ] Explain matching algorithm
- [ ] Document file storage structure

**Checkpoint 4.3:**
- [ ] README updated
- [ ] Skills guide created
- [ ] API docs complete
- [ ] Code well-commented

---

**Phase 4 Complete! ✅**
Skills system fully tested and documented. Ready for production use.

---

## 🎉 SKILLS SYSTEM COMPLETE! 🎉

### Final Deliverables

**Database:**
- ✅ `skills` table with full CRUD
- ✅ `skill_usage` table for analytics
- ✅ Cascade delete on project removal

**Backend:**
- ✅ Skill matcher service (keyword detection)
- ✅ Skills API routes (CRUD endpoints)
- ✅ Chat integration (auto-inject skills)
- ✅ File storage (markdown files)

**Frontend:**
- ✅ Skills Manager UI (list, create, edit, delete)
- ✅ Skill Editor (form + markdown)
- ✅ Skills tab in navigation
- ✅ Active skills indicator in chat

**Advanced Features:**
- ✅ Skill templates library
- ✅ Analytics and usage tracking
- ✅ Improved keyword matching
- ✅ Preview/testing mode
- ✅ Import/export functionality

**Documentation:**
- ✅ README updated
- ✅ Skills guide
- ✅ API documentation
- ✅ Code comments

---

## Success Metrics

**User Experience:**
- [ ] User can create skill in < 2 minutes
- [ ] Skills activate 90%+ of time when keywords match
- [ ] AI responses clearly reflect skill guidance
- [ ] No noticeable performance impact on chat

**Technical:**
- [ ] < 100ms overhead for skill matching
- [ ] Database queries optimized
- [ ] File I/O efficient
- [ ] No memory leaks

**Adoption:**
- [ ] 5+ default templates available
- [ ] Skills guide explains value clearly
- [ ] Example skills in documentation
- [ ] Easy to discover feature in UI

---

## Future Enhancements (Post-MVP)

### Version 2 Features:
- [ ] Skill versioning (track changes over time)
- [ ] Skill permissions (who can edit global skills)
- [ ] Skill marketplace (share with community)
- [ ] AI-suggested skills (Claude notices patterns)
- [ ] Skill chaining (multiple skills combine)
- [ ] Conditional activation (time-based, role-based)
- [ ] Semantic search instead of keyword matching
- [ ] Skill categories/tags
- [ ] Skill effectiveness scoring (ML-based)
- [ ] Visual skill builder (drag-and-drop)

---

## Implementation Timeline

**Estimated Effort (Option B+ Production-Ready):**

**Phase 1:** Backend Foundation (1.5 weeks)
- Database schema: 2 hours
- File storage: 1 hour
- **Skill matcher (Option B+):** 12 hours ⭐
  - Scored matching: 4 hours
  - Strict precedence: 2 hours
  - Token budgeting: 4 hours
  - Compression logic: 2 hours
- API routes: 8 hours
- Chat integration: 4 hours
- Testing: 5 hours

**Phase 2:** Frontend UI (1 week)
- Skills Manager: 8 hours
- Skill Editor: 8 hours
- Tab integration: 2 hours
- Chat indicator: 4 hours
- Testing: 4 hours

**Phase 3:** Advanced Features (1 week)
- Templates library: 6 hours
- Analytics: 6 hours
- ~~Improved matching~~ (deferred to Phase 3 optional)
- Preview mode: 4 hours
- Import/export: 4 hours
- Polish & refinement: 4 hours

**Phase 4:** Testing & Docs (2-3 days)
- E2E testing: 6 hours
- Error handling: 4 hours
- Documentation: 6 hours

**Total: 3.5-4 weeks**

**Note:** Option B+ adds ~4 hours to Phase 1 (matcher complexity) but saves time by deferring fuzzy matching. The investment in strict precedence and token budgeting prevents future operational issues.

---

## Development Notes

### Tech Stack (Same as Main App)
- **Backend:** Node.js + Express + SQLite
- **Frontend:** React 19 + Vite + Zustand
- **Markdown:** `marked` library (already installed)
- **Storage:** File system + database hybrid

### Code Style Consistency
- Follow existing patterns in codebase
- Use prepared statements for database
- Error handling like existing routes
- CSS matches glassmorphism theme

### Git Strategy
- Create feature branch: `feature/skills-system`
- Commit after each phase
- Merge to main when complete

---

**Ready to Start! 🚀**

Begin with Phase 1.1: Database Schema
