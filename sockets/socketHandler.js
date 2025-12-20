import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import Admin from '../models/Admin.js';
import User from '../models/User.js';

let io;
const userSockets = new Map(); // userId -> socketId
const adminSockets = new Set(); // Set of admin socketIds

/**
 * Initialize Socket.io Server
 * @param {Object} server - HTTP server instance
 */
export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = verifyAccessToken(token);

      // Attach user info to socket
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      // Verify user exists and is active
      if (decoded.role === 'admin' || decoded.role === 'superadmin') {
        const admin = await Admin.findById(decoded.id);
        if (!admin || !admin.isActive) {
          return next(new Error('Authentication error: Admin not found or inactive'));
        }
        socket.userType = 'admin';
      } else {
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
          return next(new Error('Authentication error: User not found or inactive'));
        }
        socket.userType = 'customer';
      }

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id} | User: ${socket.userId} | Type: ${socket.userType}`);

    // Store socket connection
    if (socket.userType === 'admin') {
      adminSockets.add(socket.id);
      socket.join('admins'); // Join admin room
    } else {
      userSockets.set(socket.userId, socket.id);
      socket.join(`user:${socket.userId}`); // Join user-specific room
    }

    // Send connection success
    socket.emit('connected', {
      message: 'Connected to real-time server',
      userId: socket.userId,
      userType: socket.userType,
    });

    // Handle custom events
    socket.on('join_order_room', (orderId) => {
      socket.join(`order:${orderId}`);
      console.log(`Socket ${socket.id} joined order room: ${orderId}`);
    });

    socket.on('leave_order_room', (orderId) => {
      socket.leave(`order:${orderId}`);
      console.log(`Socket ${socket.id} left order room: ${orderId}`);
    });

    // Admin-specific events
    if (socket.userType === 'admin') {
      socket.on('request_dashboard_update', () => {
        socket.emit('dashboard_update_requested', {
          message: 'Dashboard update requested',
        });
      });
    }

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id} | User: ${socket.userId}`);

      if (socket.userType === 'admin') {
        adminSockets.delete(socket.id);
      } else {
        userSockets.delete(socket.userId);
      }
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
};

/**
 * Get Socket.io instance
 * @returns {Object} Socket.io instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

/**
 * Emit event to specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToUser = (userId, event, data) => {
  if (!io) return;

  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date(),
  });

  console.log(`📤 Emitted '${event}' to user: ${userId}`);
};

/**
 * Emit event to all admins
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToAdmins = (event, data) => {
  if (!io) return;

  io.to('admins').emit(event, {
    ...data,
    timestamp: new Date(),
  });

  console.log(`📤 Emitted '${event}' to all admins`);
};

/**
 * Emit event to specific order room
 * @param {string} orderId - Order ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToOrderRoom = (orderId, event, data) => {
  if (!io) return;

  io.to(`order:${orderId}`).emit(event, {
    ...data,
    timestamp: new Date(),
  });

  console.log(`📤 Emitted '${event}' to order room: ${orderId}`);
};

/**
 * Broadcast event to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToAll = (event, data) => {
  if (!io) return;

  io.emit(event, {
    ...data,
    timestamp: new Date(),
  });

  console.log(`📤 Broadcasted '${event}' to all clients`);
};

/**
 * Get connected users count
 * @returns {Object} Connection statistics
 */
export const getConnectionStats = () => {
  if (!io) {
    return { users: 0, admins: 0, total: 0 };
  }

  return {
    users: userSockets.size,
    admins: adminSockets.size,
    total: userSockets.size + adminSockets.size,
  };
};

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {boolean} Online status
 */
export const isUserOnline = (userId) => {
  return userSockets.has(userId);
};

/**
 * Disconnect specific user
 * @param {string} userId - User ID
 * @param {string} reason - Disconnect reason
 */
export const disconnectUser = (userId, reason = 'Disconnected by server') => {
  if (!io) return;

  const socketId = userSockets.get(userId);
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('force_disconnect', { reason });
      socket.disconnect(true);
    }
  }
};
