import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  MessageSquare,
  Search,
  UploadCloud,
  LogOut,
  Trash2,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  HelpCircle,
  History
} from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Document {
  id: number;
  filename: string;
  filepath: string;
  summary: string | null;
  uploaded_at: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface SearchResult {
  id: number;
  chunk_index: number;
  content: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Workspace state
  const [activeTab, setActiveTab] = useState<"summary" | "chat" | "search">(
    "summary"
  );
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Ref for chat scrolling
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user profile and documents on token change
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      fetchProfile();
      fetchDocuments();
    } else {
      localStorage.removeItem("token");
      setUser(null);
      setDocuments([]);
      setSelectedDocId(null);
    }
  }, [token]);

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  // Fetch uploaded documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Documents fetch error:", err);
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, sendingMessage]);

  // Load chat history when selected document changes
  useEffect(() => {
    if (selectedDocId && token) {
      fetchChatHistory(selectedDocId);
      // Reset tab and searches
      setActiveTab("summary");
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [selectedDocId]);

  // Fetch chat history for selected document
  const fetchChatHistory = async (docId: number) => {
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat/history/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error("Chat history fetch error:", err);
    } finally {
      setChatLoading(false);
    }
  };

  // Trigger keyword search
  const handleKeywordSearch = async (query: string) => {
    setSearchQuery(query);
    if (!selectedDocId || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/documents/${selectedDocId}/search?query=${encodeURIComponent(
          query
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Keyword search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Auth actions
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isLoginView) {
        // OAuth2 Password form data format
        const formData = new URLSearchParams();
        formData.append("username", email); // backend uses username parameter for email check
        formData.append("password", password);

        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString()
        });

        const data = await res.json();
        if (res.ok) {
          setToken(data.access_token);
        } else {
          setAuthError(data.detail || "Login failed");
        }
      } else {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();
        if (res.ok) {
          // Success! Toggle view to login
          setIsLoginView(true);
          setPassword("");
          setAuthError("Registration successful! Please login.");
        } else {
          setAuthError(data.detail || "Registration failed");
        }
      }
    } catch (err) {
      setAuthError("Server unreachable. Ensure FastAPI backend is running.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("token");
  };

  // Upload file action
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF notes are supported.");
      return;
    }

    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setDocuments((prev) => [data, ...prev]);
        setSelectedDocId(data.id);
      } else {
        setUploadError(data.detail || "Failed to upload notes.");
      }
    } catch (err) {
      setUploadError("Error uploading notes. Check connection.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete these study notes?")) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (selectedDocId === docId) {
          setSelectedDocId(null);
        }
      }
    } catch (err) {
      console.error("Delete doc error:", err);
    }
  };

  // Chat actions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedDocId || sendingMessage) return;

    const userMsgContent = chatInput.trim();
    setChatInput("");
    setSendingMessage(true);

    // Optimistically add user message to list
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userMsgContent,
      timestamp: new Date().toISOString()
    };
    setChatHistory((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API_BASE}/chat/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMsgContent,
          document_id: selectedDocId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: data.answer,
            timestamp: new Date().toISOString()
          }
        ]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: "Sorry, I couldn't process your question at this moment.",
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Clear chat history
  const handleClearHistory = async () => {
    if (!selectedDocId) return;
    if (!confirm("Clear your conversation history for these notes?")) return;

    try {
      const res = await fetch(`${API_BASE}/chat/history/${selectedDocId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChatHistory([]);
      }
    } catch (err) {
      console.error("Clear history error:", err);
    }
  };

  // Get active document meta
  const activeDoc = documents.find((d) => d.id === selectedDocId);

  // Render Auth screen
  if (!token) {
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
                  color: "var(--color-danger)",
                  fontSize: "0.85rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "var(--radius-md)"
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
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

  // Render Dashboard Workspace
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar Panel */}
      <div
        className="glass-panel"
        style={{
          width: "320px",
          height: "100%",
          borderRadius: "0",
          borderRight: "var(--border-glass)",
          borderTop: "none",
          borderBottom: "none",
          borderLeft: "none",
          background: "rgba(10, 12, 22, 0.85)",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          flexShrink: 0
        }}
      >
        {/* Brand header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "2rem"
          }}
        >
          <div
            style={{
              background: "var(--gradient-primary)",
              padding: "0.5rem",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>
              Study Chatbot
            </h2>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              AI Notes Core
            </span>
          </div>
        </div>

        {/* Upload Notes Area */}
        <div style={{ marginBottom: "1.5rem" }}>
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: uploading ? "1px solid var(--color-text-muted)" : "2px dashed rgba(255, 255, 255, 0.1)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              textAlign: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.02)",
              transition: "all var(--transition-fast)"
            }}
            onMouseOver={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = "var(--color-accent-indigo)";
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)";
              }
            }}
            onMouseOut={(e) => {
              if (!uploading) {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              }
            }}
          >
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <RefreshCw size={24} style={{ animation: "skeleton-shimmer 1.5s infinite" }} color="var(--color-accent-indigo)" />
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                  Analyzing and Chunking PDF...
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <UploadCloud size={24} color="var(--color-text-secondary)" />
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  Upload Lecture Notes
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                  PDF format (Max 20MB)
                </span>
              </div>
            )}
          </div>
          {uploadError && (
            <div
              style={{
                color: "var(--color-danger)",
                fontSize: "0.75rem",
                marginTop: "0.5rem",
                textAlign: "center"
              }}
            >
              {uploadError}
            </div>
          )}
        </div>

        {/* Notes list */}
        <h3
          style={{
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text-muted)",
            marginBottom: "0.75rem"
          }}
        >
          My Notes ({documents.length})
        </h3>

        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {documents.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2rem 1rem",
                color: "var(--color-text-muted)",
                fontSize: "0.85rem"
              }}
            >
              No notes uploaded yet. Drag or click the upload panel above!
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.02)",
                    border: isSelected ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)"
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", overflow: "hidden", marginRight: "0.5rem" }}>
                    <FileText size={16} color={isSelected ? "var(--color-accent-indigo)" : "var(--color-text-secondary)"} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: isSelected ? "#fff" : "var(--color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: isSelected ? 500 : 400
                      }}
                    >
                      {doc.filename}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    style={{
                      background: "transparent",
                      color: "var(--color-text-muted)",
                      padding: "0.2rem",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = "var(--color-danger)";
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = "var(--color-text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User profile / Logout */}
        {user && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: "1rem",
              borderTop: "var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", overflow: "hidden" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--gradient-cyan-blue)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  flexShrink: 0
                }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {user.username}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "transparent",
                color: "var(--color-text-secondary)",
                padding: "0.4rem",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = "var(--color-text-secondary)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace Panel */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", background: "var(--color-bg-surface)" }}>
        {activeDoc ? (
          <>
            {/* Notes details workspace Header */}
            <div
              style={{
                padding: "1rem 2rem",
                borderBottom: "var(--border-glass)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 17, 24, 0.4)",
                flexShrink: 0
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <FileText size={20} color="var(--color-accent-indigo)" />
                <div>
                  <h2 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 600 }}>{activeDoc.filename}</h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    Uploaded on {new Date(activeDoc.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(0, 0, 0, 0.25)",
                  padding: "3px",
                  borderRadius: "var(--radius-md)",
                  border: "var(--border-glass)"
                }}
              >
                {[
                  { id: "summary", label: "AI Summary", icon: Sparkles },
                  { id: "chat", label: "Ask Chatbot", icon: MessageSquare },
                  { id: "search", label: "Keyword Search", icon: Search }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        background: isActive ? "var(--gradient-primary)" : "transparent",
                        color: isActive ? "#fff" : "var(--color-text-secondary)",
                        boxShadow: isActive ? "var(--shadow-sm)" : "none"
                      }}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content viewer */}
            <div style={{ flexGrow: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              
              {/* SUMMARY TAB */}
              {activeTab === "summary" && (
                <div style={{ padding: "2rem", overflowY: "auto", height: "100%", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
                  <div className="glass-panel" style={{ padding: "2.5rem", background: "rgba(19, 22, 34, 0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                      <Sparkles size={20} color="var(--color-accent-purple)" />
                      <h3 style={{ fontSize: "1.3rem", color: "#fff" }}>AI Summary Notes</h3>
                    </div>
                    {activeDoc.summary ? (
                      <div className="summary-markdown" style={{ whiteSpace: "pre-wrap" }}>
                        {activeDoc.summary}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "3rem 1rem" }}>
                        <RefreshCw className="animate-float" size={32} color="var(--color-accent-purple)" style={{ animation: "skeleton-shimmer 2s infinite" }} />
                        <p style={{ color: "var(--color-text-secondary)" }}>
                          Gemini is summarizing notes details...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                  {/* Messages container */}
                  <div style={{ flexGrow: 1, overflowY: "auto", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    
                    {/* Header bar controls */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                      <button
                        onClick={handleClearHistory}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          fontSize: "0.75rem",
                          color: "var(--color-text-secondary)",
                          background: "rgba(255,255,255,0.03)",
                          border: "var(--border-glass)",
                          padding: "0.4rem 0.8rem",
                          borderRadius: "var(--radius-md)"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
                        onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
                      >
                        <History size={12} />
                        <span>Clear History</span>
                      </button>
                    </div>

                    {chatLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                        <RefreshCw size={24} color="var(--color-accent-indigo)" style={{ animation: "skeleton-shimmer 1.5s infinite" }} />
                      </div>
                    ) : chatHistory.length === 0 ? (
                      <div style={{ margin: "auto", maxWidth: "480px", textAlign: "center", padding: "2rem" }}>
                        <HelpCircle size={40} color="var(--color-text-muted)" style={{ marginBottom: "1rem" }} />
                        <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>Start Studying with Gemini RAG</h4>
                        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                          Ask specific queries, explain complex terminology, or ask it to generate study quizzes.
                        </p>
                        {/* Quick Prompts */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                          {[
                            "What are the most crucial takeaways here?",
                            "Can you write a 3-question quiz from these notes?",
                            "Explain the core terms clearly."
                          ].map((prompt, i) => (
                            <div
                              key={i}
                              onClick={() => setChatInput(prompt)}
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "var(--border-glass)",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                color: "var(--color-text-secondary)"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = "var(--color-accent-indigo)";
                                e.currentTarget.style.color = "#fff";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                                e.currentTarget.style.color = "var(--color-text-secondary)";
                              }}
                            >
                              {prompt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      chatHistory.map((msg) => {
                        const isUser = msg.role === "user";
                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: "flex",
                              justifyContent: isUser ? "flex-end" : "flex-start",
                              width: "100%"
                            }}
                          >
                            <div
                              className="glass-panel"
                              style={{
                                maxWidth: "75%",
                                padding: "1rem 1.25rem",
                                borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                                background: isUser ? "var(--gradient-primary)" : "rgba(30, 35, 50, 0.55)",
                                border: isUser ? "none" : "var(--border-glass)",
                                boxShadow: isUser ? "var(--shadow-glow-indigo)" : "var(--shadow-sm)"
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.9rem",
                                  lineHeight: "1.5",
                                  color: isUser ? "#fff" : "var(--color-text-primary)",
                                  whiteSpace: "pre-wrap"
                                }}
                              >
                                {msg.content}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: isUser ? "rgba(255,255,255,0.7)" : "var(--color-text-muted)",
                                  textAlign: "right",
                                  marginTop: "0.4rem"
                                }}
                              >
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {sendingMessage && (
                      <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
                        <div
                          className="glass-panel"
                          style={{
                            padding: "1rem 1.25rem",
                            borderRadius: "16px 16px 16px 2px",
                            background: "rgba(30, 35, 50, 0.55)",
                            border: "var(--border-glass)"
                          }}
                        >
                          <div className="typing-indicator">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Message Input box */}
                  <form
                    onSubmit={handleSendMessage}
                    style={{
                      padding: "1.5rem 2rem",
                      borderTop: "var(--border-glass)",
                      background: "rgba(10, 12, 22, 0.4)",
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "center"
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Ask a question about these notes..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      style={{ flexGrow: 1 }}
                      disabled={sendingMessage}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{
                        padding: "0.75rem",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                      disabled={!chatInput.trim() || sendingMessage}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              )}

              {/* SEARCH TAB */}
              {activeTab === "search" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", padding: "2rem" }}>
                  <div style={{ maxWidth: "800px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
                    
                    {/* Search bar input */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <Search
                        size={18}
                        color="var(--color-text-secondary)"
                        style={{ position: "absolute", left: "1rem" }}
                      />
                      <input
                        type="text"
                        placeholder="Search for formulas, keywords, or topics in your notes..."
                        value={searchQuery}
                        onChange={(e) => handleKeywordSearch(e.target.value)}
                        style={{ width: "100%", paddingLeft: "2.75rem" }}
                      />
                      {searchLoading && (
                        <RefreshCw
                          size={16}
                          color="var(--color-accent-indigo)"
                          style={{ position: "absolute", right: "1.25rem", animation: "skeleton-shimmer 1.5s infinite" }}
                        />
                      )}
                    </div>

                    {/* Search results */}
                    <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {searchResults.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--color-text-muted)" }}>
                          {searchQuery ? "No matches found in document chunks." : "Type keywords above to run note context matches."}
                        </div>
                      ) : (
                        searchResults.map((result) => (
                          <div
                            key={result.id}
                            className="glass-panel"
                            style={{
                              padding: "1.25rem",
                              background: "rgba(255,255,255,0.015)",
                              transition: "all var(--transition-fast)"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--color-accent-indigo)"}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)"}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginBottom: "0.75rem"
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  background: "rgba(99, 102, 241, 0.15)",
                                  color: "var(--color-accent-indigo)",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "var(--radius-sm)",
                                  fontWeight: 600
                                }}
                              >
                                Chunk #{result.chunk_index + 1}
                              </span>
                            </div>
                            <p
                              style={{
                                fontSize: "0.9rem",
                                color: "var(--color-text-secondary)",
                                lineHeight: "1.5",
                                whiteSpace: "pre-wrap"
                              }}
                            >
                              {result.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty Workspace Welcome pane */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "2rem",
              textAlign: "center"
            }}
          >
            <div
              className="animate-float"
              style={{
                background: "rgba(255,255,255,0.02)",
                padding: "2rem",
                borderRadius: "var(--radius-lg)",
                border: "var(--border-glass)",
                marginBottom: "1.5rem"
              }}
            >
              <BookOpen size={48} color="var(--color-text-muted)" />
            </div>
            <h2 style={{ fontSize: "1.8rem", color: "#fff", marginBottom: "0.75rem" }}>
              Welcome to your Study Dashboard
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                maxWidth: "460px",
                lineHeight: "1.6",
                fontSize: "0.95rem"
              }}
            >
              Upload PDF lecture notes or select an existing document from the left sidebar to generate summaries, perform keyword searches, and chat directly with your notes.
            </p>

            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                marginTop: "2rem",
                maxWidth: "600px"
              }}
            >
              {[
                { title: "AI Summarizer", desc: "Get an overview of key topics instantly" },
                { title: "Direct Chat", desc: "Ask specific queries to Gemini RAG" },
                { title: "Keyword Search", desc: "Find formulas and topics in notes quickly" }
              ].map((feature, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.01)",
                    border: "var(--border-glass)",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center"
                  }}
                >
                  <h4 style={{ fontSize: "0.9rem", color: "#fff", marginBottom: "0.3rem" }}>{feature.title}</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
