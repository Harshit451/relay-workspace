import { Search } from "lucide-react";

export default function MessageList({ messageAreaRef, setShowJumpLatest, loadOlderMessages, firstUnreadMessage, jumpToUnread, nextCursor, loadingOlder, busy, messages, searchBusy, search, visibleMessages, formatDate, formatTime, getId, user, retryMessage, reactToMessage, setReplyTarget, togglePin, editMessage, deleteMessage, activeChannel, typingUsers, showJumpLatest, jumpToLatest }) {
  return (
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
  );
}
