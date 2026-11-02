import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, IconButton, Label, Screen, Sheet, T, styles as ui } from '../components/ui';
import { Icon } from '../components/Icon';
import { createBar, deleteBar, getActiveNight, getNightDetail, getStats, listBars } from '../lib/repo';
import { CURRENCY, getPeriod, money, relativeDay } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { colors, radius } from '../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 5 || h >= 18) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  return 'Boa tarde';
}

export default function Home() {
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');

  const { data } = useLoad(async () => {
    const [bars, active, month] = await Promise.all([
      listBars(),
      getActiveNight(),
      getStats(getPeriod('month', 0).from, getPeriod('month', 0).to),
    ]);
    const activeDetail = active ? await getNightDetail(active.id) : null;
    return { bars, activeDetail, month };
  });

  const bars = data?.bars ?? [];
  const lastBar = bars.find((b) => b.lastVisit != null) ?? bars[0];
  const active = data?.activeDetail;

  async function saveBar() {
    if (!name.trim()) return;
    const id = await createBar(name);
    setName('');
    setSheet(false);
    router.push({ pathname: '/precos/[barId]', params: { barId: id } });
  }

  function onStart() {
    if (lastBar) router.push({ pathname: '/precos/[barId]', params: { barId: lastBar.id } });
    else setSheet(true);
  }

  function confirmDelete(id: string, barName: string) {
    Alert.alert('Apagar bar?', `"${barName}" deixa de aparecer na lista. O histórico mantém-se.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => void deleteBar(id) },
    ]);
  }

  return (
    <Screen scroll>
      <View style={s.top}>
        <Label style={{ fontSize: 15 }}>{greeting()}</Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton icon="user" label="Conta e sincronização" onPress={() => router.push('/perfil')} />
          <IconButton icon="chart" label="Histórico de gastos" onPress={() => router.push('/historico')} />
        </View>
      </View>

      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voltar à noite em ${active.barName}`}
          onPress={() => router.push({ pathname: '/noite/[nightId]', params: { nightId: active.id } })}
          style={({ pressed }) => [s.hero, pressed && ui.pressed]}
        >
          <T style={s.heroSmall}>Noite a decorrer · {active.barName}</T>
          <T style={s.heroBig}>
            {money(active.total)} {CURRENCY}
          </T>
          <T style={s.heroSmall}>{active.totalDrinks} bebidas · toca para continuar</T>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comecei a beber"
          onPress={onStart}
          style={({ pressed }) => [s.hero, pressed && ui.pressed]}
        >
          <Icon name="beer" size={64} color={colors.accentText} strokeWidth={1.8} />
          <T style={s.heroTitle}>Comecei a beber</T>
          {lastBar ? <T style={s.heroSmall}>no {lastBar.name}</T> : null}
        </Pressable>
      )}

      {!active && (
        <View style={{ gap: 12 }}>
          <Label>{lastBar ? 'Ou noutro bar' : 'Onde estás?'}</Label>
          {bars
            .filter((b) => b.id !== lastBar?.id)
            .slice(0, 6)
            .map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={b.name}
                onPress={() => router.push({ pathname: '/precos/[barId]', params: { barId: b.id } })}
                onLongPress={() => confirmDelete(b.id, b.name)}
                style={({ pressed }) => [s.barRow, pressed && ui.pressed]}
              >
                <View style={{ gap: 4, flex: 1 }}>
                  <T style={s.barName} numberOfLines={1}>
                    {b.name}
                  </T>
                  <T style={ui.muted}>{b.lastVisit ? `Última vez: ${relativeDay(b.lastVisit)}` : 'Ainda sem visitas'}</T>
                </View>
                <Icon name="chevron" />
              </Pressable>
            ))}
          <Button title="Bar novo" icon="plus" variant="dashed" height={68} fontSize={20} onPress={() => setSheet(true)} />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver gastos do mês"
        onPress={() => router.push('/historico')}
        style={({ pressed }) => pressed && ui.pressed}
      >
        <Card style={s.summary}>
          <View style={{ gap: 2 }}>
            <Label>Este mês</Label>
            <T style={s.summaryValue}>
              {money(data?.month.total ?? 0)} {CURRENCY}
            </T>
          </View>
          <View style={{ gap: 2, alignItems: 'flex-end' }}>
            <Label>Bebidas</Label>
            <T style={s.summaryValue}>{data?.month.drinks ?? 0}</T>
          </View>
        </Card>
      </Pressable>

      <Sheet visible={sheet} title="Bar novo" onClose={() => setSheet(false)}>
        <Field
          label="Nome do bar"
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Bar do Zé"
          autoFocus
          autoCapitalize="words"
          onSubmitEditing={saveBar}
        />
        <Button title="Continuar" icon="check" onPress={saveBar} disabled={!name.trim()} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    minHeight: 220,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroTitle: { color: colors.accentText, fontSize: 30, fontWeight: '800' },
  heroBig: { color: colors.accentText, fontSize: 52, fontWeight: '800' },
  heroSmall: { color: colors.accentText, fontSize: 17, fontWeight: '600' },
  barRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barName: { fontSize: 22, fontWeight: '700' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800' },
});
