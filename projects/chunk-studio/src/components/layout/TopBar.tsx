"use client";

import Link from "next/link";
import { useChunkStore } from "@/store/chunkStore";

export default function TopBar() {
  const generateChunks = useChunkStore((s) => s.generateChunks);
  const exportChunks = useChunkStore((s) => s.exportChunks);

  return (
    <header className="top-bar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/" className="top-bar__title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "inherit", textDecoration: "none" }}>
        Chunk Studio
      </Link>
      <Link href="/jobs" style={{ fontSize: 13, color: "#1565c0", textDecoration: "none" }}>
        작업 목록
      </Link>
      <button
        type="button"
        onClick={generateChunks}
        style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
      >
        Generate
      </button>
      <button
        type="button"
        onClick={exportChunks}
        style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
      >
        Export JSON
      </button>
    </header>
  );
}
