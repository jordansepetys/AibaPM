import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUMMARY_DIR = path.join(__dirname, '../../storage/summaries');
const AI_BACKEND = process.env.AI_BACKEND || 'openai';

// Initialize AI clients (lazy initialization)
let anthropic = null;
let openai = null;

function getAnthropicClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Prompt template for meeting analysis
const ANALYSIS_PROMPT = `You are an AI assistant that captures detailed meeting discussions for long-term memory and reference.

Your goal is to preserve what was discussed in detail, not just extract action items. This is a conversation journal.

Analyze the following meeting transcript and provide a structured summary in JSON format with these fields:

1. "overview": A 2-3 sentence high-level summary of what the meeting covered (string)
2. "discussion_topics": An array of topic strings (e.g., ["Feature planning", "Technical architecture", "User feedback"]). Each item should be a simple string, not an object.
3. "detailed_discussion": An array of paragraph strings, each being 2-4 sentences explaining what was talked about, the context, different viewpoints mentioned, and conclusions reached. Be thorough - capture the conversation flow and reasoning. Each entry must be a complete paragraph string, NOT an object.
4. "key_decisions": An array of decision strings describing concrete decisions made during the meeting (include empty array if none). Each item should be a simple string, not an object.
5. "action_items": An array of objects with "task" and "owner" fields for specific follow-up actions (include empty array if none). This is the ONLY field that should contain objects.
6. "technical_details": An array of technical detail strings - implementations, technologies, APIs, approaches, code details, etc. Include both what was discussed and WHY in each string. Each item should be a simple string, not an object.
7. "context": A paragraph string providing background context - why this meeting happened, what led to these discussions, relevant prior decisions or history mentioned

IMPORTANT: All fields should contain simple strings in their arrays, EXCEPT action_items which contains objects with task/owner. Do not use objects for discussion_topics, detailed_discussion, key_decisions, or technical_details.

IMPORTANT: Focus on capturing WHAT WAS SAID and the reasoning/thought process, not on identifying gaps or problems. This is for future reference to remember what was discussed.

Transcript:
---
{transcript}
---

Provide ONLY the JSON response, no additional text.`;

/**
 * Analyze meeting transcript using AI
 * @param {string} transcript - Meeting transcript text
 * @param {string} backend - AI backend to use ('openai' or 'anthropic')
 * @returns {Promise<Object>} Structured analysis
 */
export const analyzeMeeting = async (transcript, backend = AI_BACKEND) => {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is empty');
  }

  console.log(`Analyzing meeting with ${backend} backend...`);

  try {
    let analysis;

    if (backend === 'anthropic') {
      analysis = await analyzeWithClaude(transcript);
    } else {
      analysis = await analyzeWithGPT(transcript);
    }

    // Validate and parse the analysis
    const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;

    // Ensure all required fields exist
    return {
      overview: parsed.overview || 'No overview available',
      discussion_topics: Array.isArray(parsed.discussion_topics) ? parsed.discussion_topics : [],
      detailed_discussion: Array.isArray(parsed.detailed_discussion) ? parsed.detailed_discussion : [],
      key_decisions: Array.isArray(parsed.key_decisions) ? parsed.key_decisions : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      technical_details: Array.isArray(parsed.technical_details) ? parsed.technical_details : [],
      context: parsed.context || '',
    };
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(`Failed to analyze meeting: ${error.message}`);
  }
};

/**
 * Analyze using Claude (Anthropic)
 * @param {string} transcript - Meeting transcript
 * @returns {Promise<string>} JSON analysis
 */
const analyzeWithClaude = async (transcript) => {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  const prompt = ANALYSIS_PROMPT.replace('{transcript}', transcript);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const response = message.content[0].text;
  console.log('Claude analysis completed');

  return response;
};

/**
 * Analyze using GPT-4o (OpenAI)
 * @param {string} transcript - Meeting transcript
 * @returns {Promise<string>} JSON analysis
 */
const analyzeWithGPT = async (transcript) => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = ANALYSIS_PROMPT.replace('{transcript}', transcript);

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a meeting documentation assistant that captures detailed discussions for long-term reference. Return structured JSON responses with thorough detail.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });

  const response = completion.choices[0].message.content;
  console.log('GPT-4o analysis completed');

  return response;
};

/**
 * Save meeting analysis to file
 * @param {Object} analysis - Analysis object
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<string>} Path to saved file
 */
export const saveSummary = async (analysis, meetingId) => {
  try {
    // Ensure summary directory exists
    await fs.mkdir(SUMMARY_DIR, { recursive: true });

    const timestamp = Date.now();
    const filename = `meeting-${meetingId}-${timestamp}.json`;
    const filePath = path.join(SUMMARY_DIR, filename);

    // Add metadata
    const summaryData = {
      ...analysis,
      generatedAt: new Date().toISOString(),
      aiBackend: AI_BACKEND,
    };

    await fs.writeFile(filePath, JSON.stringify(summaryData, null, 2));

    console.log(`Summary saved: ${filename}`);

    return `/storage/summaries/${filename}`;
  } catch (error) {
    console.error('Error saving summary:', error);
    throw new Error('Failed to save summary');
  }
};

/**
 * Read summary from file
 * @param {string} summaryPath - Path to summary file
 * @returns {Promise<Object>} Summary data
 */
export const readSummary = async (summaryPath) => {
  try {
    const fullPath = path.join(__dirname, '../..', summaryPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading summary:', error);
    throw new Error('Failed to read summary');
  }
};

/**
 * Generate mentor feedback on meeting
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Meeting summary
 * @returns {Promise<Object>} Mentor feedback
 */
export const generateMentorFeedback = async (transcript, summary) => {
  const backend = AI_BACKEND;

  const prompt = `You are an experienced technical mentor reviewing a meeting transcript.

Based on this meeting summary and transcript, provide constructive feedback in JSON format:

Summary:
${JSON.stringify(summary, null, 2)}

Provide feedback in this structure:
{
  "strengths": ["list of things done well"],
  "improvements": ["list of areas for improvement"],
  "recommendations": ["specific actionable recommendations"],
  "overall_assessment": "brief overall assessment"
}

Provide ONLY the JSON response, no additional text.`;

  try {
    let feedback;

    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      feedback = message.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a technical mentor providing feedback.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1024,
      });
      feedback = completion.choices[0].message.content;
    }

    return typeof feedback === 'string' ? JSON.parse(feedback) : feedback;
  } catch (error) {
    console.error('Mentor feedback error:', error);
    throw new Error('Failed to generate mentor feedback');
  }
};

/**
 * Generate wiki update suggestions based on meeting content
 * @param {string} currentWiki - Current wiki markdown content
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Meeting summary
 * @param {string} projectName - Project name
 * @returns {Promise<Object>} Wiki update suggestions
 */
export const generateWikiUpdateSuggestions = async (currentWiki, transcript, summary, projectName) => {
  const backend = AI_BACKEND;

  const prompt = `You are a technical documentation assistant. Analyze a meeting transcript and suggest updates to a project wiki.

Current Wiki Content:
---
${currentWiki}
---

Meeting Summary:
${JSON.stringify(summary, null, 2)}

Meeting Transcript:
${transcript.substring(0, 3000)} ${transcript.length > 3000 ? '...(truncated)' : ''}

Your task:
1. Identify NEW information that should be added to the wiki
2. Identify CHANGES to existing information (e.g., switching from one technology to another)
3. Structure suggestions into:
   - Project Overview (purpose, goals, what the project does, main features)
   - User Guide sections (how-to, basic usage, getting started)
   - Technical Documentation sections (architecture decisions, implementation details, APIs)
4. Generate a changelog entry if there are significant changes

Respond in JSON format:
{
  "has_updates": true/false,
  "overview_updates": [
    {
      "action": "add" or "update" or "replace",
      "content": "Brief description of the project, its purpose, goals, and main features",
      "reason": "why this update is needed (e.g., 'Project goals clarified in meeting', 'Purpose expanded to include X')"
    }
  ],
  "user_guide_updates": [
    {
      "section": "section name (e.g., 'Getting Started', 'How to Use Feature X')",
      "action": "add" or "update" or "replace",
      "content": "markdown content to add/update",
      "reason": "why this update is needed"
    }
  ],
  "technical_updates": [
    {
      "section": "section name (e.g., 'Architecture', 'API Design', 'Technology Stack')",
      "action": "add" or "update" or "replace",
      "content": "markdown content to add/update",
      "reason": "why this update is needed",
      "is_change": true/false (if replacing old technology/approach)
    }
  ],
  "changes_detected": [
    {
      "from": "old value (e.g., 'SignalR')",
      "to": "new value (e.g., 'PostMessage')",
      "context": "what changed (e.g., 'Communication method')"
    }
  ],
  "changelog_entry": "Brief changelog note for this meeting (e.g., 'Updated communication from SignalR to PostMessage')"
}

IMPORTANT:
- Only suggest updates for information actually discussed in the meeting
- If meeting discusses existing wiki content without changes, set has_updates to false
- Be specific about what sections to update
- Make content concise and clear
- Update the Overview if the meeting discusses project purpose, goals, scope, or high-level objectives
- Overview content should be a complete paragraph (2-4 sentences), not bullet points

Provide ONLY the JSON response, no additional text.`;

  try {
    let suggestions;

    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });
      suggestions = message.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a technical documentation assistant that analyzes meetings and suggests wiki updates.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });
      suggestions = completion.choices[0].message.content;
    }

    const parsed = typeof suggestions === 'string' ? JSON.parse(suggestions) : suggestions;

    // Validate and normalize the response
    return {
      has_updates: parsed.has_updates || false,
      overview_updates: Array.isArray(parsed.overview_updates) ? parsed.overview_updates : [],
      user_guide_updates: Array.isArray(parsed.user_guide_updates) ? parsed.user_guide_updates : [],
      technical_updates: Array.isArray(parsed.technical_updates) ? parsed.technical_updates : [],
      changes_detected: Array.isArray(parsed.changes_detected) ? parsed.changes_detected : [],
      changelog_entry: parsed.changelog_entry || null,
    };
  } catch (error) {
    console.error('Wiki suggestion error:', error);
    throw new Error('Failed to generate wiki suggestions');
  }
};

/**
 * Get structured wiki template
 * @param {string} projectName - Project name
 * @returns {string} Markdown template for new wikis
 */
export const getWikiTemplate = (projectName) => {
  return `# ${projectName}

## Overview
Brief description of the project, its purpose, and main features.

---

## 🚀 Getting Started

### Prerequisites
List any required tools, dependencies, or knowledge needed.

### Installation
Step-by-step installation instructions.

### Quick Start
How to get up and running quickly.

---

## 📖 User Guide

### Core Features
Describe main features and how to use them.

### Common Tasks
Step-by-step guides for common user tasks.

### Configuration
How to configure the application.

---

## 🔧 Technical Documentation

### Architecture
High-level architecture overview and design decisions.

### Technology Stack
List of technologies used and why they were chosen.

### API Documentation
Key APIs and their usage.

### Implementation Details
Important technical implementation notes.

---

## 📝 Changelog

Updates and changes to the project will be tracked here.

`;
};
