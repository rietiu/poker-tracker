import { openDB } from 'idb';

const DB_NAME = 'poker-tracker';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore('players', { keyPath: 'id' });
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('date', 'date');
    const hands = db.createObjectStore('hands', { keyPath: 'id' });
    hands.createIndex('sessionId', 'sessionId');
    hands.createIndex('createdAt', 'createdAt');
  },
});

// Generic helpers
export async function getAll(store) {
  const db = await dbPromise;
  return db.getAll(store);
}

export async function get(store, id) {
  const db = await dbPromise;
  return db.get(store, id);
}

export async function put(store, item) {
  const db = await dbPromise;
  return db.put(store, item);
}

export async function del(store, id) {
  const db = await dbPromise;
  return db.delete(store, id);
}

// Specialized queries
export async function getHandsBySession(sessionId) {
  const db = await dbPromise;
  return db.getAllFromIndex('hands', 'sessionId', sessionId);
}

export async function getAllHandsSorted() {
  const db = await dbPromise;
  const all = await db.getAll('hands');
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getSessionsSorted() {
  const db = await dbPromise;
  const all = await db.getAll('sessions');
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
