import express from 'express';
import {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  getMeetingsByProject,
  updateMeeting,
  deleteMeeting,
  createMeetingMetadata,
  getMeetingMetadata,
  updateMeetingMetadata,
} from '../db/database.js';
import { saveAudioFile, validateAudioFile } from '../services/audioProcessor.js';
import { transcribeWithRetry, saveTranscript } from '../services/transcription.js';
import { analyzeMeeting, saveSummary } from '../services/aiAnalysis.js';
import { buildSearchIndex } from '../services/searchIndex.js';

const router = express.Router();

/**
 * GET /api/meetings
 * Get all meetings or filter by project
 */
router.get('/', (req, res, next) => {
  try {
    const { projectId } = req.query;

    let meetings;
    if (projectId) {
      meetings = getMeetingsByProject.all(parseInt(projectId, 10));
    } else {
      meetings = getAllMeetings.all();
    }

    res.json({ meetings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details with metadata
 */
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get metadata if exists
    const metadata = getMeetingMetadata.get(parseInt(id, 10));

    res.json({
      meeting,
      metadata: metadata || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/meetings
 * Create a new meeting with audio upload
 */
router.post('/', async (req, res, next) => {
  const upload = req.app.get('upload');

  upload.single('audio')(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    try {
      const { projectId, title, date } = req.body;
      const audioFile = req.file;

      // Validate required fields
      if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required' });
      }

      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Validate audio file
      const validation = validateAudioFile(audioFile.mimetype, audioFile.size);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Create meeting record
      const result = createMeeting.run(
        projectId ? parseInt(projectId, 10) : null,
        title,
        date,
        null, // duration (will be set after transcription)
        audioFile.path.replace(/\\/g, '/'), // audio_path
        null, // transcript_path
        null  // summary_path
      );

      const meetingId = result.lastInsertRowid;

      // Start async processing (transcription + analysis)
      // In production, this should be a background job
      processMeeting(meetingId, audioFile.path, title, date).catch(error => {
        console.error(`Error processing meeting ${meetingId}:`, error);
      });

      const meeting = getMeetingById.get(meetingId);

      res.status(201).json({
        message: 'Meeting created successfully. Processing in background.',
        meeting,
      });
    } catch (error) {
      next(error);
    }
  });
});

/**
 * POST /api/meetings/:id/reprocess
 * Re-transcribe and analyze a meeting
 */
router.post('/:id/reprocess', async (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.audio_path) {
      return res.status(400).json({ error: 'No audio file associated with this meeting' });
    }

    // Start reprocessing
    processMeeting(meeting.id, meeting.audio_path, meeting.title, meeting.date).catch(error => {
      console.error(`Error reprocessing meeting ${meeting.id}:`, error);
    });

    res.json({
      message: 'Meeting reprocessing started',
      meeting,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete from database (cascade will handle metadata and search index)
    deleteMeeting.run(parseInt(id, 10));

    // Note: Audio/transcript files are kept until cleanup cron runs

    res.json({
      message: 'Meeting deleted successfully',
      meeting,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Background processing function
 * Handles transcription, analysis, and indexing
 */
async function processMeeting(meetingId, audioPath, title, date) {
  try {
    console.log(`\n=== Processing meeting ${meetingId} ===`);

    // Step 1: Transcribe audio
    console.log('Step 1: Transcribing audio...');
    const transcription = await transcribeWithRetry(audioPath);

    // Step 2: Save transcript
    console.log('Step 2: Saving transcript...');
    const transcriptPaths = await saveTranscript(
      transcription.text,
      meetingId,
      {
        title,
        date,
        duration: transcription.duration,
        segments: transcription.segments,
      }
    );

    // Step 3: Analyze transcript
    console.log('Step 3: Analyzing meeting...');
    const analysis = await analyzeMeeting(transcription.text);

    // Step 4: Save summary
    console.log('Step 4: Saving summary...');
    const summaryPath = await saveSummary(analysis, meetingId);

    // Step 5: Update meeting record
    console.log('Step 5: Updating meeting record...');
    const meeting = getMeetingById.get(meetingId);
    updateMeeting.run(
      meeting.title,
      meeting.date,
      Math.floor(transcription.duration || 0),
      meeting.audio_path,
      transcriptPaths.txtPath,
      summaryPath,
      meetingId
    );

    // Step 6: Save metadata
    console.log('Step 6: Saving metadata...');
    const existingMetadata = getMeetingMetadata.get(meetingId);
    if (existingMetadata) {
      updateMeetingMetadata.run(
        JSON.stringify(analysis.key_decisions),
        JSON.stringify(analysis.action_items),
        JSON.stringify(analysis.risks),
        JSON.stringify(analysis.open_questions),
        meetingId
      );
    } else {
      createMeetingMetadata.run(
        meetingId,
        JSON.stringify(analysis.key_decisions),
        JSON.stringify(analysis.action_items),
        JSON.stringify(analysis.risks),
        JSON.stringify(analysis.open_questions)
      );
    }

    // Step 7: Build search index
    console.log('Step 7: Building search index...');
    await buildSearchIndex(meetingId, transcription.text, analysis);

    console.log(`=== Meeting ${meetingId} processing complete ===\n`);
  } catch (error) {
    console.error(`Failed to process meeting ${meetingId}:`, error);
    throw error;
  }
}

export default router;
