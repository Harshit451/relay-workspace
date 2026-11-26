export function registerRoutes(router, dependencies) {
  const { mongoose, User, Conversation, Message, Notification, Invite, auth, safeAsync, text, email, asUser, room, userRoom, io, colors } = dependencies;
  router.get('/api/channels', auth, safeAsync(async (_req, res) => {
    res.json({ channels: await Conversation.find({ workspaceId: _req.user.workspaceId, type: 'channel' }).sort({ sortOrder: 1, createdAt: 1 }).lean() });
  }));
  router.post('/api/channels', auth, async (req, res) => {
    try {
      const name = text(req.body.name, 'Channel name', 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      if (!name) return res.status(400).json({ message: 'Choose a channel name with letters or numbers.' });
      if (await Conversation.exists({ workspaceId: req.user.workspaceId, type: 'channel', name })) return res.status(409).json({ message: 'A channel with that name already exists.' });
      const channel = await Conversation.create({
        workspaceId: req.user.workspaceId, type: 'channel', name, description: String(req.body.description || 'A new space for the team').trim().slice(0, 120),
        icon: 'hash', accent: colors[Math.floor(Math.random() * colors.length)],
        sortOrder: (await Conversation.countDocuments({ workspaceId: req.user.workspaceId, type: 'channel' })) + 1,
        createdBy: req.user._id, adminIds: [req.user._id],
      });
      return res.status(201).json({ channel });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'We could not create that channel.' });
    }
  });
  router.get('/api/conversations', auth, safeAsync(async (req, res) => {
    const conversations = await Conversation.find({ workspaceId: req.user.workspaceId, $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).sort({ lastMessageAt: -1 }).lean();
    res.json({ conversations });
  }));
  router.get('/api/conversations/unread-counts', auth, safeAsync(async (req, res) => {
    const conversations = await Conversation.find({ workspaceId: req.user.workspaceId, $or: [{ type: 'channel' }, { memberIds: req.user._id }] }).select('_id');
    const counts = await Message.aggregate([
      { $match: { channelId: { $in: conversations.map((conversation) => conversation._id) }, authorId: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null } },
      { $group: { _id: '$channelId', count: { $sum: 1 } } },
    ]);
    return res.json({ counts: Object.fromEntries(counts.map((item) => [String(item._id), item.count])) });
  }));
  router.post('/api/conversations', auth, async (req, res) => {
    try {
      const type = req.body.type === 'dm' ? 'dm' : 'group';
      const name = type === 'group' ? text(req.body.name, 'Group name', 80) : '';
      const memberIds = [...new Set([String(req.user._id), ...(Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [])])];
      if (type === 'dm' && memberIds.length !== 2) return res.status(400).json({ message: 'A direct message needs exactly one other person.' });
      if (type === 'group' && memberIds.length < 2) return res.status(400).json({ message: 'Add at least one person to the group.' });
      if (!memberIds.every(mongoose.isValidObjectId)) return res.status(400).json({ message: 'One or more members are invalid.' });
      if ((await User.countDocuments({ _id: { $in: memberIds }, $or: [{ workspaceIds: req.user.workspaceId }, { workspaceId: req.user.workspaceId }] })) !== memberIds.length) return res.status(400).json({ message: 'Choose people who belong to your workspace.' });
      if (type === 'dm') {
        const existing = await Conversation.findOne({ workspaceId: req.user.workspaceId, type: 'dm', memberIds: { $all: memberIds, $size: memberIds.length } });
        if (existing) return res.json({ conversation: existing });
      }
      const conversation = await Conversation.create({ workspaceId: req.user.workspaceId, type, name, memberIds, adminIds: type === 'group' ? [req.user._id] : [], createdBy: req.user._id });
      for (const memberId of memberIds) {
        const sockets = await io.in(userRoom(memberId)).fetchSockets();
        for (const socket of sockets) if (String(socket.data.workspaceId) === String(conversation.workspaceId)) await socket.join(room(conversation._id));
        io.to(userRoom(memberId)).emit('conversation:new', conversation);
      }
      return res.status(201).json({ conversation });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'We could not create that conversation.' });
    }
  });
}
