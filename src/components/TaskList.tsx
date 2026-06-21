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
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const result = await invoke<Task[]>("list_tasks");
      setTasks(result);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    let unlisten: Promise<() => void> | null = null;
    if ((window as any).__TAURI_INTERNALS__) {
      unlisten = listen("achievement", () => {
        loadTasks();
      });
    }
    return () => {
      unlisten?.then((fn) => fn()).catch(() => {});
    };
  }, [loadTasks]);

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
                  <div className="task-title">{task.title}</div>
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
