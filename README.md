# Relay team chat

Relay is a React and Express team chat project. The backend uses MongoDB through Mongoose, JWT for API and Socket.IO authentication, and Cloudinary for message attachments.

## Run locally

Use Node.js 20.19 or newer. Install the dependencies with `npm install`.

Create a MongoDB Atlas deployment, add a database user, and allow your current IP address in the Atlas project's Network Access settings. In Atlas, select **Connect → Drivers → Node.js** and copy the connection string. Replace its password placeholder; URL-encode reserved characters in the username or password.

Copy `.env.example` to `.env` if you do not already have a local `.env` file. Fill in:

```env
MONGODB_URI=mongodb+srv://<database-user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=relay_workspace
JWT_SECRET=<long-random-secret>
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep `.env` private. It is excluded by `.gitignore`; commit `.env.example` only.

Create a Cloudinary account and add its cloud name, API key, and API secret to `.env` to enable attachments. Uploads are limited to 10 MB each and support common image formats, PDF, plain text, and DOCX. Attachments are stored in Cloudinary rather than on the app server's disk.

Start the API and Vite frontend together:

```sh
npm run dev
```

Open `http://localhost:5173`. The server connects to Atlas and creates the starter channels on first startup. You can also connect MongoDB Compass to the same Atlas cluster to inspect the database.

## Included in this implementation

- Signup, login, JWT protected API routes, and password hashing
- Mongoose schemas and indexes for users, conversations, messages, notifications, invites, and uploads
- Public channels, direct conversations, and groups with a creator admin
- Socket.IO authentication, message delivery, typing events, presence, read receipts, and reconnect behavior
- Cursor based message history, message search, unread counts, replies, editing, deletion, reactions, and pinning
- Optimistic message states with a stable client ID so a reconnect retry does not duplicate a saved message
- Group member management with admin/member roles and a last-admin safeguard
- Cloudinary upload route and attachment previews
- Persistent in-app notifications for offline direct/group messages and `@email` mentions

## GitHub

Create an empty repository on GitHub, then run these commands in the project folder. Before the first commit, check that `.env` is ignored and `.env.example` is the only environment file staged.

```sh
git init
git add .
git status --short
git commit -m "Build Relay team chat"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repository>.git
git push -u origin main
```

If `.env` was ever committed, remove it from Git history and rotate its MongoDB and JWT credentials before publishing the repository.

## Deploy

Deploy the backend as a persistent web service and the Vite frontend as a static site. Render can host both service types. The server supports WebSocket connections and binds to the port supplied by the host.

1. Push the project to GitHub and connect the repository to Render.
2. Create a Render **Web Service** for the API. Use build command `npm ci` and start command `npm start`.
3. Add `MONGODB_URI`, `MONGODB_DB_NAME`, and a new strong `JWT_SECRET` in the backend service's environment settings. Add the backend's permitted outbound IP addresses to the Atlas IP access list.
4. Create a Render **Static Site** for the same repository. Use build command `npm ci && npm run build` and publish directory `dist`.
5. Set the static site's `VITE_API_URL` to the deployed backend URL. Set the backend's `CLIENT_ORIGIN` to the static site's exact `https://...onrender.com` origin, then redeploy both services.
6. Check `https://<backend-url>/api/health`, then sign up and open the app in two separate browsers to confirm chat delivery and reconnection.

The free Render web service can sleep after inactivity, so the first request may take longer. This project currently uses one backend instance. If you scale Socket.IO to multiple instances, add a Redis adapter and configure sticky sessions at the load balancer.

## Remaining work for the full project brief

The current implementation is a working feature foundation, not every stretch feature in the brief. Richer mention selection, avatar upload, and a production email or push-notification provider remain. Redis-based multi-instance scaling, automated integration tests, and deployment verification against your own Atlas and Cloudinary accounts also remain.
