import { useState } from "react";
import { TaskList } from "./components/TaskList";
import { Garden } from "./components/Garden";
import { Gallery } from "./components/Gallery";
import "./App.css";

type Page = "tasks" | "garden" | "gallery";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("tasks");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>箱庭TODO</h1>
          <div className="subtitle">タスク × プロセス監視 × 箱庭</div>
        </div>
        <button
          className={`nav-item ${currentPage === "tasks" ? "active" : ""}`}
          onClick={() => setCurrentPage("tasks")}
        >
          タスク管理
        </button>
        <button
          className={`nav-item ${currentPage === "garden" ? "active" : ""}`}
          onClick={() => setCurrentPage("garden")}
        >
          箱庭
        </button>
        <button
          className={`nav-item ${currentPage === "gallery" ? "active" : ""}`}
          onClick={() => setCurrentPage("gallery")}
        >
          ギャラリー
        </button>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <h2>
            {currentPage === "tasks" && "タスク管理"}
            {currentPage === "garden" && "箱庭"}
            {currentPage === "gallery" && "凍結ギャラリー"}
          </h2>
        </div>
        <div className="page-body">
          {currentPage === "tasks" && <TaskList />}
          {currentPage === "garden" && <Garden />}
          {currentPage === "gallery" && <Gallery />}
        </div>
      </main>
    </div>
  );
}

export default App;
