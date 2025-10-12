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
const ANALYSIS_PROMPT = `You are an AI assistant that analyzes meeting transcripts and extracts key information.

Analyze the following meeting transcript and provide a structured summary in JSON format with these fields:

1. "overview": A brief 2-3 sentence summary of the meeting
2. "key_decisions": An array of important decisions made (include "N/A" if none)
3. "action_items": An array of objects with "task" and "owner" fields (include empty array if none)
4. "risks": An array of potential risks or concerns mentioned (include empty array if none)
5. "open_questions": An array of unresolved questions (include empty array if none)
6. "technical_details": An array of important technical details or specifications (include empty array if none)

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
      key_decisions: Array.isArray(parsed.key_decisions) ? parsed.key_decisions : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : [],
      technical_details: Array.isArray(parsed.technical_details) ? parsed.technical_details : [],
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
    max_tokens: 2048,
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
        content: 'You are a meeting analysis assistant that returns structured JSON responses.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
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
