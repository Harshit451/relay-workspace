import { useState } from "react";
import { request } from "../services/api.js";

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request(
        `/api/auth/${mode === "login" ? "login" : "signup"}`,
        { method: "POST", body: JSON.stringify({ name, email, password }) },
      );
      localStorage.setItem("relay_token", data.token);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <span>relay</span>
        </div>
        <div className="auth-quote">
          <span className="quote-mark">“</span>
          <h1>Good work gets better when everyone can see the thread.</h1>
          <p>
            A calm, focused space for the conversations behind your best work.
          </p>
          <div className="auth-presence">
            <span
              className="avatar avatar-sm"
              style={{ background: "#e8a15b" }}
            >
              MC
            </span>
            <span
              className="avatar avatar-sm"
              style={{ background: "#d77bb2" }}
            >
              PS
            </span>
            <span
              className="avatar avatar-sm"
              style={{ background: "#6a9fe8" }}
            >
              NW
            </span>
            <span>Northstar Studio is in sync</span>
          </div>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-card-inner">
          <p className="eyebrow">Northstar Studio</p>
          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your workspace account"}
          </h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to pick up where your team left off."
              : "Bring your team conversations into one clear place."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              <span>→</span>
            </button>
          </form>
          <div className="auth-switch">
            <span>
              {mode === "login" ? "New to relay?" : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
