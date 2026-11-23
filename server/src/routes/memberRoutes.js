export function registerRoutes(router, dependencies) {
  const { mongoose, Conversation, User, auth, room, userRoom, io } = dependencies;
  router.post('/api/conversations/:conversationId/members', auth, async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.conversationId);
      if (!conversation || conversation.type === 'channel') return res.status(404).json({ message: 'That group is not available.' });
      if (!conversation.adminIds.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ message: 'Only group admins can add members.' });
      if (!mongoose.isValidObjectId(req.body.userId) || !await User.exists({ _id: req.body.userId })) return res.status(404).json({ message: 'That person was not found.' });
      await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { memberIds: req.body.userId } });
      const updated = await Conversation.findById(conversation._id).lean();
      io.in(userRoom(req.body.userId)).socketsJoin(room(conversation._id));
      io.to(userRoom(req.body.userId)).emit('conversation:available', updated);
      io.to(room(conversation._id)).emit('conversation:updated', updated);
      return res.json({ conversation: updated });
    } catch {
      return res.status(400).json({ message: 'We could not add that member.' });
    }
  });
  router.patch('/api/conversations/:conversationId/members/:userId/role', auth, async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.conversationId);
      if (!conversation || conversation.type !== 'group') return res.status(404).json({ message: 'That group is not available.' });
      if (!conversation.adminIds.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ message: 'Only group admins can change roles.' });
      if (!conversation.memberIds.some((id) => String(id) === String(req.params.userId))) return res.status(404).json({ message: 'That person is not a group member.' });
      if (!['admin', 'member'].includes(req.body.role)) return res.status(400).json({ message: 'Choose admin or member.' });
      if (req.body.role === 'member' && conversation.adminIds.length <= 1 && conversation.adminIds.some((id) => String(id) === String(req.params.userId))) {
        return res.status(400).json({ message: 'A group must keep at least one admin.' });
      }
      const update = req.body.role === 'admin'
        ? { $addToSet: { adminIds: req.params.userId } }
        : { $pull: { adminIds: req.params.userId } };
      await Conversation.updateOne({ _id: conversation._id }, update);
      const updated = await Conversation.findById(conversation._id).lean();
      io.to(room(conversation._id)).emit('conversation:updated', updated);
      return res.json({ conversation: updated });
    } catch {
      return res.status(400).json({ message: 'That role could not be changed.' });
    }
  });
  router.delete('/api/conversations/:conversationId/members/:userId', auth, async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.conversationId);
      if (!conversation || conversation.type === 'channel') return res.status(404).json({ message: 'That group is not available.' });
      const admin = conversation.adminIds.some((id) => String(id) === String(req.user._id));
      if (!admin && String(req.params.userId) !== String(req.user._id)) return res.status(403).json({ message: 'You cannot remove that member.' });
      if (conversation.adminIds.length <= 1 && conversation.adminIds.some((id) => String(id) === String(req.params.userId))) return res.status(400).json({ message: 'A group must keep at least one admin.' });
      await Conversation.updateOne({ _id: conversation._id }, { $pull: { memberIds: req.params.userId, adminIds: req.params.userId } });
      io.in(userRoom(req.params.userId)).socketsLeave(room(conversation._id));
      io.to(userRoom(req.params.userId)).emit('conversation:removed', { conversationId: String(conversation._id) });
      const updated = await Conversation.findById(conversation._id).lean();
      io.to(room(conversation._id)).emit('conversation:updated', updated);
      return res.json({ conversation: updated });
    } catch {
      return res.status(400).json({ message: 'We could not remove that member.' });
    }
  });
}
