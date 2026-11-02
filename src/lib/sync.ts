import { AppState } from 'react-native';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { SYNC_TABLES, emitDataChanged, getDb, getMeta, setMeta, type SyncTable } from './db';
import { getDbRemote, getFirebaseAuth } from './firebase';

/**
 * Sincronização "último a gravar ganha" entre o SQLite local e o Firestore:
 *   users/{uid}/{tabela}/{id}
 * - push: envia linhas com dirty = 1
 * - pull: traz documentos com synced_at (hora do servidor) maior que o último pull
 *   dessa tabela; usar a hora do servidor evita perder dados se os relógios dos
 *   telefones estiverem desacertados.
 * Os apagados são lógicos (deleted = 1), por isso também se propagam.
 */

const COLUMNS: Record<SyncTable, string[]> = {
  bars: ['id', 'name', 'created_at', 'updated_at', 'deleted'],
  drinks: ['id', 'bar_id', 'name', 'position', 'last_price', 'updated_at', 'deleted'],
  nights: ['id', 'bar_id', 'started_at', 'ended_at', 'updated_at', 'deleted'],
  night_prices: ['id', 'night_id', 'drink_id', 'price', 'updated_at', 'deleted'],
  consumptions: ['id', 'night_id', 'drink_id', 'created_at', 'updated_at', 'deleted'],
};

export type SyncStatus = {
  user: { uid: string; email: string | null } | null;
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt: number | null;
  error: string | null;
};

let status: SyncStatus = { user: null, state: 'off', lastSyncAt: null, error: null };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------ Push/pull ------------------------------ */

async function push(uid: string) {
  const remote = getDbRemote();
  if (!remote) return;
  const db = await getDb();
  for (const table of SYNC_TABLES) {
    const cols = COLUMNS[table];
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${cols.join(', ')} FROM ${table} WHERE dirty = 1`,
    );
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const batch = writeBatch(remote);
      for (const row of chunk) {
        batch.set(doc(remote, 'users', uid, table, String(row.id)), { ...row, synced_at: serverTimestamp() } as DocumentData);
      }
      await batch.commit();
      // Só limpa se a linha não mudou entretanto.
      for (const row of chunk) {
        await db.runAsync(
          `UPDATE ${table} SET dirty = 0 WHERE id = ? AND updated_at = ?`,
          row.id as string,
          row.updated_at as number,
        );
      }
    }
  }
}

async function pull(uid: string): Promise<boolean> {
  const remote = getDbRemote();
  if (!remote) return false;
  const db = await getDb();
  let anyChange = false;
  for (const table of SYNC_TABLES) {
    const cols = COLUMNS[table];
    const metaKey = `last_pull_${table}`;
    const since = Number((await getMeta(metaKey)) ?? '0');
    const snap = await getDocs(
      query(
        collection(remote, 'users', uid, table),
        where('synced_at', '>', Timestamp.fromMillis(since)),
        orderBy('synced_at'),
      ),
    );
    let maxSeen = since;
    for (const d of snap.docs) {
      const data = d.data();
      const remoteUpdated = Number(data.updated_at ?? 0);
      const syncedAt = data.synced_at instanceof Timestamp ? data.synced_at.toMillis() : 0;
      maxSeen = Math.max(maxSeen, syncedAt);
      const local = await db.getFirstAsync<{ updated_at: number; dirty: number }>(
        `SELECT updated_at, dirty FROM ${table} WHERE id = ?`,
        d.id,
      );
      if (local && local.updated_at >= remoteUpdated) continue;
      const values = cols.map((c) => (c === 'id' ? d.id : (data[c] ?? null)));
      await db.runAsync(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}, dirty) VALUES (${cols.map(() => '?').join(', ')}, 0)`,
        ...(values as (string | number | null)[]),
      );
      anyChange = true;
    }
    if (maxSeen > since) await setMeta(metaKey, String(maxSeen));
  }
  return anyChange;
}

let running: Promise<void> | null = null;

export async function syncNow(): Promise<void> {
  const uid = status.user?.uid;
  if (!uid) return;
  if (running) return running;
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      await push(uid);
      const changed = await pull(uid);
      if (changed) emitDataChanged();
      setStatus({ state: 'idle', lastSyncAt: Date.now() });
    } catch (e) {
      setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Pede uma sincronização daqui a uns segundos (agrupa vários toques). */
export function scheduleSync(delayMs = 4000) {
  if (!status.user) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}

/* ------------------------------- Conta -------------------------------- */

async function wipeLocal() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of SYNC_TABLES) await db.runAsync(`DELETE FROM ${t}`);
    await db.runAsync("DELETE FROM meta WHERE key LIKE 'last_pull_%' OR key = 'owner_uid'");
  });
  emitDataChanged();
}

async function handleUser(user: User | null) {
  if (!user) {
    setStatus({ user: null, state: 'off' });
    return;
  }
  const owner = await getMeta('owner_uid');
  if (owner && owner !== user.uid) {
    // Dados locais de outra conta: não os misturar.
    await wipeLocal();
  }
  await setMeta('owner_uid', user.uid);
  setStatus({ user: { uid: user.uid, email: user.email }, state: 'idle', error: null });
  await syncNow();
}

let started = false;

/** Chamado uma vez no arranque da app. */
export function startSync() {
  if (started) return;
  started = true;
  const auth = getFirebaseAuth();
  if (!auth) return;
  onAuthStateChanged(auth, (u) => void handleUser(u));
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow();
  });
}

/** Sai da conta: envia o que falta e limpa o telefone (os dados ficam na conta). */
export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await syncNow();
  if (status.state === 'error') {
    throw new Error('Não foi possível enviar os últimos dados. Liga a internet e tenta outra vez.');
  }
  await signOut(auth);
  await wipeLocal();
}
