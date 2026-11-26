import { useEffect, useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";

function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    request("/api/workspaces/current").then((data) => setInviteCode(String(data.workspace.inviteCode || "").trim())).catch(() => {});
  }, []);
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
      if (data.person) onInvited?.(data);
      setEmail("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <Modal title="Invite a teammate" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <p className="modal-copy">
          Invite by email, or share this code so they can join right away.
        </p>
        <label>
          Workspace invite code
          <div className="invite-code-row"><input readOnly value={inviteCode} /><button className="secondary-button" type="button" disabled={!inviteCode} onClick={async () => { await navigator.clipboard.writeText(inviteCode.trim()); setCopied(true); }}>{copied ? "Copied" : <><Copy size={15} /> Copy</>}</button></div>
        </label>
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
          Invite teammate <UserPlus size={16} />
        </button>
      </form>
    </Modal>
  );
}
export default InviteModal;
