import mongoose from 'mongoose';

const { Schema, model } = mongoose;

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

export const Upload = model('Upload', uploadSchema);
