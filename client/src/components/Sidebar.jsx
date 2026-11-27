import { ChevronDown, Hash, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sparkles, Terminal, Users, Palette } from "lucide-react";
import { getId } from "../lib/format.js";

const iconForChannel = (icon) => icon === "palette" ? Palette : icon === "terminal" ? Terminal : Sparkles;

export default function Sidebar({ mobileMenuOpen, sidebarOpen, setSidebarOpen, setMobileMenuOpen, userId, messages, setPanel, channels, activeChannelId, selectChannel, unreadCounts, people, conversationLabel }) {
  return (
<aside className={`sidebar ${mobileMenuOpen ? "mobile-visible" : ""}`}>
          <div className="sidebar-heading"> 
            <div>
              <p className="eyebrow">Workspace</p>
              <h1>Team hub</h1>
            </div>
            <button
              className="icon-button subtle"
              type="button"
              onClick={() => {
                if (window.matchMedia("(max-width: 760px)").matches) setMobileMenuOpen(false);
                else setSidebarOpen((open) => !open);
              }}
              aria-label="Close sidebar"
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
              <span /> {people.filter((person) => getId(person) !== userId && person.presence === "online").length} teammates online
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
  );
}