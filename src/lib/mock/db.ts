import { createSeedData, type MockDB } from "./data";

const STORAGE_KEY = "overload_mock_db";

// One in-memory copy per tab, shared by every handler in that tab (handlers
// read the db, await the request body, then write it back — separate copies
// would overwrite each other's changes). Another tab's write arrives as a
// `storage` event and drops this copy, so all tabs see one demo "server".
let cache: MockDB | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) cache = null;
  });
}

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
