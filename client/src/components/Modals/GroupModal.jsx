import { useState } from "react";
import { Users } from "lucide-react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";
import { getId } from "../../lib/format.js";

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
export default GroupModal;
