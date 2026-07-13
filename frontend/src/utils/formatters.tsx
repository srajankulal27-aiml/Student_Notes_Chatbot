import React from "react";
import { Sparkles } from "lucide-react";
import { ContentBlock } from "../types";

export const safeBase64 = (str: string): string => {
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

export function parseContentToBlocks(content: string): ContentBlock[] {
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

export function formatMessageContent(content: string): React.ReactNode {
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
