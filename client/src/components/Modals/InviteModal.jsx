import { useState } from "react";
import { UserPlus } from "lucide-react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";

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
export default InviteModal;
