export function registerRoutes(router, dependencies) {
  const { User, Workspace, Conversation, Notification, Invite, auth, safeAsync, email, asUser, seedStarterChannels, io, workspaceRoom, userRoom } = dependencies;
  const populatedWorkspace = (id) => Workspace.findById(id).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
  const emitWorkspaceUpdated = async (workspace) => {
    const populated = await populatedWorkspace(workspace._id);
    for (const member of workspace.members) io.to(userRoom(member.userId)).emit('workspace:updated', { workspace: populated });
    return populated;
  };
  const emitConversationToMembers = async (conversation) => {
    const payload = conversation.toObject ? conversation.toObject() : conversation;
    for (const memberId of conversation.memberIds) {
      const sockets = await io.in(userRoom(memberId)).fetchSockets();
      for (const socket of sockets) if (String(socket.data.workspaceId) === String(conversation.workspaceId)) await socket.join('conversation:' + String(conversation._id));
      io.to(userRoom(memberId)).emit('conversation:new', payload);
    }
  };
  router.get('/api/workspaces', auth, safeAsync(async (req, res) => {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).sort({ createdAt: 1, _id: 1 }).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
    res.json({ workspaces });
  }));
  router.get('/api/people', auth, safeAsync(async (req, res) => {
    const people = await User.find({ $or: [{ workspaceIds: req.user.workspaceId }, { workspaceId: req.user.workspaceId }] }).sort({ name: 1 }).lean();
    res.json({ people: people.map(asUser) });
  }));
  router.get('/api/notifications', auth, safeAsync(async (req, res) => {
    res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean() });
  }));
  router.get('/api/workspaces/current', auth, safeAsync(async (req, res) => {
    let workspace = await Workspace.findById(req.user.workspaceId);
    if (!workspace) {
      const members = await User.find({ workspaceId: req.user.workspaceId }).select('_id').lean();
      workspace = await Workspace.create({ _id: req.user.workspaceId, name: req.user.workspaceName || 'My workspace', createdBy: req.user.workspaceId, members: members.map(({ _id }) => ({ userId: _id, role: String(_id) === String(req.user.workspaceId) ? 'owner' : 'member' })) });
    }
    if (!workspace.inviteCode?.trim()) {
      workspace.inviteCode = Math.random().toString(36).slice(2, 12).toUpperCase();
      await workspace.save();
    }
    const populated = await populatedWorkspace(workspace._id);
    res.json({ workspace: populated });
  }));
  router.patch('/api/notifications/read-all', auth, safeAsync(async (req, res) => {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.json({ ok: true });
  }));
  router.post('/api/invites', auth, safeAsync(async (req, res) => {
    const inviteEmail = email(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(inviteEmail)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (inviteEmail === req.user.email) return res.status(400).json({ message: 'You are already in this workspace.' });
    const targetUser = await User.findOne({ email: inviteEmail });
    if (targetUser) {
      const workspace = await Workspace.findById(req.user.workspaceId);
      if (!workspace) return res.status(404).json({ message: 'Workspace not found.' });
      if (workspace.members.some((member) => String(member.userId?._id || member.userId) === String(targetUser._id))) return res.status(409).json({ message: 'They are already in this workspace.' });
      workspace.members.push({ userId: targetUser._id, role: 'member' });
      await workspace.save();
      await User.updateOne({ _id: targetUser._id }, { $addToSet: { workspaceIds: workspace._id } });
      await seedStarterChannels(Conversation, req.user.workspaceId);
      await Conversation.updateMany({ workspaceId: req.user.workspaceId, type: 'channel', name: { $in: ['general', 'design-lab', 'build-room'] } }, { $addToSet: { memberIds: targetUser._id } });
      const dmMembers = [String(req.user._id), String(targetUser._id)].sort();
      let dm = await Conversation.findOne({ workspaceId: req.user.workspaceId, type: 'dm', memberIds: { $all: dmMembers, $size: dmMembers.length } });
      if (!dm) dm = await Conversation.create({ workspaceId: req.user.workspaceId, type: 'dm', memberIds: dmMembers, createdBy: req.user._id });
      const person = asUser(targetUser);
      if (dm) await emitConversationToMembers(dm);
      const populated = await emitWorkspaceUpdated(workspace);
      io.to(workspaceRoom(req.user.workspaceId)).emit('presence:update', person);
      return res.status(200).json({ message: 'Teammate added to workspace', status: 'added', person, workspace: populated, members: populated.members });
    }
    await Invite.create({ email: inviteEmail, invitedBy: req.user._id, workspaceId: req.user.workspaceId });
    return res.status(201).json({ message: 'Invitation sent — they can accept it in their Workspace menu', status: 'pending' });
  }));
  router.post('/api/workspaces/join', auth, safeAsync(async (req, res) => {
    const code = String(req.body.code ?? req.body.inviteCode ?? '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Enter an invite code.' });
    let workspace = await Workspace.findOne({ inviteCode: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (!workspace) return res.status(404).json({ message: 'That invite code was not found.' });
    if (workspace.members.some((member) => String(member.userId?._id || member.userId) === String(req.user._id))) return res.status(409).json({ message: 'You are already in this workspace.' });
    workspace.members.push({ userId: req.user._id, role: 'member' });
    await workspace.save();
    await User.updateOne({ _id: req.user._id }, { $addToSet: { workspaceIds: workspace._id } });
    await seedStarterChannels(Conversation, workspace._id);
    await Conversation.updateMany({ workspaceId: workspace._id, type: 'channel', name: { $in: ['general', 'design-lab', 'build-room'] } }, { $addToSet: { memberIds: req.user._id } });
    const populated = await emitWorkspaceUpdated(workspace);
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).sort({ createdAt: 1, _id: 1 }).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
    return res.json({ message: 'Joined workspace', user: asUser(req.user), workspace: populated, workspaces });
  }));
}
