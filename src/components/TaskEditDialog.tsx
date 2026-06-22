import { useState, useEffect } from "react";
import { invoke } from "../mock-invoke";
import "./TaskCreateDialog.css";

interface RunningProcess {
  name: string;
  pid: number;
}

interface Props {
  taskId: string;
  initialTitle: string;
  initialProcesses: string[];
  onClose: () => void;
  onUpdated: () => void;
}

export function TaskEditDialog({
  taskId,
  initialTitle,
  initialProcesses,
  onClose,
  onUpdated,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [selectedProcesses, setSelectedProcesses] =
    useState<string[]>(initialProcesses);
  const [runningProcesses, setRunningProcesses] = useState<RunningProcess[]>([]);
  const [processFilter, setProcessFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    try {
      const result = await invoke<RunningProcess[]>("get_running_processes");
      setRunningProcesses(result);
    } catch (e) {
      console.error("Failed to load processes:", e);
    }
  };

  const allProcessNames = new Set(runningProcesses.map((p) => p.name));
  for (const p of initialProcesses) allProcessNames.add(p);

  const filteredProcesses = runningProcesses.filter((p) =>
    p.name.toLowerCase().includes(processFilter.toLowerCase())
  );

  const toggleProcess = (name: string) => {
    setSelectedProcesses((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await invoke("update_task", {
        taskId,
        input: {
          title: title.trim(),
          processes: selectedProcesses,
        },
      });
      onUpdated();
    } catch (e) {
      console.error("Failed to update task:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>タスクを編集</h3>
          <button className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          <label className="field-label">タスク名</label>
          <input
            className="field-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <label className="field-label">
            監視するプロセス
            <span className="field-hint">
              （起動中のプロセスから選択。どれか1つでも起動すれば達成）
            </span>
          </label>

          <div className="process-picker">
            <input
              className="field-input"
              type="text"
              placeholder="プロセス名で絞り込み..."
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
            />
            <button
              className="btn-refresh"
              onClick={loadProcesses}
              title="プロセス一覧を更新"
            >
              ↻
            </button>
          </div>

          {selectedProcesses.length > 0 && (
            <div className="selected-processes">
              {selectedProcesses.map((name) => (
                <span key={name} className="process-tag selected">
                  {name}
                  <button onClick={() => toggleProcess(name)}>×</button>
                </span>
              ))}
            </div>
          )}

          <div className="process-list">
            {filteredProcesses.map((p) => (
              <button
                key={p.name}
                className={`process-item ${selectedProcesses.includes(p.name) ? "selected" : ""}`}
                onClick={() => toggleProcess(p.name)}
              >
                <span className="process-name">{p.name}</span>
                <span className="process-pid">PID {p.pid}</span>
              </button>
            ))}
            {filteredProcesses.length === 0 && (
              <div className="process-empty">
                {processFilter
                  ? "該当するプロセスがないよ"
                  : "プロセスを読み込み中..."}
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || loading}
          >
            {loading ? "更新中..." : "更新"}
          </button>
        </div>
      </div>
    </div>
  );
}
