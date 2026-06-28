import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/workbench";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
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
          <h1 className="text-xl font-semibold text-gray-100">Sign in</h1>
          <p className="text-sm text-gray-500">Sign in to access your IDE workspaces.</p>
        </header>
        <label className="block space-y-1">
          <span className="label">Email</span>
          <input className="input w-full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="block space-y-1">
          <span className="label">Password</span>
          <input className="input w-full" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <button type="submit" className="btn-run w-full justify-center" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-xs text-gray-500 text-center">
          No account?{" "}
          <Link to="/signup" className="text-indigo-300 hover:text-indigo-200">Create one</Link>
        </div>
      </form>
    </div>
  );
}
