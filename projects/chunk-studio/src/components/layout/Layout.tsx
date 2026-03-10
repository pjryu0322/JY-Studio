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
    <section className="app-layout" aria-label="Chunk Studio Job Workbench">
      <div aria-label="Top Navigation and Actions">
        <TopBar />
      </div>
      <div className="app-layout__body">
        <div aria-label="Left Structure Navigation Panel">
          <Sidebar />
        </div>
        <div aria-label="Center Preview Panel">
          <PreviewArea />
        </div>
        <div aria-label="Right Chunk Review Panel">
          <ChunkPanel />
        </div>
      </div>
    </section>
  );
}
