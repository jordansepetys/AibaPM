import { Server } from 'socket.io';

let io = null;

export function initializeSocketIO(httpServer, corsOptions) {
  io = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a meeting room to receive updates for specific meetings
    socket.on('subscribe:meeting', (meetingId) => {
      socket.join(`meeting:${meetingId}`);
      console.log(`Client ${socket.id} subscribed to meeting:${meetingId}`);
    });

    // Leave a meeting room
    socket.on('unsubscribe:meeting', (meetingId) => {
      socket.leave(`meeting:${meetingId}`);
      console.log(`Client ${socket.id} unsubscribed from meeting:${meetingId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  console.log('Socket.IO initialized');
  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
}

// Emit meeting processing status update
export function emitMeetingStatus(meetingId, status, data = {}) {
  if (!io) return;

  io.to(`meeting:${meetingId}`).emit('meeting:status', {
    meetingId,
    status,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

// Status types
export const MeetingStatus = {
  PROCESSING_STARTED: 'processing_started',
  TRANSCRIBING: 'transcribing',
  ANALYZING: 'analyzing',
  SAVING: 'saving',
  COMPLETED: 'completed',
  ERROR: 'error',
};
