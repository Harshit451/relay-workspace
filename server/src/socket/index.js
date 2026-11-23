export function registerSocketHandlers({ io, jwt, secret, User, asUser, userRoom, room, canAccess, createMessage, asMessage, mongoose, Message }) {
io.use(async (socket, next) => {
  try {
    const payload = jwt.verify(String(socket.handshake.auth?.token || ''), secret);
    const user = await User.findById(payload.sub);
    if (!user) return next(new Error('Authentication required.'));
    socket.data.user = user;
    return next();
  } catch {
    return next(new Error('Authentication required.'));
  }
});
io.on('connection', async (socket) => {
  const user = socket.data.user;
  const id = String(user._id);
  socket.join(userRoom(id));
  await User.updateOne({ _id: user._id }, { $set: { presence: 'online' } });
  io.emit('presence:update', { ...asUser(user), presence: 'online' });
  socket.on('conversation:join', async (payload = {}, ack = () => {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation) return ack({ ok: false, message: 'That conversation is not available.' });
    await socket.join(room(conversation._id));
    return ack({ ok: true });
  });
  socket.on('conversation:leave', (payload = {}) => {
    if (payload.conversationId) socket.leave(room(payload.conversationId));
  });
  socket.on('message:send', async (payload = {}, ack = () => {}) => {
    try {
      const conversation = await canAccess(payload.conversationId, user._id);
      if (!conversation) return ack({ ok: false, message: 'That conversation is not available.' });
      const message = asMessage(await createMessage(conversation, user, payload.body, payload.replyToId, payload.attachments, payload.clientMessageId));
      io.to(room(conversation._id)).emit('message:new', message);
      return ack({ ok: true, message });
    } catch (error) {
      return ack({ ok: false, message: error.message || 'Message could not be sent.' });
    }
  });
  socket.on('message:typing', async (payload = {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation || !socket.rooms.has(room(conversation._id))) return;
    socket.to(room(conversation._id)).emit('user:typing', { conversationId: String(conversation._id), user: asUser(user), active: Boolean(payload.active) });
  });
  socket.on('message:read', async (payload = {}) => {
    const conversation = await canAccess(payload.conversationId, user._id);
    if (!conversation) return;
    const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds.slice(0, 100).filter(mongoose.isValidObjectId) : [];
    if (!messageIds.length) return;
    const result = await Message.updateMany(
      { _id: { $in: messageIds }, channelId: conversation._id, authorId: { $ne: user._id }, readBy: { $ne: user._id }, deletedAt: null },
      { $addToSet: { readBy: user._id } },
    );
    io.to(room(conversation._id)).emit('receipt:read', {
      conversationId: String(conversation._id), userId: id,
      messageIds: messageIds.map(String), readCount: result.modifiedCount, readAt: new Date(),
    });
  });
  socket.on('disconnect', async () => {
    if ((await io.in(userRoom(id)).allSockets()).size) return;
    const lastSeenAt = new Date();
    await User.updateOne({ _id: user._id }, { $set: { presence: 'offline', lastSeenAt } });
    io.emit('presence:update', { ...asUser(user), presence: 'offline', lastSeenAt });
  });
});


}
