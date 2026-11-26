export const createAuthMiddleware = ({ jwt, secret, User, Workspace }) => async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, secret);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
    const requestedWorkspaceId = String(req.headers['x-workspace-id'] || '');
    const memberships = (req.user.workspaceIds || []).map(String);
    const validWorkspaceId = requestedWorkspaceId && memberships.includes(requestedWorkspaceId)
      ? requestedWorkspaceId
      : String(req.user.workspaceId || '');
    if (validWorkspaceId && Workspace) {
      const workspace = await Workspace.findOne({ _id: validWorkspaceId, 'members.userId': req.user._id }).select('name').lean();
      if (workspace) {
        req.user.workspaceId = workspace._id;
        req.user.workspaceName = workspace.name;
      } else if (requestedWorkspaceId) {
        return res.status(403).json({ message: 'You are not a member of that workspace.' });
      }
    }
    return next();
  } catch {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }
};
