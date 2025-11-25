import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const dbPath = path.join(__dirname, '../..', 'aiba.db');
const storageDir = path.join(__dirname, '../../storage');

/**
 * GET /api/data/export
 * Export all data as JSON bundle (excludes audio files)
 */
router.get('/export', async (req, res, next) => {
  try {
    const db = new Database(dbPath, { readonly: true });

    console.log('Starting data export...');

    // Export database tables
    const projects = db.prepare('SELECT * FROM projects').all();
    const meetings = db.prepare('SELECT * FROM meetings').all();
    const meetingMetadata = db.prepare('SELECT * FROM meeting_metadata').all();
    const skills = db.prepare('SELECT * FROM skills').all();
    const chatMessages = db.prepare('SELECT * FROM chat_messages').all();

    db.close();

    // Export transcript files
    const transcripts = {};
    const transcriptsDir = path.join(storageDir, 'transcripts');
    try {
      const transcriptFiles = await fs.readdir(transcriptsDir);
      for (const file of transcriptFiles) {
        if (file === '.gitkeep') continue;
        const content = await fs.readFile(path.join(transcriptsDir, file), 'utf-8');
        transcripts[file] = content;
      }
    } catch (err) {
      console.warn('Could not read transcripts:', err.message);
    }

    // Export summary files
    const summaries = {};
    const summariesDir = path.join(storageDir, 'summaries');
    try {
      const summaryFiles = await fs.readdir(summariesDir);
      for (const file of summaryFiles) {
        if (file === '.gitkeep') continue;
        const content = await fs.readFile(path.join(summariesDir, file), 'utf-8');
        summaries[file] = content;
      }
    } catch (err) {
      console.warn('Could not read summaries:', err.message);
    }

    // Export wiki files
    const wikis = {};
    const wikisDir = path.join(storageDir, 'wikis');
    try {
      const wikiFiles = await fs.readdir(wikisDir);
      for (const file of wikiFiles) {
        if (file === '.gitkeep') continue;
        const content = await fs.readFile(path.join(wikisDir, file), 'utf-8');
        wikis[file] = content;
      }
    } catch (err) {
      console.warn('Could not read wikis:', err.message);
    }

    // Export skills files (global and project-specific)
    const skillFiles = {};
    const skillsDir = path.join(storageDir, 'skills');

    async function readSkillsRecursive(dir, prefix = '') {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await readSkillsRecursive(fullPath, relativePath);
          } else if (entry.name !== '.gitkeep') {
            const content = await fs.readFile(fullPath, 'utf-8');
            skillFiles[relativePath] = content;
          }
        }
      } catch (err) {
        console.warn('Could not read skills dir:', err.message);
      }
    }
    await readSkillsRecursive(skillsDir);

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      database: {
        projects,
        meetings,
        meetingMetadata,
        skills,
        chatMessages,
      },
      files: {
        transcripts,
        summaries,
        wikis,
        skills: skillFiles,
      },
    };

    const stats = {
      projects: projects.length,
      meetings: meetings.length,
      transcripts: Object.keys(transcripts).length,
      summaries: Object.keys(summaries).length,
      wikis: Object.keys(wikis).length,
      skills: skills.length,
    };

    console.log('Export complete:', stats);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="aiba-export-${Date.now()}.json"`);

    res.json(exportData);
  } catch (error) {
    console.error('Export failed:', error);
    next(error);
  }
});

/**
 * POST /api/data/import
 * Import data from JSON bundle
 */
router.post('/import', express.json({ limit: '100mb' }), async (req, res, next) => {
  try {
    const importData = req.body;

    if (!importData.version || !importData.database) {
      return res.status(400).json({ error: 'Invalid import file format' });
    }

    console.log('Starting data import...');

    const db = new Database(dbPath);

    // Use a transaction for database operations
    const importDb = db.transaction(() => {
      // Clear existing data (in reverse order of dependencies)
      db.prepare('DELETE FROM search_index').run();
      db.prepare('DELETE FROM chat_messages').run();
      db.prepare('DELETE FROM meeting_metadata').run();
      db.prepare('DELETE FROM meetings').run();
      db.prepare('DELETE FROM skills').run();
      db.prepare('DELETE FROM projects').run();

      // Reset autoincrement counters
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('projects', 'meetings', 'meeting_metadata', 'skills', 'chat_messages', 'search_index')").run();

      // Import projects
      const insertProject = db.prepare(`
        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const project of importData.database.projects || []) {
        insertProject.run(project.id, project.name, project.created_at, project.updated_at);
      }

      // Import meetings (clear audio_path since we're not importing audio)
      const insertMeeting = db.prepare(`
        INSERT INTO meetings (id, project_id, title, date, audio_path, transcript_path, summary_path, duration, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
      `);
      for (const meeting of importData.database.meetings || []) {
        insertMeeting.run(
          meeting.id, meeting.project_id, meeting.title, meeting.date,
          meeting.transcript_path, meeting.summary_path, meeting.duration,
          meeting.created_at, meeting.updated_at
        );
      }

      // Import meeting metadata
      const insertMetadata = db.prepare(`
        INSERT INTO meeting_metadata (id, meeting_id, decisions, action_items, risks, questions, ai_model_info)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const meta of importData.database.meetingMetadata || []) {
        insertMetadata.run(
          meta.id, meta.meeting_id, meta.decisions, meta.action_items,
          meta.risks, meta.questions, meta.ai_model_info
        );
      }

      // Import skills
      const insertSkill = db.prepare(`
        INSERT INTO skills (id, name, slug, description, content, is_global, project_id, trigger_keywords, auto_activate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const skill of importData.database.skills || []) {
        insertSkill.run(
          skill.id, skill.name, skill.slug, skill.description, skill.content,
          skill.is_global, skill.project_id, skill.trigger_keywords, skill.auto_activate,
          skill.created_at, skill.updated_at
        );
      }

      // Import chat messages
      const insertChat = db.prepare(`
        INSERT INTO chat_messages (id, project_id, role, content, context_snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const msg of importData.database.chatMessages || []) {
        insertChat.run(
          msg.id, msg.project_id, msg.role, msg.content, msg.context_snapshot, msg.created_at
        );
      }
    });

    importDb();
    db.close();

    // Import files
    const files = importData.files || {};

    // Write transcript files
    const transcriptsDir = path.join(storageDir, 'transcripts');
    await fs.mkdir(transcriptsDir, { recursive: true });
    for (const [filename, content] of Object.entries(files.transcripts || {})) {
      await fs.writeFile(path.join(transcriptsDir, filename), content);
    }

    // Write summary files
    const summariesDir = path.join(storageDir, 'summaries');
    await fs.mkdir(summariesDir, { recursive: true });
    for (const [filename, content] of Object.entries(files.summaries || {})) {
      await fs.writeFile(path.join(summariesDir, filename), content);
    }

    // Write wiki files
    const wikisDir = path.join(storageDir, 'wikis');
    await fs.mkdir(wikisDir, { recursive: true });
    for (const [filename, content] of Object.entries(files.wikis || {})) {
      await fs.writeFile(path.join(wikisDir, filename), content);
    }

    // Write skills files
    const skillsStorageDir = path.join(storageDir, 'skills');
    for (const [relativePath, content] of Object.entries(files.skills || {})) {
      const fullPath = path.join(skillsStorageDir, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }

    const stats = {
      projects: (importData.database.projects || []).length,
      meetings: (importData.database.meetings || []).length,
      transcripts: Object.keys(files.transcripts || {}).length,
      summaries: Object.keys(files.summaries || {}).length,
      wikis: Object.keys(files.wikis || {}).length,
      skills: (importData.database.skills || []).length,
    };

    console.log('Import complete:', stats);

    res.json({
      message: 'Import successful',
      imported: stats,
    });
  } catch (error) {
    console.error('Import failed:', error);
    next(error);
  }
});

/**
 * GET /api/data/stats
 * Get current data statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const db = new Database(dbPath, { readonly: true });

    const stats = {
      projects: db.prepare('SELECT COUNT(*) as count FROM projects').get().count,
      meetings: db.prepare('SELECT COUNT(*) as count FROM meetings').get().count,
      skills: db.prepare('SELECT COUNT(*) as count FROM skills').get().count,
      chatMessages: db.prepare('SELECT COUNT(*) as count FROM chat_messages').get().count,
    };

    db.close();

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
