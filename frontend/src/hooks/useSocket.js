import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// In production (same origin), use relative URL. In dev, use localhost:3001
const SOCKET_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.log('Socket connection error:', error.message);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const subscribe = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { subscribe, emit, socket: socketRef.current };
}

export function useMeetingSocket(meetingId, onStatusUpdate) {
  const { subscribe, emit } = useSocket();

  useEffect(() => {
    if (!meetingId) return;

    // Subscribe to meeting updates
    emit('subscribe:meeting', meetingId);

    // Listen for status updates
    const unsubscribe = subscribe('meeting:status', (data) => {
      if (data.meetingId === meetingId && onStatusUpdate) {
        onStatusUpdate(data);
      }
    });

    return () => {
      emit('unsubscribe:meeting', meetingId);
      unsubscribe();
    };
  }, [meetingId, subscribe, emit, onStatusUpdate]);
}
