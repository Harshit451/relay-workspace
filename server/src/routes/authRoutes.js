export function registerRoutes(router, dependencies) {
  const { mongoose, bcrypt, jwt, secret, User, asUser, text, email, initials, colors, auth, safeAsync, io } = dependencies;
  router.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 }));
  router.post('/api/auth/signup', async (req, res) => {
    try {
      const name = text(req.body.name, 'Name', 80);
      const userEmail = email(req.body.email);
      const password = String(req.body.password || '');
      if (!/^\S+@\S+\.\S+$/.test(userEmail) || password.length < 8) {
        return res.status(400).json({ message: 'Use a valid email and a password with at least 8 characters.' });
      }
      const user = await User.create({
        name, email: userEmail, passwordHash: await bcrypt.hash(password, 12),
        initials: initials(name), avatarColor: colors[(await User.countDocuments()) % colors.length],
      });
      return res.status(201).json({ user: asUser(user), token: jwt.sign({ sub: String(user._id) }, secret, { expiresIn: '7d' }) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'An account already uses that email.' });
      return res.status(400).json({ message: 'We could not create that account.' });
    }
  });
  router.post('/api/auth/login', async (req, res) => {
    try {
      const user = await User.findOne({ email: email(req.body.email) });
      if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) {
        return res.status(401).json({ message: 'Email or password is incorrect.' });
      }
      return res.json({ user: asUser(user), token: jwt.sign({ sub: String(user._id) }, secret, { expiresIn: '7d' }) });
    } catch {
      return res.status(500).json({ message: 'We could not sign you in right now.' });
    }
  });
  router.get('/api/me', auth, (req, res) => res.json({ user: asUser(req.user) }));
  router.patch('/api/me', auth, safeAsync(async (req, res) => {
    if (req.body.name !== undefined) req.user.name = text(req.body.name, 'Name', 80);
    if (req.body.status !== undefined) req.user.status = String(req.body.status).trim().slice(0, 120);
    if (req.body.avatarUrl !== undefined) req.user.avatarUrl = String(req.body.avatarUrl).trim().slice(0, 1000);
    await req.user.save();
    io.emit('presence:update', asUser(req.user));
    return res.json({ user: asUser(req.user) });
  }));
}
