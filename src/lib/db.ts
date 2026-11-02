import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

/**
 * Banco local (fonte da verdade). Funciona sem internet; a sincronização com a
 * conta (Firebase) só lê/escreve linhas com `dirty = 1` ou `updated_at` novo.
 *
 * Todas as tabelas sincronizáveis têm: id TEXT, updated_at INTEGER (ms),
 * deleted INTEGER (apagado lógico) e dirty INTEGER (por enviar).
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS bars (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS drinks (
    id TEXT PRIMARY KEY NOT NULL,
    bar_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    last_price REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS nights (
    id TEXT PRIMARY KEY NOT NULL,
    bar_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS night_prices (
    id TEXT PRIMARY KEY NOT NULL,
    night_id TEXT NOT NULL,
    drink_id TEXT NOT NULL,
    price REAL NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS consumptions (
    id TEXT PRIMARY KEY NOT NULL,
    night_id TEXT NOT NULL,
    drink_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_drinks_bar ON drinks(bar_id);
  CREATE INDEX IF NOT EXISTS idx_nights_bar ON nights(bar_id);
  CREATE INDEX IF NOT EXISTS idx_nights_started ON nights(started_at);
  CREATE INDEX IF NOT EXISTS idx_prices_night ON night_prices(night_id);
  CREATE INDEX IF NOT EXISTS idx_cons_night ON consumptions(night_id);
  `,
];

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[version]);
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('bebida.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export const SYNC_TABLES = ['bars', 'drinks', 'nights', 'night_prices', 'consumptions'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export function newId(): string {
  return Crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

/* ---------- Avisos de alteração para os ecrãs se atualizarem ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitDataChanged() {
  listeners.forEach((fn) => fn());
}
