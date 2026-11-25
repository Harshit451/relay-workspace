import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const inviteSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true });

export const Invite = model('Invite', inviteSchema);
