import { useEffect, useMemo, useRef, useState } from "react";
import { createSocket } from "./services/socket.js";
import { request } from "./services/api.js";
import { getId } from "./lib/format.js";
import AuthScreen from "./components/AuthScreen.jsx";
import Modal from "./components/Modal.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatHeader from "./components/ChatHeader.jsx";
import MessageList from "./components/MessageList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import ChannelModal from "./components/Modals/ChannelModal.jsx";
import MembersModal from "./components/Modals/MembersModal.jsx";
import GroupModal from "./components/Modals/GroupModal.jsx";
import InviteModal from "./components/Modals/InviteModal.jsx";
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

const formatTime = (date) =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(date),
  );
const formatDate = (date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(date),
  );



function App() {
  const [user, setUser] = useState(null);
  const [profileStatus, setProfileStatus] = useState("Available");
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [startupMessage, setStartupMessage] = useState("Checking your session…");
  const [startupError, setStartupError] = useState("");
  const [messageLoadError, setMessageLoadError] = useState("");
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
    channels.find((channel) => getId(channel) === activeChannelId) || null;
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
  const teammates = people.filter((person) => getId(person) !== getId(user));
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
    setStartupError("");
    setStartupMessage("Loading your workspace…");
    try {
      const timeout = { timeoutMs: 70000 };
      const channelData = await request("/api/conversations", timeout);
      const nextChannels = channelData.conversations || [];
      const nextSelection = nextChannels.find((item) => getId(item) === channelId)
        || nextChannels.find((item) => getId(item) === activeChannelId)
        || nextChannels.find((item) => item.type === "channel" && item.name === "general")
        || nextChannels.find((item) => item.type === "channel")
        || nextChannels[0];
      const nextChannelId = getId(nextSelection);
      setChannels(nextChannels);
      if (nextChannelId !== activeChannelId) {
        setActiveChannelId(nextChannelId);
        setMessages([]);
        setReplyTarget(null);
        setNextCursor(null);
      }
      const [peopleData, notificationData, unreadData] = await Promise.all([
        request("/api/people", timeout),
        request("/api/notifications", timeout),
        request("/api/conversations/unread-counts", timeout),
      ]);
      setPeople(peopleData.people || []);
      setNotifications(notificationData.notifications || []);
      setUnreadCounts(unreadData.counts || {});
    } catch (error) {
      setStartupError(error.message || "Could not load your workspace.");
      throw error;
    } finally {
      setStartupMessage("");
    }
  };

  const retryWorkspace = async () => {
    setBusy(true);
    setStartupMessage("Retrying workspace connection…");
    const wakeTimer = window.setTimeout(() => {
      setStartupMessage("Waking up server (free hosting can take up to 50–60 seconds)…");
    }, 1800);
    try {
      await loadWorkspace();
    } catch {
      // The loading card keeps the error and retry action visible.
    } finally {
      window.clearTimeout(wakeTimer);
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("relay_token");
    if (!token) {
      setAuthLoading(false);
      setStartupMessage("");
      return () => { active = false; };
    }
    setAuthLoading(true);
    setSessionError("");
    setStartupMessage("Checking your session…");
    const wakeTimer = window.setTimeout(() => {
      if (active) setStartupMessage("Waking up server (free hosting can take up to 50–60 seconds)…");
    }, 1800);
    const restoreSession = async () => {
      try {
        const data = await request("/api/me", { timeoutMs: 70000 });
        if (active) setUser(data.user);
      } catch (error) {
        if (error.status === 401) localStorage.removeItem("relay_token");
        else if (active) setSessionError(error.message || "Could not reconnect to the server.");
      } finally {
        window.clearTimeout(wakeTimer);
        if (active) {
          setAuthLoading(false);
          setStartupMessage("");
        }
      }
    };
    void restoreSession();
    return () => {
      active = false;
      window.clearTimeout(wakeTimer);
    };
  }, [sessionAttempt]);

  useEffect(() => {
    setProfileStatus(user?.status || "Available");
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    const client = createSocket(localStorage.getItem("relay_token"));
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
    setStartupError("");
    const wakeTimer = window.setTimeout(() => {
      setStartupMessage("Waking up server (free hosting can take up to 50–60 seconds)…");
    }, 1800);
    loadWorkspace()
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(wakeTimer);
        setBusy(false);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user || !activeChannelId) return undefined;
    let alive = true;
    setShowJumpLatest(false);
    setMessageLoadError("");
    setBusy(true);
    request(`/api/channels/${activeChannelId}/messages?limit=30`, { timeoutMs: 70000 })
      .then((data) => {
        if (alive) {
          setMessages(data.messages || []);
          setUnreadCounts((current) => ({ ...current, [activeChannelId]: data.unreadCount || 0 }));
        }
      })
      .catch((error) => { if (alive) setMessageLoadError(error.message); })
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

  const retryActiveConversation = async () => {
    const conversationId = activeChannelId;
    if (!conversationId) return;
    setMessageLoadError("");
    setBusy(true);
    setStartupMessage("Reconnecting to your conversation…");
    const wakeTimer = window.setTimeout(() => {
      setStartupMessage("Waking up server (free hosting can take up to 50–60 seconds)…");
    }, 1800);
    try {
      const data = await request(`/api/channels/${conversationId}/messages?limit=30`, { timeoutMs: 70000 });
      if (activeConversationIdRef.current !== conversationId) return;
      setMessages(data.messages || []);
      setUnreadCounts((current) => ({ ...current, [conversationId]: data.unreadCount || 0 }));
    } catch (error) {
      if (activeConversationIdRef.current === conversationId) setMessageLoadError(error.message);
    } finally {
      window.clearTimeout(wakeTimer);
      setStartupMessage("");
      setBusy(false);
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
    setPeople([]);
    setNotifications([]);
    setUnreadCounts({});
    setActiveChannelId("");
    setDraft("");
    setSearch("");
    setSearchResults(null);
    setReplyTarget(null);
    setPanel(null);
    setSessionError("");
    setStartupError("");
  };

  if (authLoading) return (
    <div className="loading-page" role="status" aria-live="polite">
      <div className="startup-card">
        <span className="startup-spinner" />
        <strong>{startupMessage || "Preparing your workspace…"}</strong>
        <p>Your session will resume as soon as the server responds.</p>
      </div>
    </div>
  );
  if (sessionError) return (
    <div className="loading-page">
      <div className="startup-card startup-error">
        <strong>We couldn’t reconnect to Relay</strong>
        <p>{sessionError}</p>
        <p>Free hosting can take up to 50–60 seconds to wake. Please retry.</p>
        <button className="primary-button" type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)}>Retry connection</button>
      </div>
    </div>
  );
  if (!user) return <AuthScreen onAuthenticated={(nextUser) => { setSessionError(""); setUser(nextUser); }} />;

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
          <span className="workspace-avatar">{(user.workspaceName || "My workspace").slice(0, 1).toUpperCase()}</span>
          <span>{user.workspaceName || "My workspace"}</span>
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
          className={`mobile-toggle ${sidebarOpen ? "sidebar-open" : ""} ${mobileMenuOpen ? "drawer-open" : ""}`}
          onClick={() => {
            if (window.matchMedia("(max-width: 760px)").matches) setMobileMenuOpen((open) => !open);
            else setSidebarOpen((open) => !open);
          }}
          aria-label={window.matchMedia("(max-width: 760px)").matches
            ? mobileMenuOpen ? "Close navigation" : "Open navigation"
            : sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
          title={window.matchMedia("(max-width: 760px)").matches
            ? mobileMenuOpen ? "Close navigation" : "Open navigation"
            : sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
          type="button"
        >
          {window.matchMedia("(max-width: 760px)").matches
            ? mobileMenuOpen ? <X size={20} /> : <Menu size={20} />
            : sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          <span className="sidebar-toggle-label">
            {mobileMenuOpen ? "Close navigation" : sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          </span>
        </button>
      </header>
      <div
        className={`workspace-layout ${sidebarOpen ? "" : "sidebar-collapsed"}`}
      >
        <Sidebar mobileMenuOpen={mobileMenuOpen} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setMobileMenuOpen={setMobileMenuOpen} userId={getId(user)} messages={messages} setPanel={setPanel} channels={channels} activeChannelId={activeChannelId} selectChannel={selectChannel} unreadCounts={unreadCounts} people={people} conversationLabel={conversationLabel} />

        <main className="main-panel">
          <ChatHeader activeChannel={activeChannel} socketStatus={socketStatus} search={search} setSearch={setSearch} setPanel={setPanel} conversationLabel={conversationLabel} />

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
          {startupError && messages.length > 0 && (
            <div className="workspace-retry-banner" role="alert">
              <span>Some workspace details did not load: {startupError}</span>
              <button type="button" onClick={retryWorkspace}>Retry</button>
            </div>
          )}
          <MessageList messageAreaRef={messageAreaRef} setShowJumpLatest={setShowJumpLatest} loadOlderMessages={loadOlderMessages} firstUnreadMessage={firstUnreadMessage} jumpToUnread={jumpToUnread} nextCursor={nextCursor} loadingOlder={loadingOlder} busy={busy} startupMessage={startupMessage} startupError={startupError} messageLoadError={messageLoadError} retryWorkspace={retryWorkspace} retryActiveConversation={retryActiveConversation} messages={messages} searchBusy={searchBusy} search={search} visibleMessages={visibleMessages} formatDate={formatDate} formatTime={formatTime} getId={getId} user={user} retryMessage={retryMessage} reactToMessage={reactToMessage} setReplyTarget={setReplyTarget} togglePin={togglePin} editMessage={editMessage} deleteMessage={deleteMessage} activeChannel={activeChannel} typingUsers={typingUsers} showJumpLatest={showJumpLatest} jumpToLatest={jumpToLatest} />
          <MessageComposer replyTarget={replyTarget} setReplyTarget={setReplyTarget} pendingUploads={pendingUploads} removePendingUpload={removePendingUpload} uploadInput={uploadInput} uploading={uploading} uploadAttachment={uploadAttachment} draft={draft} setDraft={setDraft} notifyTyping={notifyTyping} activeChannel={activeChannel} conversationLabel={conversationLabel} sendMessage={sendMessage} socketStatus={socketStatus} />
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
              {teammates.length === 0 ? (
                <div className="activity-empty">You’re the first member here. Invite teammates to start collaborating.</div>
              ) : teammates.slice(0, 3).map((person) => (
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
                <span className="people-count">{teammates.length}</span>
                <p>{teammates.length === 1 ? "teammate in workspace" : "teammates in workspace"}</p>
              </div>
              <div className="avatar-stack">
                {teammates.slice(0, 3).map((person) => (
                  <span
                    key={person.id || person._id}
                    className="avatar-stack-item"
                    style={{ background: person.avatarColor }}
                  >
                    {person.initials}
                  </span>
                ))}
                {teammates.length > 3 && (
                  <span className="avatar-stack-item more">
                    +{teammates.length - 3}
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
                <strong>{user.workspaceName || "My workspace"}</strong>
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
              <p className="eyebrow">{activeChannel?.type === "channel" ? "Channel purpose" : "Conversation details"}</p>
              <p className="modal-copy channel-description-detail">
                {activeChannel?.description || "No description has been added yet."}
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

export default App;

