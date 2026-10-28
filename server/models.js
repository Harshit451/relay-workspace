import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  initials: { type: String, required: true, maxlength: 4 },
  avatarColor: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  status: { type: String, default: 'Available', maxlength: 120 },
  presence: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

const conversationSchema = new Schema({
  type: { type: String, enum: ['channel', 'dm', 'group'], default: 'channel', index: true },
  name: { type: String, trim: true, maxlength: 80, default: '' },
  description: { type: String, trim: true, maxlength: 120, default: '' },
  icon: { type: String, default: 'sparkles' },
  accent: { type: String, default: '#6c9aeb' },
  memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  adminIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  sortOrder: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true, collection: 'channels' });

conversationSchema.index({ memberIds: 1, lastMessageAt: -1 });

const messageSchema = new Schema({
  channelId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorInitials: { type: String, required: true },
  avatarColor: { type: String, required: true },
  body: { type: String, default: '', trim: true, maxlength: 2000 },
  clientMessageId: { type: String, maxlength: 100 },
  attachments: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload', default: null },
    resourceType: { type: String, default: 'image' },
    name: { type: String, maxlength: 255, default: '' },
    mimeType: { type: String, maxlength: 120, default: '' },
    size: { type: Number, min: 0, default: 0 },
  }],
  replyToId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  reactions: [{ emoji: { type: String, maxlength: 16 }, userId: { type: Schema.Types.ObjectId, ref: 'User' } }],
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pinnedAt: { type: Date, default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ channelId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ channelId: 1, authorId: 1, clientMessageId: 1 }, { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } });

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, maxlength: 120, default: 'Workspace update' },
  body: { type: String, maxlength: 500, default: '' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

const inviteSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const uploadSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, required: true },
  name: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true, min: 0 },
  attachedAt: { type: Date, default: null },
}, { timestamps: true });

export const User = model('User', userSchema);
export const Conversation = model('Conversation', conversationSchema);
export const Message = model('Message', messageSchema);
export const Notification = model('Notification', notificationSchema);
export const Invite = model('Invite', inviteSchema);
export const Upload = model('Upload', uploadSchema);
