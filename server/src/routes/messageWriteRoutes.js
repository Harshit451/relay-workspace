export function registerRoutes(router, dependencies) {
  const { mongoose, Message, auth, canAccess, createMessage, asMessage, room, io, cloudinary, text } = dependencies;
  router.post('/api/channels/:channelId/messages', auth, async (req, res) => {
    try {
      const conversation = await canAccess(req.params.channelId, req.user._id);
      if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
      const message = asMessage(await createMessage(conversation, req.user, req.body.body, req.body.replyToId, req.body.attachments, req.body.clientMessageId));
      io.to(room(conversation._id)).emit('message:new', message);
      return res.status(201).json({ message });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'We could not send that message.' });
    }
  });
  router.patch('/api/messages/:messageId', auth, async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
      if (!message || String(message.authorId) !== String(req.user._id) || message.deletedAt) return res.status(404).json({ message: 'That message is not available to edit.' });
      const conversation = await canAccess(message.channelId, req.user._id);
      if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
      message.body = text(req.body.body, 'Message', 2000);
      message.editedAt = new Date();
      await message.save();
      const value = asMessage(message);
      io.to(room(conversation._id)).emit('message:updated', value);
      return res.json({ message: value });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'We could not edit that message.' });
    }
  });
  router.delete('/api/messages/:messageId', auth, async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
      if (!message) return res.status(404).json({ message: 'That message is not available.' });
      const conversation = await canAccess(message.channelId, req.user._id);
      const admin = conversation && conversation.adminIds.some((id) => String(id) === String(req.user._id));
      if (!conversation || (String(message.authorId) !== String(req.user._id) && !admin)) return res.status(403).json({ message: 'You cannot delete that message.' });
      message.body = '';
      message.deletedAt = new Date();
      await message.save();
      await Promise.all((message.attachments || []).map((file) => cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType || 'image' }).catch(() => null)));
      const value = asMessage(message);
      io.to(room(conversation._id)).emit('message:updated', value);
      return res.json({ message: value });
    } catch {
      return res.status(400).json({ message: 'We could not delete that message.' });
    }
  });
  router.post('/api/messages/:messageId/reactions', auth, async (req, res) => {
    try {
      const emoji = text(req.body.emoji, 'Reaction', 16);
      const message = await Message.findById(req.params.messageId);
      if (!message || message.deletedAt) return res.status(404).json({ message: 'That message is not available.' });
      const conversation = await canAccess(message.channelId, req.user._id);
      if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
      const hasReaction = message.reactions.some((item) => item.emoji === emoji && String(item.userId) === String(req.user._id));
      message.reactions = message.reactions.filter((item) => !(item.emoji === emoji && String(item.userId) === String(req.user._id)));
      if (!hasReaction) message.reactions.push({ emoji, userId: req.user._id });
      await message.save();
      const value = asMessage(message);
      io.to(room(conversation._id)).emit('message:updated', value);
      return res.json({ message: value });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'We could not update that reaction.' });
    }
  });
  router.patch('/api/messages/:messageId/pin', auth, async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
      if (!message || message.deletedAt) return res.status(404).json({ message: 'That message is not available.' });
      const conversation = await canAccess(message.channelId, req.user._id);
      if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
      message.pinnedAt = message.pinnedAt ? null : new Date();
      await message.save();
      const value = asMessage(message);
      io.to(room(conversation._id)).emit('message:updated', value);
      return res.json({ message: value });
    } catch {
      return res.status(400).json({ message: 'We could not update that pin.' });
    }
  });
}
