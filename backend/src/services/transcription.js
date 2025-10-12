import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSCRIPT_DIR = path.join(__dirname, '../../storage/transcripts');

// Initialize OpenAI client (lazy initialization)
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Transcribe audio file using OpenAI Whisper
 * @param {string} audioPath - Path to audio file
 * @param {string} language - Language code (optional)
 * @returns {Promise<Object>} Transcription result
 */
export const transcribeAudio = async (audioPath, language = 'en') => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log(`Starting transcription for: ${audioPath}`);

    // Get full path to audio file
    // If audioPath is already absolute (starts with C:/ or /), use it as-is
    // Otherwise, treat it as relative to backend directory
    const fullAudioPath = path.isAbsolute(audioPath)
      ? audioPath
      : path.join(__dirname, '../..', audioPath);

    console.log(`Resolved audio path: ${fullAudioPath}`);

    // Check file exists
    await fs.access(fullAudioPath);

    // Get file stats for size check
    const stats = await fs.stat(fullAudioPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    console.log(`Audio file size: ${fileSizeMB.toFixed(2)}MB`);

    // Whisper API has a 25MB limit - handle chunking if needed
    if (fileSizeMB > 25) {
      console.warn('File exceeds 25MB - chunking would be required in production');
      // In production, implement audio chunking here
      throw new Error('Audio file too large for transcription (>25MB). Chunking not yet implemented.');
    }

    // Create read stream for the file
    const audioFile = await fs.readFile(fullAudioPath);
    const blob = new Blob([audioFile]);
    const file = new File([blob], path.basename(fullAudioPath));

    // Call Whisper API
    const transcription = await client.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json', // Get timestamps
    });

    console.log(`Transcription completed: ${transcription.text.length} characters`);

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments || [],
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
};

/**
 * Save transcript to file system
 * @param {string} transcript - Transcript text
 * @param {number} meetingId - Meeting ID
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Saved file paths
 */
export const saveTranscript = async (transcript, meetingId, metadata = {}) => {
  try {
    // Ensure transcript directory exists
    await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });

    const timestamp = Date.now();
    const baseFilename = `meeting-${meetingId}-${timestamp}`;

    // Save as plain text
    const txtPath = path.join(TRANSCRIPT_DIR, `${baseFilename}.txt`);
    await fs.writeFile(txtPath, transcript);

    // Save as markdown with metadata
    const mdContent = generateMarkdownTranscript(transcript, metadata);
    const mdPath = path.join(TRANSCRIPT_DIR, `${baseFilename}.md`);
    await fs.writeFile(mdPath, mdContent);

    console.log(`Transcript saved: ${baseFilename}`);

    return {
      txtPath: `/storage/transcripts/${baseFilename}.txt`,
      mdPath: `/storage/transcripts/${baseFilename}.md`,
    };
  } catch (error) {
    console.error('Error saving transcript:', error);
    throw new Error('Failed to save transcript');
  }
};

/**
 * Generate formatted markdown transcript
 * @param {string} transcript - Transcript text
 * @param {Object} metadata - Meeting metadata
 * @returns {string} Formatted markdown
 */
const generateMarkdownTranscript = (transcript, metadata) => {
  const { title, date, duration, segments } = metadata;

  let markdown = `# ${title || 'Meeting Transcript'}\n\n`;
  markdown += `**Date:** ${date ? new Date(date).toLocaleString() : 'N/A'}\n`;
  markdown += `**Duration:** ${duration ? formatDuration(duration) : 'N/A'}\n\n`;
  markdown += `---\n\n`;

  // Add segments with timestamps if available
  if (segments && segments.length > 0) {
    markdown += `## Transcript with Timestamps\n\n`;
    for (const segment of segments) {
      const timestamp = formatTimestamp(segment.start);
      markdown += `**[${timestamp}]** ${segment.text}\n\n`;
    }
  } else {
    markdown += `## Transcript\n\n${transcript}\n`;
  }

  return markdown;
};

/**
 * Format duration in seconds to readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Format timestamp in seconds to MM:SS
 * @param {number} seconds - Timestamp in seconds
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Read transcript from file
 * @param {string} transcriptPath - Path to transcript file
 * @returns {Promise<string>} Transcript content
 */
export const readTranscript = async (transcriptPath) => {
  try {
    const fullPath = path.join(__dirname, '../..', transcriptPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading transcript:', error);
    throw new Error('Failed to read transcript');
  }
};

/**
 * Retry transcription with exponential backoff
 * @param {string} audioPath - Path to audio file
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Transcription result
 */
export const transcribeWithRetry = async (audioPath, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioPath);
    } catch (error) {
      lastError = error;
      console.error(`Transcription attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Transcription failed after ${maxRetries} attempts: ${lastError.message}`);
};
