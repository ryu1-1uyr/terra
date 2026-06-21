import { useState, useEffect } from "react";
import { TaskList } from "./components/TaskList";
import { Garden } from "./components/Garden";
import { Gallery } from "./components/Gallery";
import { Settings } from "./components/Settings";
import "./App.css";

type Page = "home" | "gallery" | "settings";

interface UpdateInfo {
  version: string;
  installing: boolean;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        setUpdateInfo({ version: update.version, installing: false });
      }
    } catch {
      // Updater not available (e.g. dev mode, no pubkey configured)
    }
  };

  const handleUpdate = async () => {
    try {
      setUpdateInfo((prev) => (prev ? { ...prev, installing: true } : null));
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      }
    } catch {
      setUpdateInfo((prev) =>
        prev ? { ...prev, installing: false } : null
      );
    }
  };

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

      {updateInfo && (
        <div className="update-banner">
          <span>v{updateInfo.version} が利用可能</span>
          <button
            className="btn-update"
            onClick={handleUpdate}
            disabled={updateInfo.installing}
          >
            {updateInfo.installing ? "更新中..." : "更新する"}
          </button>
          <button
            className="btn-update-dismiss"
            onClick={() => setUpdateInfo(null)}
          >
            ×
          </button>
        </div>
      )}
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
