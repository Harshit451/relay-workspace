import { registerRoutes as registerAuth } from './authRoutes.js';
import { registerRoutes as registerUpload } from './uploadRoutes.js';
import { registerRoutes as registerConversation } from './conversationRoutes.js';
import { registerRoutes as registerMessage } from './messageRoutes.js';
import { registerRoutes as registerSearch } from './searchRoutes.js';
import { registerRoutes as registerMessageWrite } from './messageWriteRoutes.js';
import { registerRoutes as registerMember } from './memberRoutes.js';
import { registerRoutes as registerWorkspace } from './workspaceRoutes.js';

export function createApiRouter({ express, ...dependencies }) {
  const router = express.Router();
  registerAuth(router, dependencies);
  registerUpload(router, dependencies);
  registerConversation(router, dependencies);
  registerMessage(router, dependencies);
  registerSearch(router, dependencies);
  registerMessageWrite(router, dependencies);
  registerMember(router, dependencies);
  registerWorkspace(router, dependencies);
  return router;
}
