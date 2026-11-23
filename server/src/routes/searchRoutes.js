export function registerRoutes(router, dependencies) {
  const { Conversation, Message, auth } = dependencies;
  router.get('/api/search/messages', auth, async (req, res) => {
    try {
      const queryText = String(req.query.q || '').trim().slice(0, 100);
      if (!queryText) return res.json({ messages: [] });
      const conversations = await Conversation.find({ $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).select('_id name');
      const allowedIds = conversations.map((conversation) => conversation._id);
      const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const messages = await Message.find({
        channelId: { $in: allowedIds },
        body: { $regex: escaped, $options: 'i' },
        deletedAt: null,
      }).sort({ createdAt: -1 }).limit(50).lean();
      const names = new Map(conversations.map((conversation) => [String(conversation._id), conversation.name]));
      return res.json({ messages: messages.map((message) => ({ ...message, conversationName: names.get(String(message.channelId)) || 'Conversation' })) });
    } catch {
      return res.status(400).json({ message: 'Message search is not available right now.' });
    }
  });
}
