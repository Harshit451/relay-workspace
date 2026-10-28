import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Conversation, Invite, Message, Notification, Upload, User } from './models.js';

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
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const acceptedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    callback(acceptedMimeTypes.has(file.mimetype) ? null : new Error('Choose an image, PDF, text file, or DOCX file.'), acceptedMimeTypes.has(file.mimetype));
  },
});
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
const auth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, secret);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
    return next();
  } catch {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }
};
const canAccess = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const conversation = await Conversation.findById(id);
  if (!conversation) return null;
  if (conversation.type !== 'channel' && !conversation.memberIds.some((member) => String(member) === String(userId))) return null;
  return conversation;
};
const createMessage = async (conversation, user, body, replyToId = null, attachmentIds = [], clientMessageId = '') => {
  const clientId = String(clientMessageId || '').slice(0, 100);
  if (clientId) {
    const previous = await Message.findOne({ channelId: conversation._id, authorId: user._id, clientMessageId: clientId });
    if (previous) return previous;
  }
  if (replyToId) {
    if (!mongoose.isValidObjectId(replyToId) || !await Message.exists({ _id: replyToId, channelId: conversation._id, deletedAt: null })) {
      throw new Error('The reply target is not available in this conversation.');
    }
  }
  const uploads = [];
  if (Array.isArray(attachmentIds) && attachmentIds.length) {
    if (attachmentIds.length > 5 || !attachmentIds.every(mongoose.isValidObjectId)) throw new Error('Choose up to five valid attachments.');
    const owned = await Upload.find({ _id: { $in: attachmentIds }, ownerId: user._id, attachedAt: null });
    if (owned.length !== attachmentIds.length) throw new Error('One or more attachments are no longer available.');
    uploads.push(...owned.map((item) => ({ uploadId: item._id, url: item.url, publicId: item.publicId, resourceType: item.resourceType, name: item.name, mimeType: item.mimeType, size: item.size })));
  }
  const messageBody = String(body || '').trim();
  if (messageBody.length > 2000) throw new Error('Message is too long.');
  if (!messageBody && !uploads.length) throw new Error('Add a message or an attachment.');
  let message;
  try {
    message = await Message.create({
      channelId: conversation._id, authorId: user._id, authorName: user.name,
      authorInitials: user.initials, avatarColor: user.avatarColor,
      body: messageBody, attachments: uploads, ...(clientId ? { clientMessageId: clientId } : {}),
      replyToId: replyToId || null, readBy: [user._id],
    });
  } catch (error) {
    if (error.code === 11000 && clientId) {
      const existing = await Message.findOne({ channelId: conversation._id, authorId: user._id, clientMessageId: clientId });
      if (existing) return existing;
    }
    throw error;
  }
  if (uploads.length) await Upload.updateMany({ _id: { $in: attachmentIds } }, { $set: { attachedAt: message.createdAt } });
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  const recipients = new Map();
  if (conversation.type !== 'channel') {
    const awayMembers = await User.find({ _id: { $in: conversation.memberIds, $ne: user._id }, presence: { $ne: 'online' } }).select('_id');
    for (const member of awayMembers) recipients.set(String(member._id), { userId: member._id, title: 'New message from ' + user.name });
  }
  const mentionedEmails = [...String(body).matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((match) => match[1].toLowerCase());
  if (mentionedEmails.length) {
    const mentioned = await User.find({ email: { $in: mentionedEmails }, _id: { $ne: user._id } }).select('_id');
    for (const member of mentioned) recipients.set(String(member._id), { userId: member._id, title: 'You were mentioned by ' + user.name });
  }
  if (recipients.size) {
    const createdNotifications = await Notification.insertMany([...recipients.values()].map((item) => ({ ...item, body: String(body).slice(0, 500) })));
    for (const notification of createdNotifications) io.to(userRoom(notification.userId)).emit('notification:new', notification);
  }
  return message;
};

app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 }));
app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = text(req.body.name, 'Name', 80);
    const userEmail = email(req.body.email);
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(userEmail) || password.length < 8) {
      return res.status(400).json({ message: 'Use a valid email and a password with at least 8 characters.' });
    }
    const user = await User.create({
      name, email: userEmail, passwordHash: await bcrypt.hash(password, 12),
      initials: initials(name), avatarColor: colors[(await User.countDocuments()) % colors.length],
    });
    return res.status(201).json({ user: asUser(user), token: jwt.sign({ sub: String(user._id) }, secret, { expiresIn: '7d' }) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account already uses that email.' });
    return res.status(400).json({ message: 'We could not create that account.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: email(req.body.email) });
    if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return res.json({ user: asUser(user), token: jwt.sign({ sub: String(user._id) }, secret, { expiresIn: '7d' }) });
  } catch {
    return res.status(500).json({ message: 'We could not sign you in right now.' });
  }
});
app.get('/api/me', auth, (req, res) => res.json({ user: asUser(req.user) }));
app.patch('/api/me', auth, safeAsync(async (req, res) => {
  if (req.body.name !== undefined) req.user.name = text(req.body.name, 'Name', 80);
  if (req.body.status !== undefined) req.user.status = String(req.body.status).trim().slice(0, 120);
  if (req.body.avatarUrl !== undefined) req.user.avatarUrl = String(req.body.avatarUrl).trim().slice(0, 1000);
  await req.user.save();
  io.emit('presence:update', asUser(req.user));
  return res.json({ user: asUser(req.user) });
}));

app.post('/api/uploads', auth, (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(503).json({ message: 'Set the Cloudinary environment variables before uploading files.' });
  }
  uploadFile.single('file')(req, res, async (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.message || 'File could not be uploaded.' });
    if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'relay-chat', resource_type: 'auto' }, (uploadError, uploaded) => {
          if (uploadError) reject(uploadError);
          else resolve(uploaded);
        });
        stream.end(req.file.buffer);
      });
      const upload = await Upload.create({
        ownerId: req.user._id, url: result.secure_url, publicId: result.public_id,
        resourceType: result.resource_type, name: req.file.originalname.slice(0, 255),
        mimeType: req.file.mimetype, size: req.file.size,
      });
      return res.status(201).json({ upload: { _id: String(upload._id), url: upload.url, publicId: upload.publicId, resourceType: upload.resourceType, name: upload.name, mimeType: upload.mimeType, size: upload.size } });
    } catch (uploadError) {
      console.error('upload failed', uploadError.message);
      return res.status(502).json({ message: 'Cloud storage could not accept the file.' });
    }
  });
});
app.delete('/api/uploads/:uploadId', auth, async (req, res) => {
  try {
    const upload = await Upload.findOneAndDelete({ _id: req.params.uploadId, ownerId: req.user._id, attachedAt: null });
    if (!upload) return res.status(404).json({ message: 'That pending upload is not available.' });
    await cloudinary.uploader.destroy(upload.publicId, { resource_type: upload.resourceType }).catch(() => null);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ message: 'That upload could not be removed.' });
  }
});

app.get('/api/channels', auth, safeAsync(async (_req, res) => {
  res.json({ channels: await Conversation.find({ type: 'channel' }).sort({ sortOrder: 1, createdAt: 1 }).lean() });
}));
app.post('/api/channels', auth, async (req, res) => {
  try {
    const name = text(req.body.name, 'Channel name', 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!name) return res.status(400).json({ message: 'Choose a channel name with letters or numbers.' });
    if (await Conversation.exists({ type: 'channel', name })) return res.status(409).json({ message: 'A channel with that name already exists.' });
    const channel = await Conversation.create({
      type: 'channel', name, description: String(req.body.description || 'A new space for the team').trim().slice(0, 120),
      icon: 'hash', accent: colors[Math.floor(Math.random() * colors.length)],
      sortOrder: (await Conversation.countDocuments({ type: 'channel' })) + 1,
      createdBy: req.user._id, adminIds: [req.user._id],
    });
    return res.status(201).json({ channel });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'We could not create that channel.' });
  }
});
app.get('/api/conversations', auth, safeAsync(async (req, res) => {
  const conversations = await Conversation.find({ $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).sort({ lastMessageAt: -1 }).lean();
  res.json({ conversations });
}));
app.get('/api/conversations/unread-counts', auth, safeAsync(async (req, res) => {
  const conversations = await Conversation.find({ $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).select('_id');
  const counts = await Message.aggregate([
    { $match: { channelId: { $in: conversations.map((conversation) => conversation._id) }, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null } },
    { $group: { _id: '$channelId', count: { $sum: 1 } } },
  ]);
  return res.json({ counts: Object.fromEntries(counts.map((item) => [String(item._id), item.count])) });
}));
app.post('/api/conversations', auth, async (req, res) => {
  try {
    const type = req.body.type === 'dm' ? 'dm' : 'group';
    const name = type === 'group' ? text(req.body.name, 'Group name', 80) : '';
    const memberIds = [...new Set([String(req.user._id), ...(Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [])])];
    if (type === 'dm' && memberIds.length !== 2) return res.status(400).json({ message: 'A direct message needs exactly one other person.' });
    if (type === 'group' && memberIds.length < 2) return res.status(400).json({ message: 'Add at least one person to the group.' });
    if (!memberIds.every(mongoose.isValidObjectId)) return res.status(400).json({ message: 'One or more members are invalid.' });
    if ((await User.countDocuments({ _id: { $in: memberIds } })) !== memberIds.length) return res.status(400).json({ message: 'One or more members could not be found.' });
    if (type === 'dm') {
      const existing = await Conversation.findOne({ type: 'dm', memberIds: { $all: memberIds, $size: memberIds.length } });
      if (existing) return res.json({ conversation: existing });
    }
    const conversation = await Conversation.create({ type, name, memberIds, adminIds: type === 'group' ? [req.user._id] : [], createdBy: req.user._id });
    return res.status(201).json({ conversation });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'We could not create that conversation.' });
  }
});

app.get('/api/channels/:channelId/messages', auth, async (req, res) => {
  try {
    const conversation = await canAccess(req.params.channelId, req.user._id);
    if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
    const query = { channelId: conversation._id, deletedAt: null };
    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) return res.status(400).json({ message: 'The message cursor is invalid.' });
      const cursor = await Message.findOne({ _id: req.query.before, channelId: conversation._id }).select('createdAt');
      if (cursor) query.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
    }
    const found = await Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
    const more = found.length > limit;
    const page = found.slice(0, limit);
    const messageIds = page.map((message) => message._id);
    const readResult = messageIds.length ? await Message.updateMany(
      { _id: { $in: messageIds }, channelId: conversation._id, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null },
      { $addToSet: { readBy: req.user._id } },
    ) : { modifiedCount: 0 };
    if (readResult.modifiedCount) io.to(room(conversation._id)).emit('receipt:read', {
      conversationId: String(conversation._id), userId: String(req.user._id),
      messageIds: messageIds.map(String), readCount: readResult.modifiedCount, readAt: new Date(),
    });
    const unreadCount = await Message.countDocuments({ channelId: conversation._id, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null });
    return res.json({ messages: page.reverse(), nextCursor: more && page.length ? String(page[page.length - 1]._id) : null, unreadCount });
  } catch {
    return res.status(400).json({ message: 'That conversation is not available.' });
  }
});
app.get('/api/search/messages', auth, async (req, res) => {
  try {
    const queryText = String(req.query.q || '').trim().slice(0, 100);
    if (!queryText) return res.json({ messages: [] });
    const conversations = await Conversation.find({ $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).select('_id name');
    const allowedIds = conversations.map((conversation) => conversation._id);
    const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const messages = await Message.find({
      channelId: { $in: allowedIds },
      body: { $regex: escaped, $options: 'i' },
      deletedAt: null,
    }).sort({ createdAt: -1 }).limit(50).lean();
    const names = new Map(conversations.map((conversation) => [String(conversation._id), conversation.name]));
    return res.json({ messages: messages.map((message) => ({ ...message, conversationName: names.get(String(message.channelId)) || 'Conversation' })) });
  } catch {
    return res.status(400).json({ message: 'Message search is not available right now.' });
  }
});
app.post('/api/channels/:channelId/messages', auth, async (req, res) => {
  try {
    const conversation = await canAccess(req.params.channelId, req.user._id);
    if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
    const message = asMessage(await createMessage(conversation, req.user, req.body.body, req.body.replyToId, req.body.attachments, req.body.clientMessageId));
    io.to(room(conversation._id)).emit('message:new', message);
    return res.status(201).json({ message });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'We could not send that message.' });
  }
});
app.patch('/api/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || String(message.authorId) !== String(req.user._id) || message.deletedAt) return res.status(404).json({ message: 'That message is not available to edit.' });
    const conversation = await canAccess(message.channelId, req.user._id);
    if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
    message.body = text(req.body.body, 'Message', 2000);
    message.editedAt = new Date();
    await message.save();
    const value = asMessage(message);
    io.to(room(conversation._id)).emit('message:updated', value);
    return res.json({ message: value });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'We could not edit that message.' });
  }
});
app.delete('/api/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'That message is not available.' });
    const conversation = await canAccess(message.channelId, req.user._id);
    const admin = conversation && conversation.adminIds.some((id) => String(id) === String(req.user._id));
    if (!conversation || (String(message.authorId) !== String(req.user._id) && !admin)) return res.status(403).json({ message: 'You cannot delete that message.' });
    message.body = '';
    message.deletedAt = new Date();
    await message.save();
    await Promise.all((message.attachments || []).map((file) => cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType || 'image' }).catch(() => null)));
    const value = asMessage(message);
    io.to(room(conversation._id)).emit('message:updated', value);
    return res.json({ message: value });
  } catch {
    return res.status(400).json({ message: 'We could not delete that message.' });
  }
});
app.post('/api/messages/:messageId/reactions', auth, async (req, res) => {
  try {
    const emoji = text(req.body.emoji, 'Reaction', 16);
    const message = await Message.findById(req.params.messageId);
    if (!message || message.deletedAt) return res.status(404).json({ message: 'That message is not available.' });
    const conversation = await canAccess(message.channelId, req.user._id);
    if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
    const hasReaction = message.reactions.some((item) => item.emoji === emoji && String(item.userId) === String(req.user._id));
    message.reactions = message.reactions.filter((item) => !(item.emoji === emoji && String(item.userId) === String(req.user._id)));
    if (!hasReaction) message.reactions.push({ emoji, userId: req.user._id });
    await message.save();
    const value = asMessage(message);
    io.to(room(conversation._id)).emit('message:updated', value);
    return res.json({ message: value });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'We could not update that reaction.' });
  }
});
app.patch('/api/messages/:messageId/pin', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || message.deletedAt) return res.status(404).json({ message: 'That message is not available.' });
    const conversation = await canAccess(message.channelId, req.user._id);
    if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
    message.pinnedAt = message.pinnedAt ? null : new Date();
    await message.save();
    const value = asMessage(message);
    io.to(room(conversation._id)).emit('message:updated', value);
    return res.json({ message: value });
  } catch {
    return res.status(400).json({ message: 'We could not update that pin.' });
  }
});
app.post('/api/conversations/:conversationId/members', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || conversation.type === 'channel') return res.status(404).json({ message: 'That group is not available.' });
    if (!conversation.adminIds.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ message: 'Only group admins can add members.' });
    if (!mongoose.isValidObjectId(req.body.userId) || !await User.exists({ _id: req.body.userId })) return res.status(404).json({ message: 'That person was not found.' });
    await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { memberIds: req.body.userId } });
    const updated = await Conversation.findById(conversation._id).lean();
    io.in(userRoom(req.body.userId)).socketsJoin(room(conversation._id));
    io.to(userRoom(req.body.userId)).emit('conversation:available', updated);
    io.to(room(conversation._id)).emit('conversation:updated', updated);
    return res.json({ conversation: updated });
  } catch {
    return res.status(400).json({ message: 'We could not add that member.' });
  }
});
app.patch('/api/conversations/:conversationId/members/:userId/role', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || conversation.type !== 'group') return res.status(404).json({ message: 'That group is not available.' });
    if (!conversation.adminIds.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ message: 'Only group admins can change roles.' });
    if (!conversation.memberIds.some((id) => String(id) === String(req.params.userId))) return res.status(404).json({ message: 'That person is not a group member.' });
    if (!['admin', 'member'].includes(req.body.role)) return res.status(400).json({ message: 'Choose admin or member.' });
    if (req.body.role === 'member' && conversation.adminIds.length <= 1 && conversation.adminIds.some((id) => String(id) === String(req.params.userId))) {
      return res.status(400).json({ message: 'A group must keep at least one admin.' });
    }
    const update = req.body.role === 'admin'
      ? { $addToSet: { adminIds: req.params.userId } }
      : { $pull: { adminIds: req.params.userId } };
    await Conversation.updateOne({ _id: conversation._id }, update);
    const updated = await Conversation.findById(conversation._id).lean();
    io.to(room(conversation._id)).emit('conversation:updated', updated);
    return res.json({ conversation: updated });
  } catch {
    return res.status(400).json({ message: 'That role could not be changed.' });
  }
});
app.delete('/api/conversations/:conversationId/members/:userId', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || conversation.type === 'channel') return res.status(404).json({ message: 'That group is not available.' });
    const admin = conversation.adminIds.some((id) => String(id) === String(req.user._id));
    if (!admin && String(req.params.userId) !== String(req.user._id)) return res.status(403).json({ message: 'You cannot remove that member.' });
    if (conversation.adminIds.length <= 1 && conversation.adminIds.some((id) => String(id) === String(req.params.userId))) return res.status(400).json({ message: 'A group must keep at least one admin.' });
    await Conversation.updateOne({ _id: conversation._id }, { $pull: { memberIds: req.params.userId, adminIds: req.params.userId } });
    io.in(userRoom(req.params.userId)).socketsLeave(room(conversation._id));
    io.to(userRoom(req.params.userId)).emit('conversation:removed', { conversationId: String(conversation._id) });
    const updated = await Conversation.findById(conversation._id).lean();
    io.to(room(conversation._id)).emit('conversation:updated', updated);
    return res.json({ conversation: updated });
  } catch {
    return res.status(400).json({ message: 'We could not remove that member.' });
  }
});
app.get('/api/people', auth, safeAsync(async (_req, res) => {
  res.json({ people: (await User.find().sort({ name: 1 }).lean()).map(asUser) });
}));
app.get('/api/notifications', auth, safeAsync(async (req, res) => {
  res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean() });
}));
app.patch('/api/notifications/read-all', auth, safeAsync(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
  return res.json({ ok: true });
}));
app.post('/api/invites', auth, safeAsync(async (req, res) => {
  const inviteEmail = email(req.body.email);
  if (!/^\S+@\S+\.\S+$/.test(inviteEmail)) return res.status(400).json({ message: 'Enter a valid email address.' });
  await Invite.create({ email: inviteEmail, invitedBy: req.user._id });
  return res.status(201).json({ message: 'Invitation recorded. Email delivery still needs an email provider.' });
}));

app.use((error, _req, res, _next) => {
  console.error('request failed', error);
  if (!res.headersSent) res.status(500).json({ message: 'The server could not complete that request.' });
});

io.use(async (socket, next) => {
  try {
    const payload = jwt.verify(String(socket.handshake.auth?.token || ''), secret);
    const user = await User.findById(payload.sub);
    if (!user) return next(new Error('Authentication required.'));
    socket.data.user = user;
    return next();
  } catch {
    return next(new Error('Authentication required.'));
  }
});
io.on('connection', async (socket) => {
  const user = socket.data.user;
  const id = String(user._id);
  socket.join(userRoom(id));
  await User.updateOne({ _id: user._id }, { $set: { presence: 'online' } });
  io.emit('presence:update', { ...asUser(user), presence: 'online' });
  socket.on('conversation:join', async (payload = {}, ack = () => {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation) return ack({ ok: false, message: 'That conversation is not available.' });
    await socket.join(room(conversation._id));
    return ack({ ok: true });
  });
  socket.on('conversation:leave', (payload = {}) => {
    if (payload.conversationId) socket.leave(room(payload.conversationId));
  });
  socket.on('message:send', async (payload = {}, ack = () => {}) => {
    try {
      const conversation = await canAccess(payload.conversationId, user._id);
      if (!conversation) return ack({ ok: false, message: 'That conversation is not available.' });
      const message = asMessage(await createMessage(conversation, user, payload.body, payload.replyToId, payload.attachments, payload.clientMessageId));
      io.to(room(conversation._id)).emit('message:new', message);
      return ack({ ok: true, message });
    } catch (error) {
      return ack({ ok: false, message: error.message || 'Message could not be sent.' });
    }
  });
  socket.on('message:typing', async (payload = {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation || !socket.rooms.has(room(conversation._id))) return;
    socket.to(room(conversation._id)).emit('user:typing', { conversationId: String(conversation._id), user: asUser(user), active: Boolean(payload.active) });
  });
  socket.on('message:read', async (payload = {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation) return;
    const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds.slice(0, 100).filter(mongoose.isValidObjectId) : [];
    if (!messageIds.length) return;
    const result = await Message.updateMany(
      { _id: { $in: messageIds }, channelId: conversation._id, authorId: { $ne: user._id }, readBy: { $ne: user._id }, deletedAt: null },
      { $addToSet: { readBy: user._id } },
    );
    io.to(room(conversation._id)).emit('receipt:read', {
      conversationId: String(conversation._id), userId: id,
      messageIds: messageIds.map(String), readCount: result.modifiedCount, readAt: new Date(),
    });
  });
  socket.on('disconnect', async () => {
    if ((await io.in(userRoom(id)).allSockets()).size) return;
    const lastSeenAt = new Date();
    await User.updateOne({ _id: user._id }, { $set: { presence: 'offline', lastSeenAt } });
    io.emit('presence:update', { ...asUser(user), presence: 'offline', lastSeenAt });
  });
});

const seed = async () => {
  if (await Conversation.countDocuments({ type: 'channel' })) return;
  await Conversation.insertMany([
    { name: 'general', description: 'A shared space for company-wide updates', icon: 'sparkles', accent: '#f2a65a', sortOrder: 1, type: 'channel' },
    { name: 'design-lab', description: 'Share explorations, references, and feedback', icon: 'palette', accent: '#d87cac', sortOrder: 2, type: 'channel' },
    { name: 'build-room', description: 'Ship notes, decisions, and daily momentum', icon: 'terminal', accent: '#6c9aeb', sortOrder: 3, type: 'channel' },
  ]);
};
const start = async () => {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  await Conversation.updateMany({ type: { $exists: false } }, { $set: { type: 'channel' } });
  await User.updateMany({ presence: 'online' }, { $set: { presence: 'offline', lastSeenAt: new Date() } });
  await seed();
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
