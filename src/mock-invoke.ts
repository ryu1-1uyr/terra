import { invoke as tauriInvoke } from "@tauri-apps/api/core";

const isTauri = !!(window as any).__TAURI_INTERNALS__;

interface MockInventoryItem {
  id: number;
  item_type: string;
  item_variant: string | null;
  obtained_at: string;
  placed: boolean;
}

interface MockGardenObject {
  id: number;
  inventory_id: number;
  item_type: string;
  grid_x: number;
  grid_z: number;
  growth_stage: number;
  random_seed: number;
}

interface MockTask {
  id: string;
  title: string;
  created_at: string;
  processes: string[];
  achieved_today: boolean;
  tracking: boolean;
  total_achievements: number;
  daily: boolean;
  current_streak: number;
}

interface MockAchievement {
  id: number;
  task_id: string;
  task_title: string;
  achieved_date: string;
  detected_at: string;
  duration_secs: number | null;
}

let nextId = 100;

const store = {
  inventory: [
    { id: 1, item_type: "house", item_variant: null, obtained_at: "2026-06-01T00:00:00Z", placed: false },
    { id: 2, item_type: "tree", item_variant: null, obtained_at: "2026-06-01T00:00:00Z", placed: false },
    { id: 3, item_type: "flower", item_variant: null, obtained_at: "2026-06-01T00:00:00Z", placed: false },
    { id: 4, item_type: "lamp", item_variant: null, obtained_at: "2026-06-02T00:00:00Z", placed: true },
    { id: 5, item_type: "shrine", item_variant: null, obtained_at: "2026-06-02T00:00:00Z", placed: true },
    { id: 6, item_type: "pond", item_variant: null, obtained_at: "2026-06-03T00:00:00Z", placed: false },
  ] as MockInventoryItem[],

  gardenObjects: [
    { id: 1, inventory_id: 4, item_type: "lamp", grid_x: 2, grid_z: 3, growth_stage: 0, random_seed: 42 },
    { id: 2, inventory_id: 5, item_type: "shrine", grid_x: 5, grid_z: 4, growth_stage: 0, random_seed: 77 },
  ] as MockGardenObject[],

  tasks: [
    { id: "mock-1", title: "VS Code で開発", created_at: "2026-06-01T00:00:00Z", processes: ["code"], achieved_today: true, tracking: false, total_achievements: 12, daily: true, current_streak: 3 },
    { id: "mock-2", title: "Figma でデザイン", created_at: "2026-06-02T00:00:00Z", processes: ["figma"], achieved_today: false, tracking: true, total_achievements: 5, daily: true, current_streak: 0 },
  ] as MockTask[],

  achievements: [
    { id: 1, task_id: "mock-1", task_title: "VS Code で開発", achieved_date: "2026-06-22", detected_at: "2026-06-22T10:30:00Z", duration_secs: 3600 },
    { id: 2, task_id: "mock-1", task_title: "VS Code で開発", achieved_date: "2026-06-21", detected_at: "2026-06-21T14:00:00Z", duration_secs: 7200 },
  ] as MockAchievement[],

  season: {
    season_number: 1,
    days_elapsed: 3,
    should_wipe: false,
  },
};

function mockInvoke(cmd: string, args?: Record<string, any>): any {
  switch (cmd) {
    case "get_inventory":
      return store.inventory.map((i) => ({ ...i }));

    case "get_garden_objects":
      return store.gardenObjects.map((o) => ({ ...o }));

    case "get_season_info":
      return store.season;

    case "tick_growth":
      return null;

    case "check_and_grant_bonus":
      return [];

    case "place_item": {
      const { inventoryId, gridX, gridZ } = args!;
      const item = store.inventory.find((i) => i.id === inventoryId);
      if (!item) return null;
      item.placed = true;
      const obj: MockGardenObject = {
        id: nextId++,
        inventory_id: inventoryId,
        item_type: item.item_type,
        grid_x: gridX,
        grid_z: gridZ,
        growth_stage: 0,
        random_seed: Math.floor(Math.random() * 1000),
      };
      store.gardenObjects.push(obj);
      return null;
    }

    case "unplace_item": {
      const { inventoryId } = args!;
      store.gardenObjects = store.gardenObjects.filter(
        (o) => o.inventory_id !== inventoryId
      );
      const item = store.inventory.find((i) => i.id === inventoryId);
      if (item) item.placed = false;
      return null;
    }

    case "freeze_and_wipe":
      store.gardenObjects = [];
      store.inventory.forEach((i) => (i.placed = false));
      store.season.season_number++;
      store.season.days_elapsed = 0;
      return null;

    case "list_tasks":
      return store.tasks.map((t) => ({ ...t }));

    case "get_achievements":
      return store.achievements.map((a) => ({ ...a }));

    case "create_task": {
      const { title, processes } = args!;
      store.tasks.push({
        id: `mock-${nextId++}`,
        title,
        created_at: new Date().toISOString(),
        processes,
        achieved_today: false,
        tracking: false,
        total_achievements: 0,
        daily: true,
        current_streak: 0,
      });
      return null;
    }

    case "update_task": {
      const { taskId, input } = args!;
      const task = store.tasks.find((t) => t.id === taskId);
      if (task) {
        task.title = input.title;
        task.processes = input.processes;
      }
      return null;
    }

    case "delete_task": {
      const { taskId } = args!;
      store.tasks = store.tasks.filter((t) => t.id !== taskId);
      return null;
    }

    case "get_running_processes":
      return [
        { name: "code", pid: 1234 },
        { name: "chrome", pid: 5678 },
        { name: "figma", pid: 9012 },
        { name: "slack", pid: 3456 },
      ];

    case "list_frozen_gardens":
      return [];

    case "get_grid_size":
      return 8;

    case "set_grid_size":
      return null;

    default:
      console.warn(`[mock] unhandled command: ${cmd}`);
      return null;
  }
}

export async function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(cmd, args);
  }
  await new Promise((r) => setTimeout(r, 50));
  return mockInvoke(cmd, args) as T;
}
