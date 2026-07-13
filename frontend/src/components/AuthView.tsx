import React from "react";
import { BookOpen, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

interface AuthViewProps {
  isLoginView: boolean;
  setIsLoginView: (val: boolean) => void;
  username: string;
  setUsername: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  authError: string;
  setAuthError: (val: string) => void;
  authLoading: boolean;
  handleAuth: (e: React.FormEvent) => void;
}

export default function AuthView({
  isLoginView,
  setIsLoginView,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  authError,
  setAuthError,
  authLoading,
  handleAuth
}: AuthViewProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "1.5rem"
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "2.5rem",
          background: "rgba(15, 18, 30, 0.75)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            className="animate-float"
            style={{
              display: "inline-flex",
              padding: "1rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--gradient-primary)",
              marginBottom: "1rem"
            }}
          >
            <BookOpen size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            Notes Chatbot
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem" }}>
            AI-Powered Student Lecture Assistant
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {!isLoginView && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                Username
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLoginView}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="your.email@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {authError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: authError.toLowerCase().includes("successful") ? "var(--color-success)" : "var(--color-danger)",
                fontSize: "0.85rem",
                background: authError.toLowerCase().includes("successful") ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-md)"
              }}
            >
              {authError.toLowerCase().includes("successful") ? (
                <Sparkles size={16} style={{ flexShrink: 0 }} />
              ) : (
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
              )}
              <span>{authError}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={authLoading}
            style={{
              marginTop: "0.5rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.6rem"
            }}
          >
            {authLoading ? (
              <>
                <RefreshCw className="typing-dot" size={18} style={{ animation: "skeleton-shimmer 1.5s infinite" }} />
                <span>Verifying...</span>
              </>
            ) : (
              <span>{isLoginView ? "Sign In" : "Create Account"}</span>
            )}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.9rem",
            color: "var(--color-text-secondary)"
          }}
        >
          <span>
            {isLoginView
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <span
            onClick={() => {
              setIsLoginView(!isLoginView);
              setAuthError("");
            }}
            style={{
              color: "var(--color-accent-indigo)",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {isLoginView ? "Sign Up" : "Sign In"}
          </span>
        </div>
      </div>
    </div>
  );
}
