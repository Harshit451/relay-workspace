import { useState } from "react";
import { KeyRound } from "lucide-react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";

export default function WorkspaceModal({ onClose, onJoined }) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const join = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/workspaces/join", { method: "POST", body: JSON.stringify({ code: inviteCode.trim() }) });
      onJoined(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return <Modal title="Workspaces" onClose={onClose}>
    <form className="modal-form" onSubmit={join}>
      <p className="modal-copy">Join a teammate’s workspace with an invite code.</p>
      <label>Invite code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="ABC123XY" required /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Joining…" : "Join workspace"} <KeyRound size={16} /></button>
    </form>
  </Modal>;
}
