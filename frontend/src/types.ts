export interface ContentBlock {
  type: "text" | "code" | "mermaid" | "image";
  content: string;
  language?: string;
  alt?: string;
  url?: string;
}

export interface Document {
  id: number;
  filename: string;
  filepath: string;
  summary: string | null;
  uploaded_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  document_id: number;
  user_id: number;
  share_code: string | null;
}

export interface SearchResult {
  id: number;
  chunk_index: number;
  content: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  created_at: string;
}
