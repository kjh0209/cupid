import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import EvaluationWorkbench from "./pages/EvaluationWorkbench";
import EvalHistory from "./pages/EvalHistory";
import EvalRunDetail from "./pages/EvalRunDetail";
import AggregateStats from "./pages/AggregateStats";

const NAV = [
  { to: "/", label: "Workbench", icon: "⚡", exact: true },
  { to: "/history", label: "History", icon: "📋", exact: false },
  { to: "/stats", label: "Stats", icon: "📊", exact: false },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
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
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<EvaluationWorkbench />} />
          <Route path="/history" element={<EvalHistory />} />
          <Route path="/evals/:id" element={<EvalRunDetail />} />
          <Route path="/stats" element={<AggregateStats />} />
        </Routes>
      </main>
    </div>
  );
}
