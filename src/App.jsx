import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Bell,
  ChevronDown,
  Hash,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Terminal,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const iconForChannel = (icon) => {
  if (icon === "palette") return Palette;
  if (icon === "terminal") return Terminal;
  return Sparkles;
};

const getId = (record) => String(record?._id || record?.id || "");
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const formatTime = (date) =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(date),
  );
const formatDate = (date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(date),
  );

const request = async (path, options = {}) => {
  const token = localStorage.getItem("relay_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
};

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request(
        `/api/auth/${mode === "login" ? "login" : "signup"}`,
        { method: "POST", body: JSON.stringify({ name, email, password }) },
      );
      localStorage.setItem("relay_token", data.token);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <span>relay</span>
        </div>
        <div className="auth-quote">
          <span className="quote-mark">“</span>
          <h1>Good work gets better when everyone can see the thread.</h1>
          <p>
            A calm, focused space for the conversations behind your best work.
          </p>
          <div className="auth-presence">
            <span
              className="avatar avatar-sm"
              style={{ background: "#e8a15b" }}
            >
              MC
            </span>
            <span
              className="avatar avatar-sm"
              style={{ background: "#d77bb2" }}
            >
              PS
            </span>
            <span
              className="avatar avatar-sm"
              style={{ background: "#6a9fe8" }}
            >
              NW
            </span>
            <span>Northstar Studio is in sync</span>
          </div>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-card-inner">
          <p className="eyebrow">Northstar Studio</p>
          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your workspace account"}
          </h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to pick up where your team left off."
              : "Bring your team conversations into one clear place."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              <span>→</span>
            </button>
          </form>
          <div className="auth-switch">
            <span>
              {mode === "login" ? "New to relay?" : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profileStatus, setProfileStatus] = useState("Available");
  const [authLoading, setAuthLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeChannelId, setActiveChannelId] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [socket, setSocket] = useState(null);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [typingUsers, setTypingUsers] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const typingTimer = useRef(null);
  const uploadInput = useRef(null);
  const messageAreaRef = useRef(null);
  const activeConversationIdRef = useRef("");

  const activeChannel =
    channels.find((channel) => getId(channel) === activeChannelId) ||
    channels[0];
  const conversationLabel = (conversation) => {
    if (!conversation) return "Messages";
    if (conversation.type === "dm") {
      const otherId = (conversation.memberIds || []).map(String).find((id) => id !== getId(user));
      return people.find((person) => getId(person) === otherId)?.name || "Direct message";
    }
    return conversation.name || "Group conversation";
  };
  const visibleMessages = useMemo(() => {
    if (!search.trim()) return messages;
    if (searchResults) return searchResults;
    return messages.filter((message) =>
      `${message.authorName} ${message.body}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [messages, search, searchResults]);
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;
  const firstUnreadMessage = messages.find((message) =>
    message.authorId !== getId(user) && !(message.readBy || []).map(String).includes(getId(user)),
  );

  useEffect(() => {
    activeConversationIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    if (activeChannelId || !channels.length) return;
    const fallback = channels.find((conversation) => conversation.type === "channel") || channels[0];
    setActiveChannelId(getId(fallback));
  }, [channels, activeChannelId]);

  const loadWorkspace = async (channelId = activeChannelId) => {
    const channelData = await request("/api/conversations");
    const nextChannels = channelData.conversations || [];
    setChannels(nextChannels);
    const nextChannelId = channelId || getId(nextChannels[0]);
    if (nextChannelId) setActiveChannelId(nextChannelId);
    const [peopleData, notificationData, unreadData] = await Promise.all([
      request("/api/people"),
      request("/api/notifications"),
      request("/api/conversations/unread-counts"),
    ]);
    setPeople(peopleData.people || []);
    setNotifications(notificationData.notifications || []);
    setUnreadCounts(unreadData.counts || {});
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await request("/api/me");
        setUser(data.user);
      } catch {
        localStorage.removeItem("relay_token");
      } finally {
        setAuthLoading(false);
      }
    };
    void restoreSession();
  }, []);

  useEffect(() => {
    setProfileStatus(user?.status || "Available");
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    const client = io(API_BASE_URL || window.location.origin, {
      auth: { token: localStorage.getItem("relay_token") },
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10000,
    });
    setSocket(client);
    const onConnect = () => setSocketStatus("connected");
    const onDisconnect = () => setSocketStatus("reconnecting");
    const onConnectError = () => setSocketStatus("reconnecting");
    const onPresence = (updated) => {
      setPeople((current) => current.map((person) =>
        getId(person) === getId(updated) ? { ...person, ...updated } : person,
      ));
    };
    const onConversationAvailable = (conversation) => {
      setChannels((current) => current.some((item) => getId(item) === getId(conversation))
        ? current.map((item) => getId(item) === getId(conversation) ? conversation : item)
        : [conversation, ...current]);
    };
    const onConversationUpdated = (conversation) => {
      setChannels((current) => current.map((item) => getId(item) === getId(conversation) ? conversation : item));
    };
    const onConversationRemoved = ({ conversationId }) => {
      setChannels((current) => current.filter((item) => getId(item) !== conversationId));
      if (activeConversationIdRef.current === conversationId) {
        setActiveChannelId("");
        setMessages([]);
      }
    };
    const onNotification = (notification) => {
      setNotifications((current) => current.some((item) => getId(item) === getId(notification))
        ? current
        : [notification, ...current].slice(0, 20));
    };
    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    client.on("connect_error", onConnectError);
    client.on("presence:update", onPresence);
    client.on("conversation:available", onConversationAvailable);
    client.on("conversation:updated", onConversationUpdated);
    client.on("conversation:removed", onConversationRemoved);
    client.on("notification:new", onNotification);
    return () => {
      client.disconnect();
      client.off("conversation:available", onConversationAvailable);
      client.off("conversation:updated", onConversationUpdated);
      client.off("conversation:removed", onConversationRemoved);
      client.off("notification:new", onNotification);
      setSocket(null);
    };
  }, [user?.id]);

  useEffect(() => {
    const term = search.trim();
    setSearchResults(null);
    if (!user || term.length < 2) {
      setSearchBusy(false);
      return undefined;
    }
    setSearchBusy(true);
    const timer = window.setTimeout(() => {
      request(`/api/search/messages?q=${encodeURIComponent(term)}`)
        .then((data) => setSearchResults(data.messages || []))
        .catch((error) => setNotice(error.message))
        .finally(() => setSearchBusy(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [user?.id, search]);

  useEffect(() => {
    if (!user) return undefined;
    setBusy(true);
    loadWorkspace()
      .catch((error) => setNotice(error.message))
      .finally(() => setBusy(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user || !activeChannelId) return undefined;
    let alive = true;
    setShowJumpLatest(false);
    setBusy(true);
    request(`/api/channels/${activeChannelId}/messages?limit=30`)
      .then((data) => {
        if (alive) {
          setMessages(data.messages || []);
          setUnreadCounts((current) => ({ ...current, [activeChannelId]: data.unreadCount || 0 }));
        }
      })
      .catch((error) => setNotice(error.message))
      .finally(() => { if (alive) setBusy(false); });
    setTypingUsers([]);
    if (!socket) return () => { alive = false; };
    const handleNewMessage = (message) => {
      if (String(message.channelId) !== activeChannelId) return;
      if (message.authorId !== getId(user) && socket.connected) {
        socket.emit("message:read", { conversationId: activeChannelId, messageIds: [getId(message)] });
      }
      setMessages((current) => {
        if (current.some((item) => getId(item) === getId(message))) return current;
        const pending = current.find((item) => item.clientMessageId && item.clientMessageId === message.clientMessageId);
        if (pending) return current.map((item) => getId(item) === getId(pending) ? { ...message, deliveryState: "sent" } : item);
        return [...current, message];
      });
    };
    const handleUpdatedMessage = (message) => {
      if (String(message.channelId) !== activeChannelId) return;
      setMessages((current) => current.map((item) => getId(item) === getId(message) ? message : item));
    };
    const handleTyping = (event) => {
      if (event.conversationId !== activeChannelId || getId(event.user) === getId(user)) return;
      setTypingUsers((current) => event.active
        ? [...new Map([...current, event.user].map((person) => [getId(person), person])).values()]
        : current.filter((person) => getId(person) !== getId(event.user)));
    };
    const handleReceipt = (event) => {
      if (event.conversationId !== activeChannelId) return;
      const readIds = new Set((event.messageIds || []).map(String));
      setMessages((current) => current.map((message) => readIds.has(getId(message)) ? {
        ...message,
        readBy: [...new Set([...(message.readBy || []).map(String), event.userId])],
      } : message));
    };
    socket.on("message:new", handleNewMessage);
    socket.on("message:updated", handleUpdatedMessage);
    socket.on("user:typing", handleTyping);
    socket.on("receipt:read", handleReceipt);
    return () => {
      alive = false;
      socket.off("message:new", handleNewMessage);
      socket.off("message:updated", handleUpdatedMessage);
      socket.off("user:typing", handleTyping);
      socket.off("receipt:read", handleReceipt);
    };
  }, [user?.id, activeChannelId, socket, socketStatus]);

  useEffect(() => {
    if (!socket || !socket.connected || !user) return undefined;
    const conversationIds = channels.map(getId).filter(Boolean);
    conversationIds.forEach((conversationId) => socket.emit("conversation:join", { conversationId }));
    const onMessage = (message) => {
      const conversationId = String(message.channelId);
      if (conversationId === activeChannelId || message.authorId === getId(user)) return;
      setUnreadCounts((current) => ({ ...current, [conversationId]: (current[conversationId] || 0) + 1 }));
    };
    const onReceipt = (event) => {
      if (event.userId === getId(user)) setUnreadCounts((current) => ({
        ...current,
        [event.conversationId]: Math.max(0, (current[event.conversationId] || 0) - (event.readCount || 0)),
      }));
    };
    socket.on("message:new", onMessage);
    socket.on("receipt:read", onReceipt);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("receipt:read", onReceipt);
      conversationIds.forEach((conversationId) => socket.emit("conversation:leave", { conversationId }));
    };
  }, [socket, socketStatus, channels, activeChannelId, user?.id]);

  useEffect(() => {
    if (!showJumpLatest && messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [messages, showJumpLatest, activeChannelId]);

  const selectChannel = (channelId) => {
    setActiveChannelId(channelId);
    setMobileMenuOpen(false);
    setSearch("");
    setReplyTarget(null);
    setMessages([]);
    setNextCursor(null);
  };

  const loadOlderMessages = async () => {
    if (!nextCursor || !activeChannel || loadingOlder) return;
    setLoadingOlder(true);
    const scrollArea = messageAreaRef.current;
    const previousHeight = scrollArea?.scrollHeight || 0;
    const previousTop = scrollArea?.scrollTop || 0;
    try {
      const data = await request(`/api/channels/${getId(activeChannel)}/messages?limit=30&before=${encodeURIComponent(nextCursor)}`);
      setMessages((current) => [...(data.messages || []), ...current]);
      setNextCursor(data.nextCursor || null);
      setUnreadCounts((current) => ({ ...current, [getId(activeChannel)]: data.unreadCount || 0 }));
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (scrollArea) scrollArea.scrollTop = previousTop + scrollArea.scrollHeight - previousHeight;
      }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const deliverMessage = async (payload, pendingId) => {
    try {
      let message;
      if (socket?.connected) {
        try {
          const result = await new Promise((resolve, reject) => {
            socket.timeout(8000).emit("message:send", payload, (error, response) => {
              if (error) reject(error);
              else if (!response?.ok) reject(new Error(response?.message || "Message could not be sent."));
              else resolve(response);
            });
          });
          message = result.message;
        } catch {
          message = (await request(`/api/channels/${payload.conversationId}/messages`, {
            method: "POST",
            body: JSON.stringify({ body: payload.body, replyToId: payload.replyToId, attachments: payload.attachments, clientMessageId: payload.clientMessageId }),
          })).message;
        }
      } else {
        message = (await request(`/api/channels/${payload.conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: payload.body, replyToId: payload.replyToId, attachments: payload.attachments, clientMessageId: payload.clientMessageId }),
        })).message;
      }
      setMessages((current) => {
        const exists = current.some((item) => getId(item) === getId(message));
        const withoutPending = current.filter((item) => getId(item) !== pendingId);
        if (exists) return withoutPending.map((item) => getId(item) === getId(message) ? { ...item, deliveryState: "sent" } : item);
        return [...withoutPending, { ...message, deliveryState: "sent" }];
      });
      return true;
    } catch (error) {
      setMessages((current) => current.map((item) => getId(item) === pendingId ? { ...item, deliveryState: "failed" } : item));
      setNotice(error.message || "Message could not be sent.");
      return false;
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && pendingUploads.length === 0) || !activeChannel || uploading) return;
    const clientMessageId = crypto.randomUUID();
    const pendingId = `pending-${clientMessageId}`;
    const payload = {
      conversationId: getId(activeChannel), body,
      replyToId: replyTarget?._id,
      attachments: pendingUploads.map((file) => file._id),
      clientMessageId,
    };
    setMessages((current) => [...current, {
      _id: pendingId, clientMessageId, channelId: payload.conversationId,
      authorId: getId(user), authorName: user.name, authorInitials: user.initials,
      avatarColor: user.avatarColor, body, attachments: pendingUploads,
      replyToId: payload.replyToId, readBy: [getId(user)],
      createdAt: new Date().toISOString(), deliveryState: "pending",
    }]);
    setDraft("");
    const delivered = await deliverMessage(payload, pendingId);
    if (delivered) {
      setReplyTarget(null);
      setPendingUploads([]);
    } else {
      setDraft(body);
    }
  };

  const retryMessage = async (message) => {
    const pendingId = getId(message);
    setMessages((current) => current.map((item) => getId(item) === pendingId ? { ...item, deliveryState: "pending" } : item));
    await deliverMessage({
      conversationId: String(message.channelId), body: message.body,
      replyToId: message.replyToId, attachments: (message.attachments || []).map((file) => file.uploadId || file._id).filter(Boolean),
      clientMessageId: message.clientMessageId,
    }, pendingId);
  };

  const openDirectMessage = async (person) => {
    try {
      const data = await request("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ type: "dm", memberIds: [getId(person)] }),
      });
      const conversation = data.conversation;
      await loadWorkspace(getId(conversation));
      setPanel(null);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const saveProfileStatus = async () => {
    try {
      const data = await request("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ status: profileStatus }),
      });
      setUser(data.user);
      setNotice("Status updated.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const notifyTyping = (value) => {
    if (!socket?.connected || !activeChannelId) return;
    socket.emit("message:typing", { conversationId: activeChannelId, active: Boolean(value) });
    window.clearTimeout(typingTimer.current);
    if (value) typingTimer.current = window.setTimeout(() => {
      socket.emit("message:typing", { conversationId: activeChannelId, active: false });
    }, 1200);
  };

  const updateMessage = (messageId, path, options = {}) => request(`/api/messages/${messageId}${path}`, options)
    .then((data) => {
      setMessages((current) => current.map((item) => getId(item) === messageId ? data.message : item));
      return data.message;
    })
    .catch((error) => setNotice(error.message));

  const editMessage = (message) => {
    const body = window.prompt("Edit your message", message.body);
    if (body === null || !body.trim()) return;
    void updateMessage(getId(message), "", { method: "PATCH", body: JSON.stringify({ body }) });
  };

  const deleteMessage = (message) => {
    if (!window.confirm("Delete this message?")) return;
    void updateMessage(getId(message), "", { method: "DELETE" });
  };

  const reactToMessage = (message, emoji) => updateMessage(getId(message), "/reactions", {
    method: "POST", body: JSON.stringify({ emoji }),
  });

  const togglePin = (message) => updateMessage(getId(message), "/pin", { method: "PATCH" });

  const jumpToLatest = () => {
    const scrollArea = messageAreaRef.current;
    if (scrollArea) scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
    setShowJumpLatest(false);
  };

  const jumpToUnread = () => {
    const target = document.getElementById(`message-${getId(firstUnreadMessage)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const uploadAttachment = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await request("/api/uploads", { method: "POST", body: formData });
      setPendingUploads((current) => [...current, data.upload]);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removePendingUpload = async (upload) => {
    try {
      await request(`/api/uploads/${upload._id}`, { method: "DELETE" });
      setPendingUploads((current) => current.filter((item) => item._id !== upload._id));
    } catch (error) {
      setNotice(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("relay_token");
    setUser(null);
    setChannels([]);
    setMessages([]);
    setPanel(null);
  };

  if (authLoading)
    return <div className="loading-page">Preparing your workspace…</div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">R</div>
          <span>relay</span>
        </div>
        <button
          className="workspace-switcher"
          type="button"
          onClick={() => setPanel("settings")}
        >
          <span className="workspace-avatar">N</span>
          <span>Northstar Studio</span>
          <ChevronDown size={15} />
        </button>
        <div className="topbar-actions">
          <button
            className="icon-button"
            aria-label="Notifications"
            type="button"
            onClick={() => setPanel("notifications")}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
          <button
            className="profile-chip"
            type="button"
            onClick={() => setPanel("settings")}
          >
            <span
              className="avatar avatar-sm"
              style={{ background: user.avatarColor }}
            >
              {user.initials}
            </span>
            <span>{user.name}</span>
            <ChevronDown size={14} />
          </button>
        </div>
        <button
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Open navigation"
          type="button"
        >
          <Menu size={20} />
        </button>
      </header>
      <div
        className={`workspace-layout ${sidebarOpen ? "" : "sidebar-collapsed"}`}
      >
        <aside className={`sidebar ${mobileMenuOpen ? "mobile-visible" : ""}`}>
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h1>Team hub</h1>
            </div>
            <button
              className="icon-button subtle"
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
          </div>
          <nav className="primary-nav">
            <button
              className="nav-item active"
              type="button"
              onClick={() => setPanel(null)}
            >
              <MessageCircle size={17} />
              <span>Messages</span>
              <span className="nav-count">{messages.length}</span>
            </button>
            <button
              className="nav-item"
              type="button"
              onClick={() => setPanel("people")}
            >
              <Users size={17} />
              <span>People</span>
            </button>
          </nav>
          <div className="channel-section">
            <div className="section-label">
              <span>Channels</span>
              <button
                className="tiny-button"
                type="button"
                aria-label="Add channel"
                onClick={() => setPanel("channel")}
              >
                <Plus size={15} />
              </button>
            </div>
            {channels.filter((channel) => channel.type === "channel").map((channel) => {
              const ChannelIcon = iconForChannel(channel.icon);
              return (
                <button
                  key={getId(channel)}
                  className={`channel-item ${getId(channel) === activeChannelId ? "selected" : ""}`}
                  type="button"
                  onClick={() => selectChannel(getId(channel))}
                >
                  <span
                    className="channel-symbol"
                    style={{ color: channel.accent }}
                  >
                    <ChannelIcon size={15} />
                  </span>
                  <span>{channel.name}</span>
                  {unreadCounts[getId(channel)] > 0 && <span className="nav-count">{unreadCounts[getId(channel)]}</span>}
                  {getId(channel) === activeChannelId && (
                    <span className="unread-dot" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="channel-section">
            <div className="section-label">
              <span>Direct messages and groups</span>
              <button className="tiny-button" type="button" aria-label="Create group" onClick={() => setPanel("group")}>
                <Plus size={15} />
              </button>
            </div>
            {channels.filter((channel) => channel.type !== "channel").map((conversation) => (
              <button
                key={getId(conversation)}
                className={`channel-item ${getId(conversation) === activeChannelId ? "selected" : ""}`}
                type="button"
                onClick={() => selectChannel(getId(conversation))}
              >
                <span className="channel-symbol"><MessageCircle size={15} /></span>
                <span>{conversationLabel(conversation)}</span>
                {unreadCounts[getId(conversation)] > 0 && <span className="nav-count">{unreadCounts[getId(conversation)]}</span>}
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="online-indicator">
              <span /> {people.filter((person) => person.presence === "online").length} teammates online
            </div>
            <button
              className="nav-item"
              type="button"
              onClick={() => setPanel("settings")}
            >
              <Settings size={17} />
              <span>Workspace settings</span>
            </button>
          </div>
        </aside>
        <main className="main-panel">
          <section className="conversation-header">
            <div className="conversation-title">
              <span
                className="large-channel-icon"
                style={{ color: activeChannel?.accent }}
              >
                <Hash size={22} />
              </span>
              <div>
                <div className="title-row">
                  <h2>{conversationLabel(activeChannel)}</h2>
                  <span className={`status-pill ${socketStatus === "connected" ? "" : "status-away"}`}>
                    {socketStatus === "connected" ? "Live" : "Reconnecting"}
                  </span>
                </div>
                <p>
                  {activeChannel?.description ||
                    "Select a channel to start talking."}
                </p>
              </div>
            </div>
            <div className="conversation-actions">
              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages"
                  aria-label="Search messages"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className="icon-button"
                aria-label="More channel options"
                type="button"
                onClick={() => setPanel("channel-options")}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          </section>
          {notice && (
            <button
              className="connection-notice"
              type="button"
              onClick={() => setNotice("")}
            >
              {notice}
              <X size={14} />
            </button>
          )}
          <div
            className="message-area"
            ref={messageAreaRef}
            onScroll={(event) => {
              const area = event.currentTarget;
              setShowJumpLatest(area.scrollHeight - area.scrollTop - area.clientHeight > 120);
              if (area.scrollTop < 48) void loadOlderMessages();
            }}
          >
            {firstUnreadMessage && <button className="jump-to-button" type="button" onClick={jumpToUnread}>Jump to unread</button>}
            {nextCursor && (
              <button className="load-older-button" type="button" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? "Loading older messages…" : "Load older messages"}
              </button>
            )}
            <div className="date-divider">
              <span>{formatDate(new Date())}</span>
            </div>
            {busy && messages.length === 0 ? (
              <div className="loading-state">Loading your workspace…</div>
            ) : searchBusy ? (
              <div className="loading-state">Searching message history…</div>
            ) : visibleMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Search size={22} />
                </div>
                <h3>
                  {search ? "No messages found" : "Start the conversation"}
                </h3>
                <p>
                  {search
                    ? "Try a different search term."
                    : "Share an update with your team."}
                </p>
              </div>
            ) : (
              visibleMessages.map((message, index) => (
                <article className="message-row" id={`message-${getId(message)}`} key={getId(message)}>
                  <div
                    className="avatar"
                    style={{ background: message.avatarColor }}
                  >
                    {message.authorInitials}
                  </div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{message.authorName}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                      {message.conversationName && <span>{message.conversationName}</span>}
                      {index === visibleMessages.length - 1 && (
                        <span className="just-now">Latest</span>
                      )}
                    </div>
                    {message.replyToId && (
                      <small className="reply-preview">
                        Reply to: {messages.find((item) => getId(item) === String(message.replyToId))?.body || "earlier message"}
                      </small>
                    )}
                    {message.pinnedAt && <small className="message-pinned">Pinned</small>}
                    <p>{message.deletedAt ? "This message was deleted." : message.body}</p>
                    {!message.deletedAt && message.attachments?.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((file) => file.mimeType?.startsWith("image/") ? (
                          <a key={file.publicId || file.url} href={file.url} target="_blank" rel="noreferrer">
                            <img src={file.url} alt={file.name || "Shared image"} />
                          </a>
                        ) : (
                          <a key={file.publicId || file.url} href={file.url} target="_blank" rel="noreferrer">{file.name || "Download attachment"}</a>
                        ))}
                      </div>
                    )}
                    {message.editedAt && <small className="message-edited">edited</small>}
                    {message.authorId === getId(user) && (message.readBy || []).length > 1 && (
                      <small className="message-edited">Seen</small>
                    )}
                    {message.deliveryState === "pending" && <small className="message-edited">Sending…</small>}
                    {message.deliveryState === "sent" && message.authorId === getId(user) && (message.readBy || []).length <= 1 && (
                      <small className="message-edited">Sent</small>
                    )}
                    {message.deliveryState === "failed" && (
                      <button className="retry-message" type="button" onClick={() => retryMessage(message)}>Failed · retry</button>
                    )}
                    {!message.deletedAt && message.deliveryState !== "pending" && message.deliveryState !== "failed" && (
                      <div className="message-tools">
                        {["👍", "❤️", "🎉"].map((emoji) => {
                          const count = (message.reactions || []).filter((item) => item.emoji === emoji).length;
                          return <button key={emoji} type="button" onClick={() => reactToMessage(message, emoji)}>{emoji}{count ? ` ${count}` : ""}</button>;
                        })}
                        <button type="button" onClick={() => setReplyTarget(message)}>Reply</button>
                        <button type="button" onClick={() => togglePin(message)}>{message.pinnedAt ? "Unpin" : "Pin"}</button>
                        {message.authorId === getId(user) && <button type="button" onClick={() => editMessage(message)}>Edit</button>}
                        {(message.authorId === getId(user) || activeChannel?.adminIds?.some((id) => String(id) === getId(user))) && (
                          <button type="button" onClick={() => deleteMessage(message)}>Delete</button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                {typingUsers.map((person) => person.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
              </div>
            )}
            {showJumpLatest && <button className="jump-to-button jump-latest" type="button" onClick={jumpToLatest}>Jump to latest</button>}
          </div>
          <div className="composer-wrap">
            {replyTarget && (
              <div className="reply-composer">
                <span>Replying to {replyTarget.authorName}: {replyTarget.body.slice(0, 90)}</span>
                <button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply"><X size={14} /></button>
              </div>
            )}
            {pendingUploads.length > 0 && (
              <div className="pending-uploads">
                {pendingUploads.map((file) => (
                  <span key={file._id}>
                    {file.name}
                    <button type="button" onClick={() => removePendingUpload(file)} aria-label={`Remove ${file.name}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <form className="composer" onSubmit={sendMessage}>
              <input
                ref={uploadInput}
                className="file-input-hidden"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  void uploadAttachment(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button className="attach-button" type="button" onClick={() => uploadInput.current?.click()} disabled={uploading} aria-label="Attach a file">
                <Paperclip size={16} />
              </button>
              <input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  notifyTyping(event.target.value);
                }}
                placeholder={`Message ${activeChannel?.type === "channel" ? "#" : ""}${conversationLabel(activeChannel)}`}
                aria-label="Write a message"
              />
              <button
                className="send-button"
                type="submit"
                disabled={(!draft.trim() && pendingUploads.length === 0) || uploading}
                aria-label="Send message"
              >
                <Send size={17} />
              </button>
            </form>
            <div className="composer-hint">
              <span>Press Enter to send</span>
              <span>{socketStatus === "connected" ? "Connected in real time" : "Reconnecting to chat…"}</span>
            </div>
          </div>
        </main>
        <aside className="activity-panel">
          <div className="activity-heading">
            <div>
              <p className="eyebrow">Team pulse</p>
              <h2>Good morning, {user.name.split(" ")[0]}</h2>
            </div>
            <div className="pulse-orb">
              <span />
            </div>
          </div>
          <div className="focus-card">
            <div className="focus-card-top">
              <span className="focus-label">TODAY'S FOCUS</span>
              <span className="focus-kicker">LIVE</span>
            </div>
            <h3>Make the complex feel simple.</h3>
            <div className="progress-track">
              <span />
            </div>
            <p>
              Keep your team moving with fewer meetings and clearer context.
            </p>
          </div>
          <div className="activity-block">
            <div className="section-label">
              <span>Team activity</span>
              <button
                className="text-button"
                type="button"
                onClick={() => setPanel("people")}
              >
                View all
              </button>
            </div>
            <div className="activity-list">
              {people.slice(0, 3).map((person) => (
                <div className="activity-item" key={person.id || person._id}>
                  <span
                    className="activity-avatar"
                    style={{ background: person.avatarColor }}
                  >
                    {person.initials}
                  </span>
                  <p>
                    <strong>{person.name}</strong> is part of your workspace
                    <small>{person.presence === "online" ? (person.status || "Online") : person.lastSeenAt ? `Last seen ${formatDate(person.lastSeenAt)}` : "Offline"}</small>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="people-card">
            <div className="people-top">
              <div>
                <span className="people-count">{people.length}</span>
                <p>teammates in workspace</p>
              </div>
              <div className="avatar-stack">
                {people.slice(0, 3).map((person) => (
                  <span
                    key={person.id || person._id}
                    className="avatar-stack-item"
                    style={{ background: person.avatarColor }}
                  >
                    {person.initials}
                  </span>
                ))}
                {people.length > 3 && (
                  <span className="avatar-stack-item more">
                    +{people.length - 3}
                  </span>
                )}
              </div>
            </div>
            <button
              className="invite-button"
              type="button"
              onClick={() => setPanel("invite")}
            >
              Invite teammates <Plus size={15} />
            </button>
          </div>
        </aside>
      </div>
      {panel === "channel" && (
        <ChannelModal
          onClose={() => setPanel(null)}
          onCreated={async (channel) => {
            setPanel(null);
            await loadWorkspace(getId(channel));
          }}
        />
      )}
      {panel === "group" && (
        <GroupModal
          people={people.filter((person) => getId(person) !== getId(user))}
          onClose={() => setPanel(null)}
          onCreated={async (conversation) => {
            await loadWorkspace(getId(conversation));
            setPanel(null);
          }}
        />
      )}
      {panel === "members" && activeChannel && (
        <MembersModal
          conversation={activeChannel}
          people={people}
          user={user}
          onClose={() => setPanel(null)}
          onChanged={() => loadWorkspace(activeChannelId)}
        />
      )}
      {panel === "people" && (
        <Modal title="People" onClose={() => setPanel(null)}>
          <div className="people-directory">
            {people.map((person) => (
              <div className="directory-person" key={person.id || person._id}>
                <span
                  className="avatar"
                  style={{ background: person.avatarColor }}
                >
                  {person.initials}
                </span>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.email}</span>
                </div>
                <span className="presence-label">{person.presence === "online" ? (person.status || "Online") : person.lastSeenAt ? `Last seen ${formatDate(person.lastSeenAt)}` : "Offline"}</span>
                {getId(person) !== getId(user) && <button className="secondary-button" type="button" onClick={() => openDirectMessage(person)}>Message</button>}
              </div>
            ))}
          </div>
          <button
            className="primary-button compact"
            type="button"
            onClick={() => setPanel("invite")}
          >
            Invite someone <UserPlus size={16} />
          </button>
        </Modal>
      )}
      {panel === "invite" && <InviteModal onClose={() => setPanel(null)} />}
      {panel === "notifications" && (
        <Modal title="Notifications" onClose={() => setPanel(null)}>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-modal">You're all caught up.</div>
            ) : (
              notifications.map((notification) => (
                <div
                  className={`notification-item ${notification.read ? "" : "unread"}`}
                  key={getId(notification)}
                >
                  <span className="notification-icon">
                    <Bell size={15} />
                  </span>
                  <div>
                    <strong>{notification.title || "Workspace update"}</strong>
                    <p>
                      {notification.body ||
                        "There is new activity in your workspace."}
                    </p>
                    <small>{formatTime(notification.createdAt)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
          {unreadCount > 0 && (
            <button
              className="secondary-button"
              type="button"
              onClick={async () => {
                await request("/api/notifications/read-all", {
                  method: "PATCH",
                });
                setNotifications((current) =>
                  current.map((item) => ({ ...item, read: true })),
                );
              }}
            >
              Mark all as read
            </button>
          )}
        </Modal>
      )}
      {(panel === "settings" || panel === "channel-options") && (
        <Modal
          title={
            panel === "settings"
              ? "Workspace settings"
              : `#${activeChannel?.name || "channel"}`
          }
          onClose={() => setPanel(null)}
        >
          {panel === "settings" ? (
            <div className="settings-content">
              <div className="settings-profile">
                <span
                  className="avatar avatar-large"
                  style={{ background: user.avatarColor }}
                >
                  {user.initials}
                </span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <label className="settings-status">
                Status message
                <input value={profileStatus} onChange={(event) => setProfileStatus(event.target.value)} maxLength={120} />
              </label>
              <button className="secondary-button" type="button" onClick={saveProfileStatus}>Save status</button>
              <div className="settings-row">
                <span>Workspace</span>
                <strong>Northstar Studio</strong>
              </div>
              <div className="settings-row">
                <span>Updates</span>
                <strong>Live refresh enabled</strong>
              </div>
              <button className="logout-button" type="button" onClick={logout}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            <div className="settings-content">
              <p className="modal-copy">
                Keep this channel focused and easy to scan for everyone.
              </p>
              {activeChannel?.type === "group" && (
                <button className="secondary-button" type="button" onClick={() => setPanel("members")}>
                  Manage group members
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSearch("");
                  setPanel(null);
                }}
              >
                Clear search
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ChannelModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/channels", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      await onCreated(data.channel);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Create a channel" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Channel name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="product-updates"
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in this channel?"
            rows="3"
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create channel"}
          <Plus size={16} />
        </button>
      </form>
    </Modal>
  );
}

function MembersModal({ conversation, people, user, onClose, onChanged }) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const memberIds = (conversation.memberIds || []).map(String);
  const adminIds = (conversation.adminIds || []).map(String);
  const isAdmin = adminIds.includes(getId(user));
  const members = people.filter((person) => memberIds.includes(getId(person)));
  const available = people.filter((person) => !memberIds.includes(getId(person)));
  const change = async (userId, method, suffix = "", body) => {
    setBusyId(userId);
    setError("");
    try {
      await request(`/api/conversations/${getId(conversation)}/members/${userId}${suffix}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  };
  return (
    <Modal title="Group members" onClose={onClose}>
      <p className="modal-copy">Manage who can read and send messages in this group.</p>
      <div className="people-directory">
        {members.map((person) => {
          const personId = getId(person);
          const admin = adminIds.includes(personId);
          return (
            <div className="directory-person" key={personId}>
              <span className="avatar" style={{ background: person.avatarColor }}>{person.initials}</span>
              <div><strong>{person.name}</strong><span>{admin ? "Admin" : "Member"}</span></div>
              {isAdmin && personId !== getId(user) && (
                <button className="secondary-button" type="button" disabled={busyId === personId} onClick={() => change(personId, "PATCH", "/role", { role: admin ? "member" : "admin" })}>
                  {admin ? "Make member" : "Make admin"}
                </button>
              )}
              {(isAdmin || personId === getId(user)) && (
                <button className="secondary-button" type="button" disabled={busyId === personId} onClick={() => change(personId, "DELETE")}>
                  {personId === getId(user) ? "Leave" : "Remove"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {isAdmin && available.length > 0 && (
        <div className="group-add-members">
          <p className="modal-copy">Add a teammate</p>
          {available.map((person) => (
            <button key={getId(person)} className="secondary-button" type="button" disabled={busyId === getId(person)} onClick={() => change(getId(person), "POST", "", { userId: getId(person) })}>
              Add {person.name}
            </button>
          ))}
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

function GroupModal({ people, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const togglePerson = (personId) => setSelected((current) => current.includes(personId)
    ? current.filter((id) => id !== personId)
    : [...current, personId]);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ type: "group", name, memberIds: selected }),
      });
      await onCreated(data.conversation);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Create a group" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Group name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project team" maxLength={80} required />
        </label>
        <fieldset className="member-picker">
          <legend>Add people</legend>
          {people.length === 0 ? <p className="modal-copy">Invite teammates first.</p> : people.map((person) => (
            <label className="member-option" key={getId(person)}>
              <input type="checkbox" checked={selected.includes(getId(person))} onChange={() => togglePerson(getId(person))} />
              <span>{person.name}</span>
            </label>
          ))}
        </fieldset>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy || selected.length === 0}>
          {busy ? "Creating…" : "Create group"}
          <Users size={16} />
        </button>
      </form>
    </Modal>
  );
}

function InviteModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await request("/api/invites", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      setEmail("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <Modal title="Invite a teammate" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <p className="modal-copy">
          Send an invitation to bring someone into this workspace.
        </p>
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            required
          />
        </label>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" type="submit">
          Record invitation <UserPlus size={16} />
        </button>
      </form>
    </Modal>
  );
}

export default function Root() {
  return <App />;
}
