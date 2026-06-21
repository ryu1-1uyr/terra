import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TaskCreateDialog } from "./TaskCreateDialog";
import "./TaskList.css";

interface Task {
  id: string;
  title: string;
  created_at: string;
  processes: string[];
  achieved_today: boolean;
  total_achievements: number;
  daily: boolean;
  current_streak: number;
}

interface AchievementRecord {
  id: number;
  task_id: string;
  task_title: string;
  achieved_date: string;
  detected_at: string;
  duration_secs: number | null;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}秒`;
  if (secs < 3600) return `${Math.floor(secs / 60)}分`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const result = await invoke<Task[]>("list_tasks");
      setTasks(result);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
  }, []);

  const loadAchievements = useCallback(async () => {
    try {
      const result = await invoke<AchievementRecord[]>("get_achievements");
      setAchievements(result);
    } catch {
      // Tauri IPC unavailable
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadAchievements();
    let unlisten: Promise<() => void> | null = null;
    if ((window as any).__TAURI_INTERNALS__) {
      unlisten = listen("achievement", () => {
        loadTasks();
        loadAchievements();
      });
    }
    return () => {
      unlisten?.then((fn) => fn()).catch(() => {});
    };
  }, [loadTasks, loadAchievements]);

  const handleDelete = async (taskId: string, title: string) => {
    if (!confirm(`「${title}」を削除する？`)) return;
    try {
      await invoke("delete_task", { taskId });
      await loadTasks();
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  };

  return (
    <div className="task-list">
      <div className="task-list-toolbar">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + タスクを追加
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="placeholder">
          <div className="placeholder-icon">✅</div>
          <div className="placeholder-text">
            タスクを追加して、プロセス監視で達成を記録しよう
          </div>
        </div>
      ) : (
        <div className="task-cards">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`task-card ${task.achieved_today ? "achieved" : ""}`}
            >
              <div className="task-card-header">
                <div className="task-status">
                  {task.achieved_today ? (
                    <span className="status-dot achieved" />
                  ) : (
                    <span className="status-dot pending" />
                  )}
                </div>
                <div className="task-info">
                  <div className="task-title-row">
                    <span className="task-title">{task.title}</span>
                    {task.daily && (
                      <span className="task-badge-daily">DAILY</span>
                    )}
                  </div>
                  <div className="task-meta">
                    {task.processes.length > 0 && (
                      <span className="task-processes">
                        {task.processes.join(", ")}
                      </span>
                    )}
                    {task.total_achievements > 0 && (
                      <span className="task-streak">
                        {task.total_achievements}日達成
                      </span>
                    )}
                    {task.daily && task.current_streak > 0 && (
                      <span className="task-streak-fire">
                        {task.current_streak}日連続
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(task.id, task.title)}
                  title="削除"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="achievement-log-section">
        <button
          className="btn-toggle-log"
          onClick={() => setShowLog(!showLog)}
        >
          {showLog ? "▼" : "▶"} 達成ログ ({achievements.length})
        </button>
        {showLog && (
          <div className="achievement-log">
            {achievements.length === 0 ? (
              <div className="log-empty">まだ達成記録がないよ</div>
            ) : (
              achievements.map((a) => (
                <div key={a.id} className="log-entry">
                  <span className="log-date">{a.achieved_date}</span>
                  <span className="log-title">{a.task_title}</span>
                  {a.duration_secs != null && (
                    <span className="log-duration">
                      {formatDuration(a.duration_secs)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <TaskCreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
