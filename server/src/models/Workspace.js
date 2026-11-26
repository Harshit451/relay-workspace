import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

const { Schema, model } = mongoose;
const workspaceMemberSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
}, { _id: false });
const workspaceSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  inviteCode: { type: String, required: true, unique: true, default: () => randomBytes(6).toString('hex').toUpperCase() },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [workspaceMemberSchema],
}, { timestamps: true });
workspaceSchema.index({ 'members.userId': 1 });
export const Workspace = model('Workspace', workspaceSchema);
