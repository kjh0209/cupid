import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import EvaluationWorkbench from "./pages/EvaluationWorkbench";
import EvalHistory from "./pages/EvalHistory";
import EvalRunDetail from "./pages/EvalRunDetail";
import AggregateStats from "./pages/AggregateStats";
import CompareConsole from "./pages/CompareConsole";
import PipelineConsole from "./pages/PipelineConsole";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";

const NAV = [
  { to: "/", label: "Compare", icon: "⇄", exact: true },
  { to: "/pipeline", label: "Pipeline", icon: "🔀", exact: false },
  { to: "/workbench", label: "Workbench", icon: "⚡", exact: false },
  { to: "/history", label: "History", icon: "📋", exact: false },
  { to: "/stats", label: "Stats", icon: "📊", exact: false },
];

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const location = useLocation();
  const { user } = useAuth();
  const hideHeader = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {!hideHeader && (
        <header className="h-[52px] bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 flex items-center gap-4 z-50 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 mr-2">
            <span className="text-indigo-400 text-lg">⚡</span>
            <span className="font-bold text-white text-sm">Cupid</span>
            <span className="text-gray-500 text-xs hidden sm:block">Evaluation Workbench</span>
          </Link>

          <nav className="flex gap-0.5">
            {NAV.map((link) => {
              const active = link.exact
                ? location.pathname === link.to
                : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`}
                >
                  <span className="text-xs">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-600 hidden md:block">Backend: localhost:3000</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected" />
            {user ? (
              <span className="text-xs text-gray-400 ml-2">{user.email}</span>
            ) : (
              <Link to="/login" className="text-xs text-indigo-300 hover:text-indigo-200 ml-2">Sign in</Link>
            )}
          </div>
        </header>
      )}

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CompareConsole />} />
          <Route path="/pipeline" element={<PipelineConsole />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/workbench" element={<ProtectedRoute><EvaluationWorkbench /></ProtectedRoute>} />
          <Route path="/history" element={<EvalHistory />} />
          <Route path="/evals/:id" element={<EvalRunDetail />} />
          <Route path="/stats" element={<AggregateStats />} />
        </Routes>
      </main>
    </div>
  );
}
