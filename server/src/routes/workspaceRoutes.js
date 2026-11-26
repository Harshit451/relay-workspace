export function registerRoutes(router, dependencies) {
  const { User, Workspace, Conversation, Notification, Invite, auth, safeAsync, email, asUser, seedStarterChannels, io, workspaceRoom } = dependencies;
  router.get('/api/people', auth, safeAsync(async (req, res) => {
    const people = await User.find({ workspaceId: req.user.workspaceId }).sort({ name: 1 }).lean();
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
    const populated = await Workspace.findById(workspace._id).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
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
      if (workspace.members.some((member) => String(member.userId) === String(targetUser._id))) return res.status(409).json({ message: 'They are already in this workspace.' });
      workspace.members.push({ userId: targetUser._id, role: 'member' });
      await workspace.save();
      targetUser.workspaceId = req.user.workspaceId;
      targetUser.workspaceName = workspace.name;
      await targetUser.save();
      await Notification.deleteMany({ userId: targetUser._id });
      await seedStarterChannels(Conversation, req.user.workspaceId);
      await Conversation.updateMany({ workspaceId: req.user.workspaceId, type: 'channel', name: { $in: ['general', 'design-lab', 'build-room'] } }, { $addToSet: { memberIds: targetUser._id } });
      const dmMembers = [String(req.user._id), String(targetUser._id)].sort();
      await Conversation.updateOne(
        { workspaceId: req.user.workspaceId, type: 'dm', memberIds: { $all: dmMembers, $size: dmMembers.length } },
        { $setOnInsert: { workspaceId: req.user.workspaceId, type: 'dm', memberIds: dmMembers, createdBy: req.user._id } },
        { upsert: true },
      );
      const person = asUser(targetUser);
      io.to(workspaceRoom(req.user.workspaceId)).emit('presence:update', person);
      io.to('user:' + String(targetUser._id)).emit('workspace:changed', person);
      const members = await Workspace.findById(workspace._id).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
      return res.status(200).json({ message: 'Teammate added to workspace', status: 'added', person, members: members.members });
    }
    await Invite.create({ email: inviteEmail, invitedBy: req.user._id, workspaceId: req.user.workspaceId });
    return res.status(201).json({ message: 'Invitation sent — they can accept it in their Workspace menu', status: 'pending' });
  }));
  router.post('/api/workspaces/join', auth, safeAsync(async (req, res) => {
    const code = String(req.body.code ?? req.body.inviteCode ?? '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Enter an invite code.' });
    let workspace = await Workspace.findOne({ inviteCode: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (!workspace) return res.status(404).json({ message: 'That invite code was not found.' });
    if (workspace.members.some((member) => String(member.userId) === String(req.user._id))) return res.status(409).json({ message: 'You are already in this workspace.' });
    workspace.members.push({ userId: req.user._id, role: 'member' });
    await workspace.save();
    req.user.workspaceId = workspace._id;
    req.user.workspaceName = workspace.name;
    await req.user.save();
    await Notification.deleteMany({ userId: req.user._id });
    await seedStarterChannels(Conversation, req.user.workspaceId);
    await Conversation.updateMany({ workspaceId: req.user.workspaceId, type: 'channel', name: { $in: ['general', 'design-lab', 'build-room'] } }, { $addToSet: { memberIds: req.user._id } });
    const populated = await Workspace.findById(workspace._id).populate('members.userId', 'name email initials avatarColor avatarUrl status presence lastSeenAt').lean();
    return res.json({ message: 'Joined workspace', user: asUser(req.user), workspace: populated, workspaces: [populated] });
  }));
}
