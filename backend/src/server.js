import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env FIRST before importing anything else
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });
console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
console.log('ANTHROPIC_API_KEY loaded:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');

import express from 'express';
import cors from 'cors';
import http from 'http';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { initializeSocketIO } from './services/socketService.js';

// Import database to initialize it
import './db/database.js';

// Import routes (placeholder for now)
import projectsRouter from './routes/projects.js';
import meetingsRouter from './routes/meetings.js';
import wikiRouter from './routes/wiki.js';
import searchRouter from './routes/search.js';
import chatRouter from './routes/chat.js';
import skillsRouter from './routes/skills.js';
import settingsRouter from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: { error: 'Upload limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration - tighten in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200,
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../storage/audio'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to API routes
app.use('/api', generalLimiter);

// Make upload middleware available to routes
app.set('upload', upload);

// Static files
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Health check
app.get('/api/health', (req, res) => {
  const aiBackend = process.env.AI_BACKEND || 'openai';
  const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
  res.json({
    status: 'ok',
    message: 'Server is running',
    aiBackend: aiBackend,
    modelName: modelName,
  });
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/wiki', wikiRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/settings', settingsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server for Socket.IO integration
const httpServer = http.createServer(app);

// Initialize Socket.IO with the same CORS options
initializeSocketIO(httpServer, corsOptions);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`WebSocket support enabled`);
});
