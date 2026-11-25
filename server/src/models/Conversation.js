import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const conversationSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

export const Conversation = model('Conversation', conversationSchema);
