import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  workspaceName: { type: String, required: true, trim: true, maxlength: 80, default: 'My workspace' },
  workspaceInviteCode: { type: String, unique: true, sparse: true, default: () => randomBytes(5).toString('hex').toUpperCase() },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  workspaceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true }],
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  initials: { type: String, required: true, maxlength: 4 },
  avatarColor: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  status: { type: String, default: 'Available', maxlength: 120 },
  presence: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = model('User', userSchema);
