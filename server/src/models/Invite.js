import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const inviteSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Invite = model('Invite', inviteSchema);
