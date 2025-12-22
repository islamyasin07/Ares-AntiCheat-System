import { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { config } from './config';

let io: IOServer | null = null;

export function setupSocket(server: HttpServer) {
  if (io) return io;

  io = new IOServer(server, {
    cors: {
      origin: config.allowOrigin === '*' ? true : config.allowOrigin,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
  });

  return io;
}

export function emitMlDetection(payload: any) {
  if (!io) return false;
  io.emit('ml_detection', payload);
  return true;
}

export function getIo() {
  return io;
}
