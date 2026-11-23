import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, maxlength: 120, default: 'Workspace update' },
  body: { type: String, maxlength: 500, default: '' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export const Notification = model('Notification', notificationSchema);
