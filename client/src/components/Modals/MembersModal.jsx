import { useState } from "react";
import Modal from "../Modal.jsx";
import { request } from "../../services/api.js";
import { getId } from "../../lib/format.js";

function MembersModal({ conversation, people, user, onClose, onChanged }) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const memberIds = (conversation.memberIds || []).map(String);
  const adminIds = (conversation.adminIds || []).map(String);
  const isAdmin = adminIds.includes(getId(user));
  const members = people.filter((person) => memberIds.includes(getId(person)));
  const available = people.filter((person) => !memberIds.includes(getId(person)));
  const change = async (userId, method, suffix = "", body) => {
    setBusyId(userId);
    setError("");
    try {
      await request(`/api/conversations/${getId(conversation)}/members/${userId}${suffix}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  };
  return (
    <Modal title="Group members" onClose={onClose}>
      <p className="modal-copy">Manage who can read and send messages in this group.</p>
      <div className="people-directory">
        {members.map((person) => {
          const personId = getId(person);
          const admin = adminIds.includes(personId);
          return (
            <div className="directory-person" key={personId}>
              <span className="avatar" style={{ background: person.avatarColor }}>{person.initials}</span>
              <div><strong>{person.name}</strong><span>{admin ? "Admin" : "Member"}</span></div>
              {isAdmin && personId !== getId(user) && (
                <button className="secondary-button" type="button" disabled={busyId === personId} onClick={() => change(personId, "PATCH", "/role", { role: admin ? "member" : "admin" })}>
                  {admin ? "Make member" : "Make admin"}
                </button>
              )}
              {(isAdmin || personId === getId(user)) && (
                <button className="secondary-button" type="button" disabled={busyId === personId} onClick={() => change(personId, "DELETE")}>
                  {personId === getId(user) ? "Leave" : "Remove"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {isAdmin && available.length > 0 && (
        <div className="group-add-members">
          <p className="modal-copy">Add a teammate</p>
          {available.map((person) => (
            <button key={getId(person)} className="secondary-button" type="button" disabled={busyId === getId(person)} onClick={() => change(getId(person), "POST", "", { userId: getId(person) })}>
              Add {person.name}
            </button>
          ))}
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
export default MembersModal;
