import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Header, IconButton, Label, Screen, T, styles as ui } from '../components/ui';
import { Icon } from '../components/Icon';
import { getStats } from '../lib/repo';
import { CURRENCY, getPeriod, money, shortDate, type PeriodKind } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { AdSlot } from '../lib/ads';
import { colors, radius } from '../theme';

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'week', label: 'Semana' },
  { kind: 'month', label: 'Mês' },
  { kind: 'year', label: 'Ano' },
  { kind: 'all', label: 'Tudo' },
];

export default function Historico() {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const period = useMemo(() => getPeriod(kind, offset), [kind, offset]);

  const { data: stats } = useLoad(() => getStats(period.from, period.to), [period.from, period.to]);

  const buckets = useMemo(() => {
    if (!stats) return [];
    return period.buckets.map((b) => ({
      label: b.label,
      total: stats.points.filter((p) => p.at >= b.from && p.at < b.to).reduce((s, p) => s + p.price, 0),
    }));
  }, [stats, period]);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
  const maxBar = Math.max(1, ...(stats?.perBar.map((b) => b.total) ?? [1]));
  const maxDrink = Math.max(1, ...(stats?.perDrink.map((b) => b.drinks) ?? [1]));

  return (
    <Screen scroll>
      <Header title="Os meus gastos" onBack={() => router.back()} />

      <View style={s.chips}>
        {KINDS.map((k) => {
          const on = k.kind === kind;
          return (
            <Pressable
              key={k.kind}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setKind(k.kind);
                setOffset(0);
              }}
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && ui.pressed]}
            >
              <T style={[s.chipText, on && { color: colors.accentText, fontWeight: '800' }]}>{k.label}</T>
            </Pressable>
          );
        })}
      </View>

      {kind !== 'all' ? (
        <View style={s.nav}>
          <IconButton icon="left" label="Período anterior" onPress={() => setOffset((o) => o - 1)} />
          <T style={{ fontSize: 18, fontWeight: '700' }}>{period.label}</T>
          {offset < 0 ? (
            <IconButton icon="right" label="Período seguinte" onPress={() => setOffset((o) => o + 1)} />
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>
      ) : null}

      <View style={s.tiles}>
        <Tile label="Gasto" value={`${money(stats?.total ?? 0)} ${CURRENCY}`} />
        <Tile label="Bebidas" value={String(stats?.drinks ?? 0)} />
        <Tile label="Noites" value={String(stats?.nights ?? 0)} />
        <Tile
          label="Média/noite"
          value={`${money(stats && stats.nights ? Math.round(stats.total / stats.nights) : 0)} ${CURRENCY}`}
        />
      </View>

      {buckets.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Label>Gasto por {kind === 'week' ? 'dia' : kind === 'month' ? 'semana' : 'mês'} ({CURRENCY})</Label>
          <View style={s.chart}>
            {buckets.map((b, i) => {
              const h = (b.total / maxBucket) * 90;
              const isMax = b.total > 0 && b.total === maxBucket;
              return (
                <View key={i} style={s.col}>
                  {b.total > 0 && buckets.length <= 7 ? (
                    <T style={s.colValue} numberOfLines={1}>
                      {money(b.total)}
                    </T>
                  ) : null}
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(h, b.total > 0 ? 4 : 2),
                      backgroundColor: b.total > 0 ? (isMax ? colors.accent : colors.accentDim) : colors.tile,
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      borderBottomLeftRadius: 2,
                      borderBottomRightRadius: 2,
                    }}
                  />
                  <T style={s.colLabel}>{b.label}</T>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {stats && stats.perBar.length > 0 && (
        <Card style={{ gap: 12 }}>
          <Label>Por bar</Label>
          {stats.perBar.map((b) => (
            <Bar key={b.name} name={b.name} right={`${money(b.total)} ${CURRENCY} · ${b.drinks}`} ratio={b.total / maxBar} />
          ))}
        </Card>
      )}

      {stats ? <AdSlot placement="history" /> : null}

      {stats && stats.perDrink.length > 0 && (
        <Card style={{ gap: 12 }}>
          <Label>Por bebida</Label>
          {stats.perDrink.map((d) => (
            <Bar key={d.name} name={d.name} right={`${d.drinks}× · ${money(d.total)} ${CURRENCY}`} ratio={d.drinks / maxDrink} />
          ))}
        </Card>
      )}

      {stats && stats.nightsList.length > 0 && (
        <View style={{ gap: 10 }}>
          <Label>Noites</Label>
          {stats.nightsList.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/fechar/[nightId]', params: { nightId: n.id } })}
              style={({ pressed }) => [s.nightRow, pressed && ui.pressed]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                  {n.barName}
                </T>
                <T style={{ color: colors.muted, fontSize: 14 }}>
                  {shortDate(n.startedAt)} · {n.drinks} {n.drinks === 1 ? 'bebida' : 'bebidas'}
                </T>
              </View>
              <T style={{ fontSize: 18, fontWeight: '800' }}>
                {money(n.total)} {CURRENCY}
              </T>
              <Icon name="chevron" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}

      {stats && stats.drinks === 0 ? (
        <T style={{ color: colors.muted, textAlign: 'center', paddingVertical: 24 }}>Sem bebidas neste período.</T>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tile}>
      <Label>{label}</Label>
      <T style={{ fontSize: 24, fontWeight: '800' }} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function Bar({ name, right, ratio }: { name: string; right: string; ratio: number }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {name}
        </T>
        <T style={{ fontWeight: '700' }}>{right}</T>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.max(3, ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textSoft, fontSize: 15, fontWeight: '700' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' },
  colValue: { fontSize: 11, color: colors.textSoft },
  colLabel: { fontSize: 12, color: colors.muted },
  track: { height: 8, backgroundColor: colors.tile, borderRadius: 4 },
  fill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  nightRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
