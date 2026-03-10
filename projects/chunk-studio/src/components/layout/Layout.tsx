"use client";

import { useEffect } from "react";
import "./layout.css";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import PreviewArea from "./PreviewArea";
import ChunkPanel from "./ChunkPanel";
import { useJobStore } from "@/store/jobStore";

export default function Layout() {
  const refresh = useJobStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="app-layout">
      <div aria-label="Top Bar">
        <TopBar />
      </div>
      <div className="app-layout__body">
        <div aria-label="Left Panel">
          <Sidebar />
        </div>
        <div aria-label="Center Panel">
          <PreviewArea />
        </div>
        <div aria-label="Right Panel">
          <ChunkPanel />
        </div>
      </div>
    </div>
  );
}
