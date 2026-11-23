import mongoose from 'mongoose';

const { Schema, model } = mongoose;

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

export const Message = model('Message', messageSchema);
