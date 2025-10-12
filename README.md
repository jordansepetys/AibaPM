# Aiba Project Manager

> AI-Powered Meeting Transcription & Project Management System

Aiba PM is a full-stack application that records meetings, automatically transcribes them using AI, generates summaries with key insights, and maintains searchable project wikis.

## 🚀 Features

### Core Features
- **🎤 Audio Recording**: Browser-based meeting recording with real-time duration tracking
- **📝 AI Transcription**: Automatic transcription using OpenAI Whisper API
- **🤖 AI Analysis**: Intelligent meeting summaries with Claude Sonnet 4.5 or GPT-4o
- **📊 Meeting Management**: Browse, search, and organize all your meetings
- **📚 Project Wikis**: Live markdown editor with auto-save and preview
- **🔍 Global Search**: Full-text search across all meetings with relevance ranking
- **🎓 Mentor Feedback**: Optional AI-powered insights on meeting effectiveness

### AI-Generated Insights
Each meeting automatically extracts:
- **Overview**: High-level summary
- **Key Decisions**: Important choices made
- **Action Items**: Tasks with ownership
- **Risks**: Potential blockers identified
- **Open Questions**: Unresolved items
- **Technical Details**: Implementation notes

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + Vite
- Zustand (State Management)
- Axios (HTTP Client)
- Marked (Markdown Rendering)
- TailwindCSS (Styling)

**Backend:**
- Node.js + Express
- SQLite (Metadata Storage)
- File System (Audio/Transcripts)
- Multer (File Uploads)

**AI Services:**
- OpenAI Whisper (Transcription)
- OpenAI GPT-4o OR Anthropic Claude Sonnet 4.5 (Analysis)

### Project Structure

```
AibaPM/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js          # SQLite schema & queries
│   │   ├── routes/
│   │   │   ├── meetings.js          # Meeting CRUD & processing
│   │   │   ├── projects.js          # Project management
│   │   │   ├── wiki.js              # Wiki operations
│   │   │   └── search.js            # Full-text search
│   │   ├── services/
│   │   │   ├── transcription.js     # Whisper integration
│   │   │   ├── aiAnalysis.js        # Claude/GPT-4o analysis
│   │   │   ├── audioProcessor.js    # Audio file handling
│   │   │   └── searchIndex.js       # Search indexing
│   │   └── server.js                # Express app
│   ├── storage/
│   │   ├── audio/                   # Uploaded recordings
│   │   ├── transcripts/             # Generated transcripts
│   │   ├── summaries/               # AI summaries (JSON)
│   │   └── wikis/                   # Project wikis
│   └── aiba.db                      # SQLite database
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Recording/
│   │   │   │   ├── AudioRecorder.jsx
│   │   │   │   └── RecordingStatus.jsx
│   │   │   ├── Meetings/
│   │   │   │   ├── MeetingsList.jsx
│   │   │   │   ├── MeetingDetails.jsx
│   │   │   │   └── MentorFeedback.jsx
│   │   │   ├── Wiki/
│   │   │   │   └── WikiEditor.jsx
│   │   │   └── Search/
│   │   │       └── GlobalSearch.jsx
│   │   ├── stores/
│   │   │   └── useStore.js          # Zustand store
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   └── App.jsx                  # Main component
│   └── package.json
└── project.md                       # Implementation tracking

```

## 📦 Installation

### Prerequisites
- Node.js v18+ and npm
- OpenAI API key (for Whisper + GPT-4o)
- Anthropic API key (optional, for Claude)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AibaPM
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file (or copy from .env.example)
cp ../.env.example .env

# Edit .env and add your API keys:
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here
# AI_BACKEND=openai  # or 'anthropic'
# PORT=3001
# AUDIO_RETENTION_DAYS=30
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Create .env file
cp .env.example .env

# Edit .env:
# VITE_API_URL=http://localhost:3001
```

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
node src/server.js
# Server running on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:5173
```

## 🎯 Usage

### 1. Create a Project
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project"}'
```

### 2. Record a Meeting
1. Navigate to http://localhost:5173
2. Select your project from the dropdown
3. Enter a meeting title
4. Click "Start Recording"
5. Speak for at least 10 seconds
6. Click "Stop Recording"

### 3. View Results
- **Meetings Tab**: Browse all meetings
- Click a meeting to view:
  - **Summary**: AI-generated insights
  - **Transcript**: Full text with timestamps
  - **Actions**: Extracted action items
  - **Mentor Feedback**: Optional AI analysis

### 4. Use the Wiki
- **Wiki Tab**: Select a project
- Write in Markdown (left panel)
- See live preview (right panel)
- Auto-saves after 2 seconds

### 5. Search
- Use the search bar in the header
- Type to search across all meetings
- Filter by project (optional)
- Click result to open meeting

## 🔧 Configuration

### Environment Variables

**Backend (.env):**
```env
PORT=3001
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_BACKEND=openai              # or 'anthropic'
AUDIO_RETENTION_DAYS=30        # Auto-delete old audio files
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
```

### AI Backend Selection
Toggle between OpenAI GPT-4o and Anthropic Claude by setting `AI_BACKEND` in backend `.env`:
- `openai` - Uses GPT-4o for analysis
- `anthropic` - Uses Claude Sonnet 4.5 for analysis

Both use OpenAI Whisper for transcription.

## 📡 API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Meetings
- `GET /api/meetings` - List all meetings
- `GET /api/meetings/:id` - Get meeting details
- `POST /api/meetings` - Upload & process recording
- `POST /api/meetings/:id/reprocess` - Re-transcribe & analyze
- `DELETE /api/meetings/:id` - Delete meeting

### Wiki
- `GET /api/wiki/:projectId` - Get wiki content
- `PUT /api/wiki/:projectId` - Update wiki
- `POST /api/wiki/:projectId/auto-update` - Add meeting to wiki

### Search
- `GET /api/search?q=query&project=id` - Search meetings
- `POST /api/search/rebuild` - Rebuild search index

## 🧪 Testing

### Full Workflow Test
1. ✅ Create a project (via API)
2. ✅ Record a 30-second meeting
3. ✅ Wait for processing (transcription + AI analysis)
4. ✅ View transcript in Meetings tab
5. ✅ View AI summary with decisions/actions
6. ✅ Edit project wiki
7. ✅ Search for keywords
8. ✅ Delete the test meeting

### Manual Testing Checklist
- [ ] Recording starts and shows timer
- [ ] Audio uploads successfully
- [ ] Transcript appears in ~30 seconds
- [ ] Summary shows all sections
- [ ] Wiki saves automatically
- [ ] Search returns relevant results
- [ ] Reprocess updates transcript
- [ ] Delete removes meeting

## 🔒 Security Notes

- ✅ API keys stored in `.env` (never in frontend)
- ✅ File upload validation (size, type)
- ✅ Input sanitization on all endpoints
- ✅ CORS configured for localhost
- ⚠️ **Production**: Add authentication, rate limiting, HTTPS

## 🐛 Troubleshooting

### Backend won't start
- Check Node version: `node -v` (need v18+)
- Verify API keys in `.env`
- Check port 3001 is available

### Transcription fails
- Verify OpenAI API key is valid
- Check audio file size (<25MB)
- Ensure audio format is supported (webm, wav, mp3, mp4)

### Frontend can't connect
- Verify backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env`
- Check browser console for CORS errors

### Search returns no results
- Ensure meetings have been transcribed
- Try rebuilding search index: `POST /api/search/rebuild`
- Check minimum 2 characters in search query

## 📈 Performance

- **Transcription**: ~30 seconds for 1-minute audio (Whisper API)
- **AI Analysis**: ~10-15 seconds per meeting (GPT-4o/Claude)
- **Search**: <100ms for most queries (SQLite FTS)
- **Audio Storage**: ~1MB per minute of recording
- **Database**: Scales to 1000+ meetings easily

## 🚀 Deployment (Production)

### Backend
1. Set production environment variables
2. Configure production database (PostgreSQL recommended)
3. Setup file storage (AWS S3, Google Cloud Storage)
4. Add authentication middleware
5. Enable HTTPS
6. Setup monitoring (logs, errors)

### Frontend
1. Build production bundle: `npm run build`
2. Deploy to static hosting (Vercel, Netlify, etc.)
3. Update `VITE_API_URL` to production backend
4. Configure CDN for assets

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📧 Support

For issues, questions, or feedback:
- GitHub Issues: [Create an issue]
- Documentation: See `project.md` for implementation details

---

**Built with ❤️ using React, Node.js, and AI**
