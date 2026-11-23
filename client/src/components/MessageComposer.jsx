import { Paperclip, Send, X } from "lucide-react";

export default function MessageComposer({ replyTarget, setReplyTarget, pendingUploads, removePendingUpload, uploadInput, uploading, uploadAttachment, draft, setDraft, notifyTyping, activeChannel, conversationLabel, sendMessage, socketStatus }) {
  return (
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
  );
}
