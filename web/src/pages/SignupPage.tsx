import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const { workspaceId } = await signup(email.trim().toLowerCase(), password);
      navigate(`/workbench?ws=${workspaceId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-52px)] flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card p-6 w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-gray-100">Create your account</h1>
          <p className="text-sm text-gray-500">A starter workspace will be created for you.</p>
        </header>
        <label className="block space-y-1">
          <span className="label">Email</span>
          <input className="input w-full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="block space-y-1">
          <span className="label">Password</span>
          <input className="input w-full" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <span className="text-[11px] text-gray-600">8 characters minimum.</span>
        </label>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <button type="submit" className="btn-run w-full justify-center" disabled={busy}>
          {busy ? "Creating…" : "Sign up"}
        </button>
        <div className="text-xs text-gray-500 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-300 hover:text-indigo-200">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
