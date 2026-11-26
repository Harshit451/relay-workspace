export function registerRoutes(router, dependencies) {
  const { User, Conversation, Notification, Invite, auth, safeAsync, email, asUser, seedStarterChannels, io, workspaceRoom } = dependencies;
  router.get('/api/people', auth, safeAsync(async (req, res) => {
    const people = await User.find({ workspaceId: req.user.workspaceId }).sort({ name: 1 }).lean();
    res.json({ people: people.map(asUser) });
  }));
  router.get('/api/notifications', auth, safeAsync(async (req, res) => {
    res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean() });
  }));
  router.get('/api/workspaces/current', auth, safeAsync(async (req, res) => {
    const owner = await User.findById(req.user.workspaceId);
    if (!owner) return res.status(404).json({ message: 'Workspace not found.' });
    if (!owner.workspaceInviteCode) {
      owner.workspaceInviteCode = Math.random().toString(36).slice(2, 12).toUpperCase();
      await owner.save();
    }
    res.json({ workspace: { id: String(req.user.workspaceId), name: req.user.workspaceName, inviteCode: owner.workspaceInviteCode } });
  }));
  router.patch('/api/notifications/read-all', auth, safeAsync(async (req, res) => {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.json({ ok: true });
  }));
  router.post('/api/invites', auth, safeAsync(async (req, res) => {
    const inviteEmail = email(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(inviteEmail)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (inviteEmail === req.user.email) return res.status(400).json({ message: 'You are already in this workspace.' });
    const existing = await User.findOne({ email: inviteEmail });
    if (existing) {
      if (String(existing.workspaceId) === String(req.user.workspaceId)) return res.status(409).json({ message: 'They are already in this workspace.' });
      existing.workspaceId = req.user.workspaceId;
      existing.workspaceName = req.user.workspaceName;
      await existing.save();
      await Notification.deleteMany({ userId: existing._id });
      await seedStarterChannels(Conversation, req.user.workspaceId);
      const dmMembers = [String(req.user._id), String(existing._id)].sort();
      await Conversation.updateOne(
        { workspaceId: req.user.workspaceId, type: 'dm', memberIds: { $all: dmMembers, $size: dmMembers.length } },
        { $setOnInsert: { workspaceId: req.user.workspaceId, type: 'dm', memberIds: dmMembers, createdBy: req.user._id } },
        { upsert: true },
      );
      const person = asUser(existing);
      io.to(workspaceRoom(req.user.workspaceId)).emit('presence:update', person);
      io.to('user:' + String(existing._id)).emit('workspace:changed', person);
      return res.status(200).json({ message: 'Teammate added to workspace', status: 'added', person });
    }
    await Invite.create({ email: inviteEmail, invitedBy: req.user._id, workspaceId: req.user.workspaceId });
    return res.status(201).json({ message: 'Invitation sent — they can accept it in their Workspace menu', status: 'pending' });
  }));
  router.post('/api/workspaces/join', auth, safeAsync(async (req, res) => {
    const code = String(req.body.inviteCode || '').trim().toUpperCase();
    const owner = await User.findOne({ workspaceInviteCode: code });
    if (!owner) return res.status(404).json({ message: 'That invite code was not found.' });
    if (String(owner.workspaceId || owner._id) === String(req.user.workspaceId)) return res.status(409).json({ message: 'You are already in this workspace.' });
    req.user.workspaceId = owner.workspaceId || owner._id;
    req.user.workspaceName = owner.workspaceName;
    await req.user.save();
    await Notification.deleteMany({ userId: req.user._id });
    await seedStarterChannels(Conversation, req.user.workspaceId);
    return res.json({ message: 'Joined workspace', user: asUser(req.user) });
  }));
}
