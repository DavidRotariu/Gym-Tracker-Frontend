import { createSeedData, type MockDB } from "./data";

const STORAGE_KEY = "overload_mock_db";

let cache: MockDB | null = null;

export function getDb(): MockDB {
  if (cache) return cache;
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as MockDB;
      return cache;
    }
  }
  cache = createSeedData();
  saveDb(cache);
  return cache;
}

export function saveDb(db: MockDB): void {
  cache = db;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

export function resetDb(): MockDB {
  const fresh = createSeedData();
  saveDb(fresh);
  return fresh;
}
