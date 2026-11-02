export const CURRENCY = 'MT';

export function money(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.001;
  return rounded
    .toFixed(hasCents ? 2 : 0)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function parseMoney(s: string): number {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function time(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "hoje", "ontem", "sábado", "há 2 semanas"… */
export function relativeDay(ts: number): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return WEEKDAYS_LONG[d.getDay()];
  if (days < 14) return 'há 1 semana';
  if (days < 60) return `há ${Math.floor(days / 7)} semanas`;
  return `há ${Math.floor(days / 30)} meses`;
}

/* ------------------------------ Períodos ------------------------------ */

export type PeriodKind = 'week' | 'month' | 'year' | 'all';

export type Period = {
  kind: PeriodKind;
  from: number;
  to: number;
  label: string;
  /** Divisões para o gráfico de barras. */
  buckets: { label: string; from: number; to: number }[];
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() + 6) % 7; // semana começa à segunda
  x.setDate(x.getDate() - diff);
  return x;
}

/** offset = 0 é o período atual, -1 o anterior, etc. */
export function getPeriod(kind: PeriodKind, offset: number): Period {
  const today = new Date();
  if (kind === 'week') {
    const start = startOfWeek(today);
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const a = new Date(start);
      a.setDate(a.getDate() + i);
      const b = new Date(a);
      b.setDate(b.getDate() + 1);
      return { label: WEEKDAYS[a.getDay()], from: a.getTime(), to: b.getTime() };
    });
    const last = new Date(end.getTime() - 1);
    const label =
      offset === 0
        ? 'Esta semana'
        : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`;
    return { kind, from: start.getTime(), to: end.getTime(), label, buckets };
  }
  if (kind === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const buckets: Period['buckets'] = [];
    let w = 1;
    for (let a = new Date(start); a < end; w++) {
      const b = new Date(a);
      b.setDate(b.getDate() + 7);
      const to = b < end ? b : end;
      buckets.push({ label: `S${w}`, from: a.getTime(), to: to.getTime() });
      a = b;
    }
    return {
      kind,
      from: start.getTime(),
      to: end.getTime(),
      label: `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`,
      buckets,
    };
  }
  if (kind === 'year') {
    const y = today.getFullYear() + offset;
    const buckets = Array.from({ length: 12 }, (_, m) => ({
      label: MONTHS[m][0],
      from: new Date(y, m, 1).getTime(),
      to: new Date(y, m + 1, 1).getTime(),
    }));
    return { kind, from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), label: String(y), buckets };
  }
  return { kind, from: 0, to: 8640000000000000, label: 'Desde o início', buckets: [] };
}
