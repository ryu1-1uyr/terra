use serde::Serialize;
use sysinfo::System;

#[derive(Debug, Serialize, Clone)]
pub struct RunningProcess {
    pub name: String,
    pub pid: u32,
}

pub fn list_running_processes() -> Vec<RunningProcess> {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_string();
        if seen.insert(name.clone()) {
            result.push(RunningProcess {
                name,
                pid: pid.as_u32(),
            });
        }
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result
}

pub fn is_process_running(target: &str) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let target_lower = target.to_lowercase();
    sys.processes().values().any(|p| {
        p.name().to_string_lossy().to_lowercase() == target_lower
    })
}
