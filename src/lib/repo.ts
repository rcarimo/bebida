import { emitDataChanged, getDb, newId, now } from './db';
import { scheduleSync } from './sync';

export type Bar = { id: string; name: string; lastVisit: number | null; visits: number };
export type Drink = { id: string; barId: string; name: string; position: number; lastPrice: number };
export type Night = { id: string; barId: string; startedAt: number; endedAt: number | null };

export type NightDrink = {
  id: string;
  name: string;
  price: number;
  count: number;
};

export type NightDetail = Night & {
  barName: string;
  drinks: NightDrink[];
  total: number;
  totalDrinks: number;
};

/** Uma noite fecha sozinha se ficar este tempo sem nenhum registo. */
const AUTO_CLOSE_MS = 12 * 60 * 60 * 1000;

function changed() {
  emitDataChanged();
  scheduleSync();
}

/* ------------------------------- Bares ------------------------------- */

export async function listBars(): Promise<Bar[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; last_visit: number | null; visits: number }>(
    `SELECT b.id, b.name,
            MAX(n.started_at) AS last_visit,
            COUNT(n.id) AS visits
       FROM bars b
       LEFT JOIN nights n ON n.bar_id = b.id AND n.deleted = 0
      WHERE b.deleted = 0
      GROUP BY b.id
      ORDER BY (last_visit IS NULL), last_visit DESC, b.name COLLATE NOCASE`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, lastVisit: r.last_visit, visits: r.visits }));
}

export async function getBar(id: string): Promise<{ id: string; name: string } | null> {
  const db = await getDb();
  return db.getFirstAsync<{ id: string; name: string }>('SELECT id, name FROM bars WHERE id = ?', id);
}

export async function createBar(name: string): Promise<string> {
  const db = await getDb();
  const clean = name.trim();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM bars WHERE deleted = 0 AND name = ? COLLATE NOCASE',
    clean,
  );
  if (existing) return existing.id;
  const id = newId();
  const t = now();
  await db.runAsync(
    'INSERT INTO bars (id, name, created_at, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, 0, 1)',
    id,
    clean,
    t,
    t,
  );
  changed();
  return id;
}

export async function deleteBar(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE bars SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?', now(), id);
  changed();
}

/* ------------------------------ Bebidas ------------------------------ */

export async function listDrinks(barId: string): Promise<Drink[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; bar_id: string; name: string; position: number; last_price: number }>(
    'SELECT id, bar_id, name, position, last_price FROM drinks WHERE bar_id = ? AND deleted = 0 ORDER BY position, name',
    barId,
  );
  return rows.map((r) => ({ id: r.id, barId: r.bar_id, name: r.name, position: r.position, lastPrice: r.last_price }));
}

export async function addDrink(barId: string, name: string, price: number): Promise<string> {
  const db = await getDb();
  const pos = await db.getFirstAsync<{ p: number | null }>(
    'SELECT MAX(position) AS p FROM drinks WHERE bar_id = ? AND deleted = 0',
    barId,
  );
  const id = newId();
  await db.runAsync(
    'INSERT INTO drinks (id, bar_id, name, position, last_price, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, ?, 0, 1)',
    id,
    barId,
    name.trim(),
    (pos?.p ?? -1) + 1,
    price,
    now(),
  );
  changed();
  return id;
}

export async function deleteDrink(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE drinks SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?', now(), id);
  changed();
}

/* ------------------------------- Noites ------------------------------ */

export async function getActiveNight(): Promise<Night | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string; bar_id: string; started_at: number; last_at: number | null }>(
    `SELECT n.id, n.bar_id, n.started_at,
            (SELECT MAX(c.created_at) FROM consumptions c WHERE c.night_id = n.id AND c.deleted = 0) AS last_at
       FROM nights n
      WHERE n.ended_at IS NULL AND n.deleted = 0
      ORDER BY n.started_at DESC LIMIT 1`,
  );
  if (!row) return null;
  const lastActivity = Math.max(row.started_at, row.last_at ?? 0);
  if (now() - lastActivity > AUTO_CLOSE_MS) {
    await db.runAsync(
      'UPDATE nights SET ended_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      lastActivity,
      now(),
      row.id,
    );
    changed();
    return null;
  }
  return { id: row.id, barId: row.bar_id, startedAt: row.started_at, endedAt: null };
}

/** Começa a noite num bar com os preços confirmados para hoje. */
export async function startNight(barId: string, prices: { drinkId: string; price: number }[]): Promise<string> {
  const db = await getDb();
  const nightId = newId();
  const t = now();
  await db.withTransactionAsync(async () => {
    // Fecha qualquer noite que tenha ficado aberta.
    await db.runAsync(
      'UPDATE nights SET ended_at = ?, updated_at = ?, dirty = 1 WHERE ended_at IS NULL AND deleted = 0',
      t,
      t,
    );
    await db.runAsync(
      'INSERT INTO nights (id, bar_id, started_at, ended_at, updated_at, deleted, dirty) VALUES (?, ?, ?, NULL, ?, 0, 1)',
      nightId,
      barId,
      t,
      t,
    );
    for (const p of prices) {
      await db.runAsync(
        'INSERT INTO night_prices (id, night_id, drink_id, price, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, 0, 1)',
        `${nightId}_${p.drinkId}`,
        nightId,
        p.drinkId,
        p.price,
        t,
      );
      await db.runAsync(
        'UPDATE drinks SET last_price = ?, updated_at = ?, dirty = 1 WHERE id = ? AND last_price <> ?',
        p.price,
        t,
        p.drinkId,
        p.price,
      );
    }
  });
  changed();
  return nightId;
}

/** Bebida nova a meio da noite: cria-a no bar e fixa o preço desta noite. */
export async function addDrinkToNight(nightId: string, barId: string, name: string, price: number): Promise<void> {
  const drinkId = await addDrink(barId, name, price);
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO night_prices (id, night_id, drink_id, price, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, 0, 1)',
    `${nightId}_${drinkId}`,
    nightId,
    drinkId,
    price,
    now(),
  );
  changed();
}

export async function getNightDetail(nightId: string): Promise<NightDetail | null> {
  const db = await getDb();
  const night = await db.getFirstAsync<{
    id: string;
    bar_id: string;
    started_at: number;
    ended_at: number | null;
    bar_name: string;
  }>(
    `SELECT n.id, n.bar_id, n.started_at, n.ended_at, b.name AS bar_name
       FROM nights n JOIN bars b ON b.id = n.bar_id
      WHERE n.id = ?`,
    nightId,
  );
  if (!night) return null;
  const drinks = await db.getAllAsync<{ id: string; name: string; price: number; count: number }>(
    `SELECT d.id, d.name, np.price,
            (SELECT COUNT(*) FROM consumptions c
              WHERE c.night_id = np.night_id AND c.drink_id = d.id AND c.deleted = 0) AS count
       FROM night_prices np
       JOIN drinks d ON d.id = np.drink_id
      WHERE np.night_id = ? AND np.deleted = 0
      ORDER BY d.position, d.name`,
    nightId,
  );
  const total = drinks.reduce((s, d) => s + d.price * d.count, 0);
  const totalDrinks = drinks.reduce((s, d) => s + d.count, 0);
  return {
    id: night.id,
    barId: night.bar_id,
    startedAt: night.started_at,
    endedAt: night.ended_at,
    barName: night.bar_name,
    drinks,
    total,
    totalDrinks,
  };
}

export async function addConsumption(nightId: string, drinkId: string, quantity = 1): Promise<string[]> {
  const db = await getDb();
  const ids: string[] = [];
  const t = now();
  for (let i = 0; i < quantity; i++) {
    const id = newId();
    ids.push(id);
    await db.runAsync(
      'INSERT INTO consumptions (id, night_id, drink_id, created_at, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, 0, 1)',
      id,
      nightId,
      drinkId,
      t,
      t,
    );
  }
  changed();
  return ids;
}

export async function removeConsumptions(ids: string[]): Promise<void> {
  const db = await getDb();
  const t = now();
  for (const id of ids) {
    await db.runAsync('UPDATE consumptions SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?', t, id);
  }
  changed();
}

/** Tira a última unidade registada de uma bebida (toque longo). */
export async function removeLastOfDrink(nightId: string, drinkId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM consumptions
      WHERE night_id = ? AND drink_id = ? AND deleted = 0
      ORDER BY created_at DESC LIMIT 1`,
    nightId,
    drinkId,
  );
  if (!row) return false;
  await removeConsumptions([row.id]);
  return true;
}

export async function closeNight(nightId: string): Promise<void> {
  const db = await getDb();
  const t = now();
  await db.runAsync('UPDATE nights SET ended_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', t, t, nightId);
  changed();
}

export async function reopenNight(nightId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE nights SET ended_at = NULL, updated_at = ?, dirty = 1 WHERE id = ?', now(), nightId);
  changed();
}

export async function deleteNight(nightId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE nights SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', now(), nightId);
  changed();
}

/* ---------------------------- Estatísticas --------------------------- */

export type Stats = {
  total: number;
  drinks: number;
  nights: number;
  perBar: { name: string; total: number; drinks: number }[];
  perDrink: { name: string; total: number; drinks: number }[];
  nightsList: { id: string; barName: string; startedAt: number; total: number; drinks: number }[];
  /** Consumos com hora e valor, para agrupar no gráfico. */
  points: { at: number; price: number }[];
};

export async function getStats(from: number, to: number): Promise<Stats> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    night_id: string;
    started_at: number;
    bar_name: string;
    drink_name: string;
    price: number;
  }>(
    `SELECT n.id AS night_id, n.started_at, b.name AS bar_name, d.name AS drink_name,
            COALESCE(np.price, d.last_price) AS price
       FROM consumptions c
       JOIN nights n ON n.id = c.night_id AND n.deleted = 0
       JOIN bars b ON b.id = n.bar_id
       JOIN drinks d ON d.id = c.drink_id
       LEFT JOIN night_prices np ON np.night_id = c.night_id AND np.drink_id = c.drink_id
      WHERE c.deleted = 0 AND n.started_at >= ? AND n.started_at < ?`,
    from,
    to,
  );

  const perBar = new Map<string, { name: string; total: number; drinks: number }>();
  const perDrink = new Map<string, { name: string; total: number; drinks: number }>();
  const perNight = new Map<string, { id: string; barName: string; startedAt: number; total: number; drinks: number }>();
  let total = 0;

  for (const r of rows) {
    total += r.price;
    const b = perBar.get(r.bar_name) ?? { name: r.bar_name, total: 0, drinks: 0 };
    b.total += r.price;
    b.drinks += 1;
    perBar.set(r.bar_name, b);
    const key = r.drink_name.toLowerCase();
    const d = perDrink.get(key) ?? { name: r.drink_name, total: 0, drinks: 0 };
    d.total += r.price;
    d.drinks += 1;
    perDrink.set(key, d);
    const n = perNight.get(r.night_id) ?? {
      id: r.night_id,
      barName: r.bar_name,
      startedAt: r.started_at,
      total: 0,
      drinks: 0,
    };
    n.total += r.price;
    n.drinks += 1;
    perNight.set(r.night_id, n);
  }

  const byTotal = (a: { total: number }, b: { total: number }) => b.total - a.total;
  return {
    total,
    drinks: rows.length,
    nights: perNight.size,
    perBar: [...perBar.values()].sort(byTotal),
    perDrink: [...perDrink.values()].sort(byTotal),
    nightsList: [...perNight.values()].sort((a, b) => b.startedAt - a.startedAt),
    points: rows.map((r) => ({ at: r.started_at, price: r.price })),
  };
}
