import { useState } from "react";
import { TaskList } from "./components/TaskList";
import { Garden } from "./components/Garden";
import { Gallery } from "./components/Gallery";
import { Settings } from "./components/Settings";
import "./App.css";

type Page = "tasks" | "garden" | "gallery" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("tasks");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>terra</h1>
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
        <button
          className={`nav-item ${currentPage === "settings" ? "active" : ""}`}
          onClick={() => setCurrentPage("settings")}
        >
          設定
        </button>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <h2>
            {currentPage === "tasks" && "タスク管理"}
            {currentPage === "garden" && "箱庭"}
            {currentPage === "gallery" && "凍結ギャラリー"}
            {currentPage === "settings" && "設定"}
          </h2>
        </div>
        <div className="page-body">
          {currentPage === "tasks" && <TaskList />}
          {currentPage === "garden" && <Garden />}
          {currentPage === "gallery" && <Gallery />}
          {currentPage === "settings" && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;
