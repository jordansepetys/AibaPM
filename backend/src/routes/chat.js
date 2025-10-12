import express from 'express';
import * as db from '../db/database.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
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

// System prompt for the AI mentor
const SYSTEM_PROMPT = `You are an experienced, friendly AI mentor and companion. You're here to help with both project-related questions and general conversation.

Personality:
- Supportive and encouraging, like a wise friend and mentor
- Ask thoughtful clarifying questions when needed
- Provide specific, actionable advice
- Reference project details when relevant
- Balance technical expertise with emotional intelligence
- Can discuss both work and non-work topics naturally

When discussing projects:
- Reference specific meetings, decisions, and technical details from the context
- Point out patterns or potential issues you notice
- Offer alternatives and trade-offs
- Help with project management, technical decisions, and team dynamics

When the user shares challenges or feelings:
- Be empathetic and validating
- Offer perspective and encouragement
- Help them think through solutions
- Balance optimism with realism

You have access to the user's project context (meetings, wikis, summaries) which will be provided below when relevant.`;

/**
 * Build context for AI from project data
 */
async function buildProjectContext(projectId) {
  if (!projectId) {
    return { hasContext: false, context: '' };
  }

  try {
    const project = db.getProjectById.get(projectId);
    if (!project) {
      return { hasContext: false, context: '' };
    }

    let contextParts = [];
    contextParts.push(`# Project: ${project.name}\n`);

    // Get project wiki
    try {
      const wikiPath = path.join(__dirname, '../../storage/wikis', `project-${projectId}.md`);
      const wikiContent = await fs.readFile(wikiPath, 'utf-8');
      if (wikiContent && wikiContent.trim()) {
        contextParts.push(`## Current Wiki Documentation:\n${wikiContent}\n`);
      }
    } catch (error) {
      // Wiki might not exist yet
      contextParts.push(`## Wiki: Not yet created\n`);
    }

    // Get recent meetings (last 5)
    const meetings = db.getMeetingsByProject.all(projectId);
    const recentMeetings = meetings.slice(0, 5);

    if (recentMeetings.length > 0) {
      contextParts.push(`## Recent Meetings:\n`);

      for (const meeting of recentMeetings) {
        contextParts.push(`\n### ${meeting.title} (${new Date(meeting.date).toLocaleDateString()})\n`);

        // Load summary if available
        if (meeting.summary_path) {
          try {
            const summaryPath = path.join(__dirname, '../..', meeting.summary_path);
            const summaryContent = await fs.readFile(summaryPath, 'utf-8');
            const summary = JSON.parse(summaryContent);

            contextParts.push(`**Overview:** ${summary.overview}\n`);

            if (summary.context) {
              contextParts.push(`**Context:** ${summary.context}\n`);
            }

            if (summary.key_decisions && summary.key_decisions.length > 0) {
              contextParts.push(`**Decisions:**\n${summary.key_decisions.map(d => `- ${d}`).join('\n')}\n`);
            }

            if (summary.technical_details && summary.technical_details.length > 0) {
              contextParts.push(`**Technical:**\n${summary.technical_details.slice(0, 3).map(d => `- ${d}`).join('\n')}\n`);
            }
          } catch (error) {
            // Summary not available
          }
        }
      }
    } else {
      contextParts.push(`## Meetings: No meetings recorded yet\n`);
    }

    const context = contextParts.join('\n');
    return {
      hasContext: true,
      context: context,
      projectName: project.name,
    };
  } catch (error) {
    console.error('Error building project context:', error);
    return { hasContext: false, context: '', error: error.message };
  }
}

/**
 * Get AI response using Claude or GPT
 */
async function getAIResponse(messages, systemPrompt, backend = AI_BACKEND) {
  try {
    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      });

      return response.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }

      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
        max_tokens: 4096,
      });

      return completion.choices[0].message.content;
    }
  } catch (error) {
    console.error('AI response error:', error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

/**
 * POST /api/chat
 * Send a message to the AI mentor
 */
router.post('/', async (req, res, next) => {
  try {
    const { message, projectId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build project context if projectId provided
    const contextData = projectId ? await buildProjectContext(projectId) : { hasContext: false };

    // Get recent conversation history (last 10 messages)
    const recentMessages = db.getRecentChatMessages.all(
      projectId || null,
      projectId || null,
      10
    ).reverse(); // Reverse to get chronological order

    // Build message history for AI
    const aiMessages = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add current user message
    aiMessages.push({
      role: 'user',
      content: message,
    });

    // Build system prompt with context
    let fullSystemPrompt = SYSTEM_PROMPT;
    if (contextData.hasContext) {
      fullSystemPrompt += `\n\n---\n\n# Project Context\n\n${contextData.context}`;
    } else if (projectId) {
      fullSystemPrompt += `\n\nNote: User has selected a project, but no context is available yet. Acknowledge this if relevant.`;
    }

    // Get AI response
    console.log(`💬 Chat request ${projectId ? `for project ${projectId}` : '(general)'}`);
    const aiResponse = await getAIResponse(aiMessages, fullSystemPrompt);

    // Save user message to database
    const userMessageResult = db.createChatMessage.run(
      projectId || null,
      'user',
      message,
      contextData.hasContext ? JSON.stringify({ projectName: contextData.projectName }) : null
    );

    // Save AI response to database
    const aiMessageResult = db.createChatMessage.run(
      projectId || null,
      'assistant',
      aiResponse,
      null
    );

    console.log(`✅ Chat response generated`);

    res.json({
      success: true,
      message: aiResponse,
      messageId: aiMessageResult.lastInsertRowid,
      context: contextData.hasContext ? {
        projectName: contextData.projectName,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat
 * Get chat history
 */
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    const messages = db.getChatMessages.all(
      projectId || null,
      projectId || null
    );

    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
        projectId: msg.project_id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat
 * Clear chat history
 */
router.delete('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    db.clearChatHistory.run(
      projectId || null,
      projectId || null
    );

    console.log(`🗑️ Chat history cleared ${projectId ? `for project ${projectId}` : '(all)'}`);

    res.json({
      success: true,
      message: 'Chat history cleared',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
