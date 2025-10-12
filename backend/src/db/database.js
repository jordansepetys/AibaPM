import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../..', 'aiba.db');

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      audio_path TEXT,
      transcript_path TEXT,
      summary_path TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Meeting metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meeting_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      decisions TEXT,
      action_items TEXT,
      risks TEXT,
      questions TEXT,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  // Search index table
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT,
      rank INTEGER DEFAULT 0,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  // Chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      context_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  console.log('Database initialized successfully');
}

// Initialize on import
initializeDatabase();

// Helper functions for database operations

// Projects
export const createProject = db.prepare(`
  INSERT INTO projects (name) VALUES (?)
`);

export const getAllProjects = db.prepare(`
  SELECT * FROM projects ORDER BY created_at DESC
`);

export const getProjectById = db.prepare(`
  SELECT * FROM projects WHERE id = ?
`);

export const updateProject = db.prepare(`
  UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`);

export const deleteProject = db.prepare(`
  DELETE FROM projects WHERE id = ?
`);

// Meetings
export const createMeeting = db.prepare(`
  INSERT INTO meetings (project_id, title, date, duration, audio_path, transcript_path, summary_path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const getAllMeetings = db.prepare(`
  SELECT * FROM meetings ORDER BY date DESC
`);

export const getMeetingById = db.prepare(`
  SELECT * FROM meetings WHERE id = ?
`);

export const getMeetingsByProject = db.prepare(`
  SELECT * FROM meetings WHERE project_id = ? ORDER BY date DESC
`);

export const updateMeeting = db.prepare(`
  UPDATE meetings
  SET title = ?, date = ?, duration = ?, audio_path = ?, transcript_path = ?, summary_path = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

export const deleteMeeting = db.prepare(`
  DELETE FROM meetings WHERE id = ?
`);

// Meeting metadata
export const createMeetingMetadata = db.prepare(`
  INSERT INTO meeting_metadata (meeting_id, decisions, action_items, risks, questions)
  VALUES (?, ?, ?, ?, ?)
`);

export const getMeetingMetadata = db.prepare(`
  SELECT * FROM meeting_metadata WHERE meeting_id = ?
`);

export const updateMeetingMetadata = db.prepare(`
  UPDATE meeting_metadata
  SET decisions = ?, action_items = ?, risks = ?, questions = ?
  WHERE meeting_id = ?
`);

// Search index
export const addToSearchIndex = db.prepare(`
  INSERT INTO search_index (meeting_id, content, content_type, rank)
  VALUES (?, ?, ?, ?)
`);

export const searchMeetings = db.prepare(`
  SELECT DISTINCT m.*, si.rank
  FROM meetings m
  JOIN search_index si ON m.id = si.meeting_id
  WHERE si.content LIKE ?
  ORDER BY si.rank DESC, m.date DESC
`);

export const clearSearchIndexForMeeting = db.prepare(`
  DELETE FROM search_index WHERE meeting_id = ?
`);

// Chat messages
export const createChatMessage = db.prepare(`
  INSERT INTO chat_messages (project_id, role, content, context_snapshot)
  VALUES (?, ?, ?, ?)
`);

export const getChatMessages = db.prepare(`
  SELECT * FROM chat_messages
  WHERE project_id IS ? OR project_id = ?
  ORDER BY created_at ASC
`);

export const getRecentChatMessages = db.prepare(`
  SELECT * FROM chat_messages
  WHERE project_id IS ? OR project_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

export const clearChatHistory = db.prepare(`
  DELETE FROM chat_messages WHERE project_id IS ? OR project_id = ?
`);

export default db;
