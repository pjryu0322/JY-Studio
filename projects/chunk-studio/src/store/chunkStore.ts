"use client";

import { create } from "zustand";
import { Chunk } from "@/types/chunk";

const MIN_TOKENS = 50;
const MAX_TOKENS = 2000;
const DEFAULT_MAX_TOKENS = 200;

function genId(i: number): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${i}`;
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function splitParagraphByMaxWords(paragraph: string, maxWords: number): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const result: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    result.push(words.slice(i, i + maxWords).join(" "));
  }
  return result;
}

interface ChunkState {
  inputText: string;
  chunks: Chunk[];
  selectedChunkId: string | null;
  maxTokens: number;
  setInputText: (text: string) => void;
  setMaxTokens: (n: number) => void;
  generateChunks: () => void;
  selectChunk: (id: string) => void;
  mergeWithNext: (id: string) => void;
  splitChunk: (id: string) => void;
  deleteChunk: (id: string) => void;
  exportChunks: () => void;
}

export const useChunkStore = create<ChunkState>((set, get) => ({
  inputText: "",
  chunks: [],
  selectedChunkId: null,
  maxTokens: DEFAULT_MAX_TOKENS,

  setInputText: (text) => set({ inputText: text }),

  setMaxTokens: (n) =>
    set({ maxTokens: Math.min(MAX_TOKENS, Math.max(MIN_TOKENS, n)) }),

  generateChunks: () => {
    const text = get().inputText;
    const maxTokens = get().maxTokens;
    if (!text.trim()) return;

    const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const parts: string[] = [];
    for (const p of rawParagraphs) {
      const count = wordCount(p);
      if (count <= maxTokens) {
        parts.push(p);
      } else {
        parts.push(...splitParagraphByMaxWords(p, maxTokens));
      }
    }

    const chunks: Chunk[] = parts.map((content, i) => ({
      id: genId(i),
      content,
      tokenCount: wordCount(content),
    }));
    set({ chunks, selectedChunkId: null });
  },

  selectChunk: (id) => set({ selectedChunkId: id }),

  mergeWithNext: (id) => {
    const { chunks } = get();
    const idx = chunks.findIndex((c) => c.id === id);
    if (idx < 0 || idx >= chunks.length - 1) return;
    const curr = chunks[idx];
    const next = chunks[idx + 1];
    const merged: Chunk = {
      id: genId(idx),
      content: [curr.content, next.content].join(" ").trim(),
      tokenCount: wordCount(curr.content + " " + next.content),
    };
    const nextChunks = [
      ...chunks.slice(0, idx),
      merged,
      ...chunks.slice(idx + 2),
    ];
    set({
      chunks: nextChunks,
      selectedChunkId: get().selectedChunkId === next.id ? merged.id : get().selectedChunkId,
    });
  },

  splitChunk: (id) => {
    const { chunks } = get();
    const idx = chunks.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const ch = chunks[idx];
    const words = ch.content.trim().split(/\s+/);
    const half = Math.floor(words.length / 2);
    const left = words.slice(0, half).join(" ");
    const right = words.slice(half).join(" ");
    const leftChunk: Chunk = {
      id: genId(idx),
      content: left,
      tokenCount: wordCount(left),
    };
    const rightChunk: Chunk = {
      id: genId(idx + 1),
      content: right,
      tokenCount: wordCount(right),
    };
    const nextChunks = [
      ...chunks.slice(0, idx),
      leftChunk,
      rightChunk,
      ...chunks.slice(idx + 1),
    ];
    set({
      chunks: nextChunks,
      selectedChunkId: id === get().selectedChunkId ? leftChunk.id : get().selectedChunkId,
    });
  },

  deleteChunk: (id) => {
    const { chunks, selectedChunkId } = get();
    const idx = chunks.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const nextChunks = chunks.filter((c) => c.id !== id);
    let nextSelected = selectedChunkId;
    if (selectedChunkId === id) {
      nextSelected = nextChunks[idx]?.id ?? nextChunks[idx - 1]?.id ?? null;
    }
    set({ chunks: nextChunks, selectedChunkId: nextSelected });
  },

  exportChunks: () => {
    const { chunks, maxTokens } = get();
    const payload = {
      maxTokens,
      createdAt: new Date().toISOString(),
      chunks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chunks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
