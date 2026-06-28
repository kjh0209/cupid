import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center text-sm text-gray-500">
        loading session…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  return <>{children}</>;
}
