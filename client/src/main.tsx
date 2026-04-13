import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import FPApp from "./pages/App";
import "./index.css";

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-[#0c1e3a] flex items-center justify-center"><span className="text-white/40 text-sm">Loading…</span></div>;
  return user ? <FPApp /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
