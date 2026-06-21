import { useState } from "react";
import { TaskList } from "./components/TaskList";
import { Garden } from "./components/Garden";
import { Gallery } from "./components/Gallery";
import { Settings } from "./components/Settings";
import "./App.css";

type Page = "home" | "gallery" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>terra</h1>
        </div>
        <button
          className={`nav-item ${currentPage === "home" ? "active" : ""}`}
          onClick={() => setCurrentPage("home")}
        >
          ホーム
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
        {currentPage === "home" ? (
          <div className="home-layout">
            <div className="home-garden">
              <Garden />
            </div>
            <div className="home-tasks">
              <TaskList />
            </div>
          </div>
        ) : (
          <>
            <div className="page-header">
              <h2>
                {currentPage === "gallery" && "凍結ギャラリー"}
                {currentPage === "settings" && "設定"}
              </h2>
            </div>
            <div className="page-body">
              {currentPage === "gallery" && <Gallery />}
              {currentPage === "settings" && <Settings />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
