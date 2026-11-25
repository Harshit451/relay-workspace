export function registerRoutes(router, dependencies) {
  const { User, Notification, Invite, auth, safeAsync, email, asUser } = dependencies;
  router.get('/api/people', auth, safeAsync(async (req, res) => {
    const people = await User.find({ workspaceId: req.user.workspaceId }).sort({ name: 1 }).lean();
    res.json({ people: people.map(asUser) });
  }));
  router.get('/api/notifications', auth, safeAsync(async (req, res) => {
    res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean() });
  }));
  router.patch('/api/notifications/read-all', auth, safeAsync(async (req, res) => {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.json({ ok: true });
  }));
  router.post('/api/invites', auth, safeAsync(async (req, res) => {
    const inviteEmail = email(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(inviteEmail)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (inviteEmail === req.user.email) return res.status(400).json({ message: 'You are already in this workspace.' });
    await Invite.create({ email: inviteEmail, invitedBy: req.user._id, workspaceId: req.user.workspaceId });
    return res.status(201).json({ message: 'Invitation recorded. Email delivery still needs an email provider.' });
  }));
}
