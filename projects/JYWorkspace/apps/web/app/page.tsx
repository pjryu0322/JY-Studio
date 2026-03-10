import { webConfig } from "../lib/config";

const sections = [
  {
    id: "meeting",
    label: "Meeting",
    description: "Prepare the browser meeting experience powered by LiveKit Managed Cloud."
  },
  {
    id: "chat",
    label: "Chat",
    description: "Reserve a shared conversation area for rooms, threads, and participant messaging."
  },
  {
    id: "documents",
    label: "Documents",
    description: "Plan document upload, sharing, and collaborative review workflows."
  },
  {
    id: "translation",
    label: "Translation",
    description: "Outline real-time subtitles and translated voice playback surfaces."
  }
] as const;

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Collaboration Platform MVP</p>
        <h1>JYWorkspace MVP</h1>
        <p className="lead">
          A browser-based workspace for meetings, chat, shared documents, and multilingual communication.
        </p>
        <p className="meta">
          Server: {webConfig.serverUrl} ¡¤ Storage mode: {webConfig.storageMode}
        </p>
      </section>

      <section className="grid" aria-label="Future platform sections">
        {sections.map((section) => (
          <article className="card" key={section.id}>
            <h2>{section.label}</h2>
            <p>{section.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}