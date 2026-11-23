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

export const User = model('User', userSchema);
