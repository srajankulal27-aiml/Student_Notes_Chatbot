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
  History,
  Share2,
  Edit2
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface ContentBlock {
  type: "text" | "code" | "mermaid" | "image";
  content: string;
  language?: string;
  alt?: string;
  url?: string;
}

const safeBase64 = (str: string): string => {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
  } catch (e) {
    return btoa(str);
  }
};

function parseContentToBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < content.length) {
    const remaining = content.substring(currentIndex);
    const codeBlockMatch = remaining.match(/```(\w*)\n([\s\S]*?)\n?```/);
    const imageMatch = remaining.match(/!\[(.*?)\]\((.*?)\)/);

    let nextMatch: {
      type: "code" | "image";
      index: number;
      length: number;
      matchObj: RegExpMatchArray;
    } | null = null;

    if (codeBlockMatch && codeBlockMatch.index !== undefined) {
      nextMatch = {
        type: "code",
        index: codeBlockMatch.index,
        length: codeBlockMatch[0].length,
        matchObj: codeBlockMatch
      };
    }

    if (imageMatch && imageMatch.index !== undefined) {
      if (!nextMatch || imageMatch.index < nextMatch.index) {
        nextMatch = {
          type: "image",
          index: imageMatch.index,
          length: imageMatch[0].length,
          matchObj: imageMatch
        };
      }
    }

    if (!nextMatch) {
      const text = remaining;
      if (text) {
        blocks.push({ type: "text", content: text });
      }
      break;
    }

    if (nextMatch.index > 0) {
      const text = remaining.substring(0, nextMatch.index);
      if (text) {
        blocks.push({ type: "text", content: text });
      }
    }

    if (nextMatch.type === "code") {
      const lang = nextMatch.matchObj[1]?.toLowerCase() || "text";
      const codeContent = nextMatch.matchObj[2];
      blocks.push({
        type: lang === "mermaid" ? "mermaid" : "code",
        content: codeContent,
        language: lang
      });
    } else {
      const alt = nextMatch.matchObj[1];
      const url = nextMatch.matchObj[2];
      blocks.push({
        type: "image",
        content: "",
        alt,
        url
      });
    }

    currentIndex += nextMatch.index + nextMatch.length;
  }

  return blocks;
}

function formatMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  const parseInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*([\s\S]*?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={`bold-${match.index}-${keyIdx++}`}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  };

  const renderTextBlock = (text: string, blockIdx: number) => {
    const lines = text.split("\n");
    return (
      <div key={`text-block-${blockIdx}`} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          
          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} style={{ margin: "0.8rem 0 0.4rem 0", color: "#fff", fontWeight: 600, fontSize: "0.95rem" }}>
                {parseInline(trimmed.substring(4))}
              </h4>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={idx} style={{ margin: "1rem 0 0.5rem 0", color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>
                {parseInline(trimmed.substring(3))}
              </h3>
            );
          }
          if (trimmed.startsWith("# ")) {
            return (
              <h2 key={idx} style={{ margin: "1.2rem 0 0.6rem 0", color: "#fff", fontWeight: 700, fontSize: "1.25rem" }}>
                {parseInline(trimmed.substring(2))}
              </h2>
            );
          }
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <li key={idx} style={{ marginLeft: "1.2rem", marginBottom: "0.2rem", listStyleType: "disc" }}>
                {parseInline(trimmed.substring(2))}
              </li>
            );
          }
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <li key={idx} style={{ marginLeft: "1.2rem", marginBottom: "0.2rem", listStyleType: "decimal" }}>
                {parseInline(numMatch[2])}
              </li>
            );
          }
          if (trimmed === "") {
            return <div key={idx} style={{ height: "0.3rem" }} />;
          }
          return (
            <p key={idx} style={{ margin: 0, lineHeight: "1.5" }}>
              {parseInline(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const blocks = parseContentToBlocks(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      {blocks.map((block, idx) => {
        if (block.type === "text") {
          return renderTextBlock(block.content, idx);
        }
        
        if (block.type === "mermaid") {
          let mermaidCode = block.content.trim();
          if (!mermaidCode.includes("%%{init")) {
            mermaidCode = `%%{init: {'theme': 'dark'}}%%\n` + mermaidCode;
          }
          const base64 = safeBase64(mermaidCode);
          const diagramUrl = `https://mermaid.ink/img/${base64}?bgColor=131622`;
          
          return (
            <div
              key={`mermaid-${idx}`}
              className="glass-panel"
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(19, 22, 34, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
                width: "100%",
                maxWidth: "100%",
                overflowX: "auto",
                margin: "0.5rem 0"
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Sparkles size={12} color="var(--color-accent-indigo)" />
                  AI Concept Diagram
                </span>
                <a
                  href={diagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--color-accent-indigo)",
                    textDecoration: "none",
                    background: "rgba(99, 102, 241, 0.1)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "var(--radius-sm)"
                  }}
                >
                  View Fullscreen
                </a>
              </div>
              <img
                src={diagramUrl}
                alt="AI Generated Diagram"
                style={{
                  maxWidth: "100%",
                  maxHeight: "450px",
                  objectFit: "contain",
                  background: "#131622",
                  borderRadius: "var(--radius-sm)",
                  padding: "1rem"
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const nextSib = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextSib) nextSib.style.display = "block";
                }}
              />
              <div style={{ display: "none", color: "var(--color-danger)", fontSize: "0.8rem", textAlign: "center", width: "100%" }}>
                Failed to render diagram. Raw syntax:
                <pre style={{ textAlign: "left", fontSize: "0.75rem", background: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "4px", marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                  {block.content}
                </pre>
              </div>
            </div>
          );
        }

        if (block.type === "image") {
          return (
            <div
              key={`image-${idx}`}
              className="glass-panel"
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(19, 22, 34, 0.4)",
                border: "var(--border-glass)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                margin: "0.5rem 0",
                width: "100%"
              }}
            >
              <div style={{ width: "100%", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Sparkles size={12} color="var(--color-accent-purple)" />
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>AI Generated Illustration</span>
              </div>
              <img
                src={block.url}
                alt={block.alt || "AI generated visualization"}
                style={{
                  maxWidth: "100%",
                  maxHeight: "450px",
                  borderRadius: "var(--radius-sm)",
                  objectFit: "contain",
                  boxShadow: "var(--shadow-md)"
                }}
              />
              {block.alt && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontStyle: "italic", textAlign: "center" }}>
                  {block.alt}
                </span>
              )}
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={`code-${idx}`}
              style={{
                background: "rgba(10, 12, 22, 0.75)",
                border: "var(--border-glass)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                overflowX: "auto",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                color: "#e2e8f0",
                margin: "0.5rem 0",
                width: "100%"
              }}
            >
              <code>{block.content}</code>
            </pre>
          );
        }

        return null;
      })}
    </div>
  );
}


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

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  document_id: number;
  user_id: number;
  share_code: string | null;
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
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [sharingSessionCode, setSharingSessionCode] = useState<string | null>(null);
  const [pendingShareCode, setPendingShareCode] = useState<string | null>(
    new URLSearchParams(window.location.search).get("share")
  );
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState("");

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

  // Fetch sessions and reset tabs on doc change
  useEffect(() => {
    if (selectedDocId && token) {
      fetchChatSessions(selectedDocId);
      setActiveTab("summary");
      setSearchQuery("");
      setSearchResults([]);
    } else {
      setChatSessions([]);
      setSelectedSessionId(null);
    }
  }, [selectedDocId]);

  // Load chat history when selected session changes
  useEffect(() => {
    if (selectedSessionId && token) {
      fetchChatHistory(selectedSessionId);
    } else {
      setChatHistory([]);
    }
  }, [selectedSessionId]);

  // Handle URL share code on login / page load
  useEffect(() => {
    const handlePendingShare = async () => {
      if (token && pendingShareCode) {
        try {
          const joinRes = await fetch(`${API_BASE}/chat/session/join/${pendingShareCode}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (joinRes.ok) {
            const joinData = await joinRes.json();
            const sessionId = joinData.session_id;
            
            const detailsRes = await fetch(`${API_BASE}/chat/session/share/${pendingShareCode}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (detailsRes.ok) {
              const sessionDetails = await detailsRes.json();
              
              await fetchDocuments();
              
              setPendingShareCode(null);
              window.history.replaceState({}, document.title, window.location.pathname);
              
              setSelectedDocId(sessionDetails.document_id);
              setSelectedSessionId(sessionId);
              setActiveTab("chat");
            }
          }
        } catch (err) {
          console.error("Pending share error:", err);
        }
      }
    };
    handlePendingShare();
  }, [token, pendingShareCode]);

  // Fetch chat sessions for a document
  const fetchChatSessions = async (docId: number) => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data);
        if (data.length > 0) {
          const stillExists = data.some((s: ChatSession) => s.id === selectedSessionId);
          if (!stillExists) {
            setSelectedSessionId(data[0].id);
          }
        } else {
          setSelectedSessionId(null);
        }
      }
    } catch (err) {
      console.error("Sessions fetch error:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Fetch chat history for selected session
  const fetchChatHistory = async (sessionId: number) => {
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat/history/${sessionId}`, {
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
  // Chat actions
  const handleCreateSession = async (title?: string) => {
    if (!selectedDocId || !token) return;
    try {
      const res = await fetch(`${API_BASE}/chat/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          document_id: selectedDocId,
          title: title || `Chat Session ${chatSessions.length + 1}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions((prev) => [data, ...prev]);
        setSelectedSessionId(data.id);
        setActiveTab("chat");
      }
    } catch (err) {
      console.error("Create session error:", err);
    }
  };

  const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    try {
      const res = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
        }
      }
    } catch (err) {
      console.error("Delete session error:", err);
    }
  };

  const handleShareSession = async (sessionId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/chat/session/${sessionId}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, share_code: data.share_code } : s))
        );
        setSharingSessionCode(data.share_code);
        setIsSharingModalOpen(true);
      }
    } catch (err) {
      console.error("Share session error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSessionId || sendingMessage) return;

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
          session_id: selectedSessionId
        })
      });

      if (res.status === 401) {
        alert("Your session has expired. Please log in again.");
        handleLogout();
        return;
      }

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

  const handleClearHistory = async () => {
    if (!selectedSessionId) return;
    if (!confirm("Clear your conversation history for this session?")) return;

    try {
      const res = await fetch(`${API_BASE}/chat/history/${selectedSessionId}`, {
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

const handleDownloadPDF = (docId: number) => {
  window.open(
    `${API_BASE}/documents/${docId}/download?token=${encodeURIComponent(token || "")}`,
    "_blank"
  );
};

  const handleSaveRename = async (sessionId: number) => {
    if (!renameTitleInput.trim() || !token) {
      setRenamingSessionId(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: renameTitleInput.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setChatSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s))
        );
      }
    } catch (err) {
      console.error("Rename session error:", err);
    } finally {
      setRenamingSessionId(null);
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
                      <div className="summary-markdown">
                        {formatMessageContent(activeDoc.summary)}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "3rem 1rem" }}>
                        <RefreshCw className="animate-float" size={32} color="var(--color-accent-purple)" style={{ animation: "skeleton-shimmer 2s infinite" }} />
                        <p style={{ color: "var(--color-text-secondary)" }}>
                          RAG AI is summarizing notes details...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden" }}>
                  {/* Left Chat sessions list sidebar */}
                  <div
                    style={{
                      width: "240px",
                      background: "rgba(10, 12, 22, 0.4)",
                      borderRight: "var(--border-glass)",
                      display: "flex",
                      flexDirection: "column",
                      padding: "1.25rem 1rem",
                      flexShrink: 0,
                      height: "100%",
                      overflowY: "auto"
                    }}
                  >
                    <button
                      onClick={() => handleCreateSession()}
                      className="btn-primary"
                      style={{
                        marginBottom: "1rem",
                        fontSize: "0.85rem",
                        padding: "0.6rem 0.8rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        width: "100%"
                      }}
                    >
                      <Sparkles size={14} />
                      <span>New Chat</span>
                    </button>

                    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {sessionsLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem 0" }}>
                          <RefreshCw size={18} color="var(--color-accent-indigo)" style={{ animation: "skeleton-shimmer 1.5s infinite" }} />
                        </div>
                      ) : chatSessions.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.75rem", padding: "1.5rem 0" }}>
                          No active chats. Start one now!
                        </div>
                      ) : (
                        chatSessions.map((session) => {
                          const isSelected = session.id === selectedSessionId;
                          return (
                            <div
                              key={session.id}
                              onClick={() => setSelectedSessionId(session.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.6rem 0.8rem",
                                borderRadius: "var(--radius-md)",
                                background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                                border: isSelected ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                                cursor: "pointer",
                                transition: "all var(--transition-fast)"
                              }}
                              onMouseOver={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                              }}
                              onMouseOut={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              {renamingSessionId === session.id ? (
                                <input
                                  type="text"
                                  value={renameTitleInput}
                                  onChange={(e) => setRenameTitleInput(e.target.value)}
                                  onBlur={() => handleSaveRename(session.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveRename(session.id);
                                    if (e.key === "Escape") setRenamingSessionId(null);
                                  }}
                                  autoFocus
                                  style={{
                                    fontSize: "0.8rem",
                                    padding: "2px 4px",
                                    width: "120px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid var(--color-accent-indigo)",
                                    color: "#fff",
                                    borderRadius: "4px"
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize: "0.8rem",
                                    color: isSelected ? "#fff" : "var(--color-text-secondary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "110px",
                                    fontWeight: isSelected ? 500 : 400
                                  }}
                                >
                                  {session.title}
                                </span>
                              )}
                              
                              <div style={{ display: "flex", gap: "0.2rem", alignItems: "center" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingSessionId(session.id);
                                    setRenameTitleInput(session.title);
                                  }}
                                  style={{
                                    background: "transparent",
                                    color: "var(--color-text-muted)",
                                    border: "none",
                                    padding: "0.15rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center"
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.color = "var(--color-accent-indigo)"}
                                  onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-muted)"}
                                  title="Rename Chat"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareSession(session.id);
                                  }}
                                  style={{
                                    background: "transparent",
                                    color: "var(--color-text-muted)",
                                    border: "none",
                                    padding: "0.15rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center"
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.color = "var(--color-accent-indigo)"}
                                  onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-muted)"}
                                  title="Share Chat"
                                >
                                  <Share2 size={12} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  style={{
                                    background: "transparent",
                                    color: "var(--color-text-muted)",
                                    border: "none",
                                    padding: "0.15rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center"
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.color = "var(--color-danger)"}
                                  onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-muted)"}
                                  title={session.user_id === user?.id ? "Delete Chat" : "Leave Chat"}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Chat details pane */}
                  <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
                    {selectedSessionId ? (
                      <>
                        {/* Selected Session Header */}
                        <div
                          style={{
                            padding: "0.75rem 1.5rem",
                            borderBottom: "var(--border-glass)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "rgba(10, 12, 22, 0.2)",
                            flexShrink: 0
                          }}
                        >
                          <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {chatSessions.find((s) => s.id === selectedSessionId)?.title || "Conversing..."}
                          </span>
                          
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleShareSession(selectedSessionId)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontSize: "0.75rem",
                                color: "var(--color-text-secondary)",
                                background: "rgba(255,255,255,0.03)",
                                border: "var(--border-glass)",
                                padding: "0.4rem 0.8rem",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer"
                              }}
                              onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
                              onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
                            >
                              <Share2 size={12} />
                              <span>Share Link</span>
                            </button>
                            {chatSessions.find((s) => s.id === selectedSessionId)?.user_id === user?.id && (
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
                                  borderRadius: "var(--radius-md)",
                                  cursor: "pointer"
                                }}
                                onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
                                onMouseOut={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
                              >
                                <History size={12} />
                                <span>Clear History</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Messages Area */}
                        <div style={{ flexGrow: 1, overflowY: "auto", padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                          {chatLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                              <RefreshCw size={24} color="var(--color-accent-indigo)" style={{ animation: "skeleton-shimmer 1.5s infinite" }} />
                            </div>
                          ) : (
                            <>
                              {selectedSessionId && (() => {
                                const session = chatSessions.find((s) => s.id === selectedSessionId);
                                return session && session.user_id !== user?.id && activeDoc;
                              })() && (
                                <div
                                  className="glass-panel"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "1rem 1.25rem",
                                    borderRadius: "var(--radius-md)",
                                    background: "rgba(99, 102, 241, 0.04)",
                                    border: "1px dashed rgba(99, 102, 241, 0.3)",
                                    marginBottom: "0.5rem",
                                    flexShrink: 0
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <FileText size={20} color="var(--color-accent-indigo)" />
                                    <div>
                                      <div style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>Reference Notes</div>
                                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "250px" }}>
                                        {activeDoc.filename}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDownloadPDF(activeDoc.id, activeDoc.filename)}
                                    className="btn-primary"
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "0.4rem 0.8rem",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.3rem"
                                    }}
                                  >
                                    <UploadCloud size={14} style={{ transform: "rotate(180deg)" }} />
                                    <span>Download PDF</span>
                                  </button>
                                </div>
                              )}

                              {chatHistory.length === 0 ? null : (
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
                                            whiteSpace: isUser ? "pre-wrap" : undefined
                                          }}
                                        >
                                          {isUser ? msg.content : formatMessageContent(msg.content)}
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
                            </>
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

                        {/* Input Box */}
                        <form
                          onSubmit={handleSendMessage}
                          style={{
                            padding: "1.25rem 2rem",
                            borderTop: "var(--border-glass)",
                            background: "rgba(10, 12, 22, 0.4)",
                            display: "flex",
                            gap: "0.75rem",
                            alignItems: "center",
                            flexShrink: 0
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
                      </>
                    ) : (
                      <div style={{ margin: "auto", maxWidth: "480px", textAlign: "center", padding: "2rem" }}>
                        <HelpCircle size={40} color="var(--color-text-muted)" style={{ marginBottom: "1rem" }} />
                        <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>No Chat Selected</h4>
                        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                          Select an existing chat session from the left sidebar or click "+ New Chat" to start a new ChatGPT-style conversation on these study notes!
                        </p>
                        <button
                          onClick={() => handleCreateSession()}
                          className="btn-primary"
                          style={{
                            fontSize: "0.85rem",
                            padding: "0.6rem 1.2rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem"
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Start New Chat</span>
                        </button>
                      </div>
                    )}
                  </div>
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
                { title: "Direct Chat", desc: "Ask specific queries to RAG AI" },
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

      {/* SHARING MODAL DIALOG */}
      {isSharingModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem"
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "2rem",
              background: "rgba(15, 18, 30, 0.9)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.2rem" }}>
              <Share2 size={22} color="var(--color-accent-indigo)" />
              <h3 style={{ fontSize: "1.25rem", color: "#fff", margin: 0 }}>Share Chat Session</h3>
            </div>
            
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              Give this link to your friend! Once they log in, they can view your chat history and collaborate on this chatbot conversation with you in real time.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Shareable Link</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?share=${sharingSessionCode}`}
                  style={{
                    flexGrow: 1,
                    background: "rgba(255,255,255,0.03)",
                    border: "var(--border-glass)",
                    color: "var(--color-accent-indigo)",
                    fontSize: "0.8rem",
                    padding: "0.5rem 0.75rem"
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?share=${sharingSessionCode}`);
                    alert("Copied to clipboard!");
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setIsSharingModalOpen(false)}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "var(--border-glass)",
                  padding: "0.5rem 1.25rem",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: "0.85rem"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
