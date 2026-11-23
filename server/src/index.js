import './config/env.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Conversation, Invite, Message, Notification, Upload, User } from './models/index.js';
import { connectDatabase } from './config/db.js';
import { configureCloudinary, cloudinary } from './config/cloudinary.js';
import { createApiRouter } from './routes/apiRoutes.js';
import { registerSocketHandlers } from './socket/index.js';
import { seedStarterChannels } from './utils/seed.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { handleError } from './middleware/errorHandler.js';
import { createMessageController } from './controllers/messageController.js';
import { uploadFile } from './middleware/uploadMiddleware.js';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 4000);
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'relay_workspace';
const secret = process.env.JWT_SECRET;
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);
if (!uri || uri.includes('YOUR_') || !secret || secret.includes('replace-with')) {
  console.error('Set MONGODB_URI and a private JWT_SECRET before starting the server.');
  process.exit(1);
}
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by the API.'));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
const io = new Server(server, { cors: corsOptions });
configureCloudinary();
const colors = ['#79b8a2', '#e8a15b', '#7f9cf5', '#d77bb2', '#6a9fe8', '#c1a46f'];
const room = (id) => 'conversation:' + String(id);
const userRoom = (id) => 'user:' + String(id);
const email = (value) => String(value || '').trim().toLowerCase();
const initials = (name) => String(name || 'User').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
const asUser = (user) => ({
  id: String(user._id), name: user.name, email: user.email, initials: user.initials,
  avatarColor: user.avatarColor, avatarUrl: user.avatarUrl || '',
  status: user.status || 'Available', presence: user.presence || 'offline',
  lastSeenAt: user.lastSeenAt || null,
});
const asMessage = (value) => {
  const message = value.toObject ? value.toObject() : value;
  return { ...message, _id: String(message._id), channelId: String(message.channelId), authorId: String(message.authorId) };
};
const text = (value, label, max) => {
  const result = String(value || '').trim();
  if (!result || result.length > max) throw new Error(label + ' is invalid.');
  return result;
};
const safeAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const canAccess = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const conversation = await Conversation.findById(id);
  if (!conversation) return null;
  if (conversation.type !== 'channel' && !conversation.memberIds.some((member) => String(member) === String(userId))) return null;
  return conversation;
};
const createMessage = createMessageController({ mongoose, Message, Upload, User, Notification, io, userRoom });
const auth = createAuthMiddleware({ jwt, secret, User });

app.use(createApiRouter({ express, mongoose, bcrypt, jwt, secret, User, Conversation, Message, Notification, Invite, Upload, asUser, asMessage, text, email, initials, colors, auth, safeAsync, canAccess, createMessage, room, userRoom, io, cloudinary, uploadFile }));

app.use(handleError);

registerSocketHandlers({ io, jwt, secret, User, asUser, userRoom, room, canAccess, createMessage, asMessage, mongoose, Message });

const start = async () => {
  await connectDatabase({ uri, dbName });
  await Conversation.updateMany({ type: { $exists: false } }, { $set: { type: 'channel' } });
  await User.updateMany({ presence: 'online' }, { $set: { presence: 'offline', lastSeenAt: new Date() } });
  await seedStarterChannels(Conversation);
  server.listen(port, '0.0.0.0', () => console.log('API and Socket.IO listening on port ' + port));
};
start().catch((error) => {
  console.error('server startup failed', error);
  process.exit(1);
});
const shutdown = async () => {
  io.close();
  await mongoose.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

