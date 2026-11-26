# Relay team chat

Relay is a real-time team chat built with React, Vite, Express, Socket.IO, MongoDB, and Cloudinary. Each account belongs to a workspace; new signups get a private workspace unless they use an email with a pending invitation. Root npm scripts use concurrently, with dedicated manifests in `client/` and `server/`.


The root scripts stay compatible with Render and local development:

```sh
npm install
npm run dev       # client on :5173 and API/socket server on :4000
npm run build     # writes client/dist
npm start         # starts the API/socket server
```

## Local setup

1. Use Node.js 20.19 or newer and run `npm install` at the repository root.
2. Create a MongoDB Atlas database, add a database user, and permit your current IP in Atlas Network Access. Copy the Atlas driver URI.
3. Copy the root `.env.example` to `.env` and fill in `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, and `CLIENT_ORIGIN`. Keep `.env` private.
4. Copy `client/.env.example` to `client/.env`. Leave `VITE_API_URL=http://localhost:4000` for local development.
5. Add Cloudinary credentials to `.env` if you want file attachments.
6. Run `npm run dev` from the root and open `http://localhost:5173`.

You can also run `npm run dev --prefix server` or `npm run dev --prefix client` independently after installing dependencies at the repository root. The root manifest is required for Render's root-level `npm ci` and start/build scripts; the client and server manifests describe their respective apps. Root `.env` is used by the root scripts. For a teammate to join an existing workspace, invite their email and have them sign up or sign in with that same email.

On the next server startup, accounts and conversations from before workspace isolation are assigned to a shared legacy workspace. Their messages are retained. New signups are separate unless they accept an invitation.

Root `.env.example` and `client/.env.example` configure different parts of the app: server secrets and database settings belong in root `.env`; the Vite API URL belongs in `client/.env`. Never commit either real `.env` file.

## Included functionality

- Signup, login, JWT protected API routes, and password hashing
- MongoDB models for users, conversations, messages, notifications, invites, and uploads
- Public channels, direct conversations, and groups with member/admin controls
- Socket.IO message delivery, typing events, presence, read receipts, and reconnect behavior
- Cursor based history, search, unread counts, replies, editing, deletion, reactions, and pinning
- Duplicate-safe optimistic message retries
- Cloudinary uploads and attachment previews
- Persistent in-app notifications for offline messages and email mentions

## GitHub

Create an empty GitHub repository and from this project root run:

```sh
git add .
git status --short
git commit -m "Relay workspace"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repository>.git
git push -u origin main
```

Confirm `.env`, `client/.env`, and `server/.env` are ignored before committing. If a secret was ever committed, remove it from repository history and rotate it.

## Render deployment

### Backend Web Service

- Root directory: repository root
- Build command: `npm ci`
- Start command: `npm start`
- Environment: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `CLIENT_ORIGIN`, and optional Cloudinary credentials
- Add the backend service's permitted outbound IP addresses to the Atlas IP access list.

### Frontend Static Site

- Root directory: repository root
- Build command: `npm ci && npm run build`
- Publish directory: `client/dist`
- Environment variable: `VITE_API_URL=https://<your-backend-service>.onrender.com`

Set `CLIENT_ORIGIN` on the backend to the exact deployed frontend origin, then redeploy. Verify `/api/health`, sign in, and test live messages using two browser sessions. The free Render web service may sleep after inactivity. This implementation currently expects one backend instance; multiple instances need a Socket.IO Redis adapter and suitable load-balancer session handling.

## Project structure

```
project
├─ client
│  ├─ index.html
│  ├─ package.json
│  ├─ postcss.config.mjs
│  ├─ src
│  │  ├─ App.jsx
│  │  ├─ components
│  │  │  ├─ AuthScreen.jsx
│  │  │  ├─ ChatHeader.jsx
│  │  │  ├─ MessageComposer.jsx
│  │  │  ├─ MessageList.jsx
│  │  │  ├─ Modal.jsx
│  │  │  ├─ Modals
│  │  │  │  ├─ ChannelModal.jsx
│  │  │  │  ├─ GroupModal.jsx
│  │  │  │  ├─ InviteModal.jsx
│  │  │  │  ├─ MembersModal.jsx
│  │  │  │  └─ WorkspaceModal.jsx
│  │  │  └─ Sidebar.jsx
│  │  ├─ context
│  │  ├─ hooks
│  │  ├─ lib
│  │  │  └─ format.js
│  │  ├─ main.jsx
│  │  ├─ services
│  │  │  ├─ api.js
│  │  │  └─ socket.js
│  │  └─ styles
│  │     └─ styles.css
│  └─ vite.config.js
├─ package-lock.json
├─ package.json
├─ README.md
└─ server
   ├─ package.json
   └─ src
      ├─ config
      │  ├─ cloudinary.js
      │  ├─ db.js
      │  └─ env.js
      ├─ controllers
      │  └─ messageController.js
      ├─ index.js
      ├─ middleware
      │  ├─ authMiddleware.js
      │  ├─ errorHandler.js
      │  └─ uploadMiddleware.js
      ├─ models
      │  ├─ Conversation.js
      │  ├─ index.js
      │  ├─ Invite.js
      │  ├─ Message.js
      │  ├─ Notification.js
      │  ├─ Upload.js
      │  ├─ User.js
      │  └─ Workspace.js
      ├─ routes
      │  ├─ apiRoutes.js
      │  ├─ authRoutes.js
      │  ├─ conversationRoutes.js
      │  ├─ memberRoutes.js
      │  ├─ messageRoutes.js
      │  ├─ messageWriteRoutes.js
      │  ├─ searchRoutes.js
      │  ├─ uploadRoutes.js
      │  └─ workspaceRoutes.js
      ├─ socket
      │  └─ index.js
      └─ utils
         └─ seed.js

```