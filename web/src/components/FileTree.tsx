import React from "react";
import type { FileTreeNode } from "../api/client";

interface FileTreeProps {
  nodes: FileTreeNode[];
  onSelect: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: "🔷", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    json: "📋", md: "📝", css: "🎨", html: "🌐",
    env: "🔑", lock: "🔒", test: "🧪", spec: "🧪",
  };
  return <span className="text-xs">{icons[ext ?? ""] ?? "📄"}</span>;
}

export function FileTree({ nodes, onSelect, selectedPath, depth = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    // auto-expand first 2 levels
    nodes.forEach((n) => { if (n.type === "directory") s.add(n.path); });
    return s;
  });

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.type === "directory" ? (
            <>
              <button
                onClick={() => toggle(node.path)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                <span className="text-xs text-gray-500">
                  {expanded.has(node.path) ? "▾" : "▸"}
                </span>
                <span className="text-xs">📁</span>
                <span className="truncate">{node.name}</span>
              </button>
              {expanded.has(node.path) && node.children && (
                <FileTree
                  nodes={node.children}
                  onSelect={onSelect}
                  selectedPath={selectedPath}
                  depth={depth + 1}
                />
              )}
            </>
          ) : (
            <button
              onClick={() => onSelect(node.path)}
              className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                selectedPath === node.path
                  ? "bg-indigo-900/50 text-indigo-200"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FileIcon name={node.name} />
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
