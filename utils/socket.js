import { Server as SocketIOServer } from 'socket.io';

// Declare a variable to hold the Socket.IO instance
let io;

/**
 * Initializes the Socket.IO server and attaches it to the HTTP server.
 * @param {import('http').Server} httpServer The HTTP server instance from Express.
 */
export const initSocket = (httpServer) => {
  // Check if Socket.IO is already initialized
  if (io) {
    return io;
  }

  // Initialize Socket.IO Server
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:3000", 
        "https://admin.paarel.com",
        "https://stylersoutfit-dashboard-amtv.vercel.app",
        "https://stylersoutfit-dashboard.vercel.app",
        "https://admin.paarel.com",
        "admin.paarel.com",
      ], 
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Handle connections
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket.IO] Server initialized.');
  return io;
};

/**
 * Gets the Socket.IO instance.
 * @returns {import('socket.io').Server} The Socket.IO server instance.
 * @throws {Error} If Socket.IO has not been initialized.
 */
export const getIo = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized! Call initSocket(httpServer) first.');
  }
  return io;
};