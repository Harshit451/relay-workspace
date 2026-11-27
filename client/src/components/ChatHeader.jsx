import { Hash, MoreHorizontal, Search, X } from "lucide-react";

export default function ChatHeader({ activeChannel, socketStatus, search, setSearch, setPanel, conversationLabel }) {
  return ( 
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
                {activeChannel?.type === "channel" && (
                  <button className="channel-details-link" type="button" onClick={() => setPanel("channel-options")}>Channel details</button>
                )}
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
  );
}