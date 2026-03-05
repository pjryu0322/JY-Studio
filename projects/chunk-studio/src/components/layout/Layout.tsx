import "./layout.css";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import ChunkPanel from "./ChunkPanel";

export default function Layout() {
  return (
    <div className="app-layout">
      <TopBar />
      <div className="app-layout__body">
        <Sidebar />
        <ChunkPanel />
      </div>
    </div>
  );
}
