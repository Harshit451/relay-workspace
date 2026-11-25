export function registerRoutes(router, dependencies) {
  const { mongoose, Message, auth, canAccess, room, io } = dependencies;
  router.get('/api/channels/:channelId/messages', auth, async (req, res) => {
    try {
      const conversation = await canAccess(req.params.channelId, req.user._id, req.user.workspaceId);
      if (!conversation) return res.status(404).json({ message: 'That conversation is not available.' });
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
      const query = { channelId: conversation._id, deletedAt: null };
      if (req.query.before) {
        if (!mongoose.isValidObjectId(req.query.before)) return res.status(400).json({ message: 'The message cursor is invalid.' });
        const cursor = await Message.findOne({ _id: req.query.before, channelId: conversation._id }).select('createdAt');
        if (cursor) query.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
      }
      const found = await Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
      const more = found.length > limit;
      const page = found.slice(0, limit);
      const messageIds = page.map((message) => message._id);
      const readResult = messageIds.length ? await Message.updateMany(
        { _id: { $in: messageIds }, channelId: conversation._id, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null },
        { $addToSet: { readBy: req.user._id } },
      ) : { modifiedCount: 0 };
      if (readResult.modifiedCount) io.to(room(conversation._id)).emit('receipt:read', {
        conversationId: String(conversation._id), userId: String(req.user._id),
        messageIds: messageIds.map(String), readCount: readResult.modifiedCount, readAt: new Date(),
      });
      const unreadCount = await Message.countDocuments({ channelId: conversation._id, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null });
      return res.json({ messages: page.reverse(), nextCursor: more && page.length ? String(page[page.length - 1]._id) : null, unreadCount });
    } catch {
      return res.status(400).json({ message: 'That conversation is not available.' });
    }
  });
}
