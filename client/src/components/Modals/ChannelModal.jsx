import { useState } from "react";
import { Plus } from "lucide-react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";

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
export default ChannelModal;
