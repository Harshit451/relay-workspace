export const createAuthMiddleware = ({ jwt, secret, User }) => async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, secret);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
    return next();
  } catch {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }
};
