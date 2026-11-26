export const createMessageController = ({ mongoose, Message, Upload, User, Notification, io, userRoom }) => async (conversation, user, body, replyToId = null, attachmentIds = [], clientMessageId = '') => {
  const clientId = String(clientMessageId || '').slice(0, 100);
  if (clientId) {
    const previous = await Message.findOne({ channelId: conversation._id, authorId: user._id, clientMessageId: clientId });
    if (previous) return previous;
  }
  if (replyToId) {
    if (!mongoose.isValidObjectId(replyToId) || !await Message.exists({ _id: replyToId, channelId: conversation._id, deletedAt: null })) {
      throw new Error('The reply target is not available in this conversation.');
    }
  }
  const uploads = [];
  if (Array.isArray(attachmentIds) && attachmentIds.length) {
    if (attachmentIds.length > 5 || !attachmentIds.every(mongoose.isValidObjectId)) throw new Error('Choose up to five valid attachments.');
    const owned = await Upload.find({ _id: { $in: attachmentIds }, ownerId: user._id, attachedAt: null });
    if (owned.length !== attachmentIds.length) throw new Error('One or more attachments are no longer available.');
    uploads.push(...owned.map((item) => ({ uploadId: item._id, url: item.url, publicId: item.publicId, resourceType: item.resourceType, name: item.name, mimeType: item.mimeType, size: item.size })));
  }
  const messageBody = String(body || '').trim();
  if (messageBody.length > 2000) throw new Error('Message is too long.');
  if (!messageBody && !uploads.length) throw new Error('Add a message or an attachment.');
  let message;
  try {
    message = await Message.create({
      channelId: conversation._id, authorId: user._id, authorName: user.name,
      authorInitials: user.initials, avatarColor: user.avatarColor,
      body: messageBody, attachments: uploads, ...(clientId ? { clientMessageId: clientId } : {}),
      replyToId: replyToId || null, readBy: [user._id],
    });
  } catch (error) {
    if (error.code === 11000 && clientId) {
      const existing = await Message.findOne({ channelId: conversation._id, authorId: user._id, clientMessageId: clientId });
      if (existing) return existing;
    }
    throw error;
  }
  if (uploads.length) await Upload.updateMany({ _id: { $in: attachmentIds } }, { $set: { attachedAt: message.createdAt } });
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  const recipients = new Map();
  if (conversation.type !== 'channel') {
    const awayMembers = await User.find({ _id: { $in: conversation.memberIds, $ne: user._id }, $or: [{ workspaceIds: conversation.workspaceId }, { workspaceId: conversation.workspaceId }], presence: { $ne: 'online' } }).select('_id');
    for (const member of awayMembers) recipients.set(String(member._id), { userId: member._id, title: 'New message from ' + user.name });
  }
  const mentionedEmails = [...String(body).matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((match) => match[1].toLowerCase());
  if (mentionedEmails.length) {
    const mentioned = await User.find({ email: { $in: mentionedEmails }, _id: { $ne: user._id }, $or: [{ workspaceIds: conversation.workspaceId }, { workspaceId: conversation.workspaceId }] }).select('_id');
    for (const member of mentioned) recipients.set(String(member._id), { userId: member._id, title: 'You were mentioned by ' + user.name });
  }
  if (recipients.size) {
    const createdNotifications = await Notification.insertMany([...recipients.values()].map((item) => ({ ...item, body: String(body).slice(0, 500) })));
    for (const notification of createdNotifications) io.to(userRoom(notification.userId)).emit('notification:new', notification);
  }
  return message;
};
