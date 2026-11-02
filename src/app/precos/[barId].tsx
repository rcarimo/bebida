import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Header, Screen, Sheet, T } from '../../components/ui';
import { addDrink, deleteDrink, getBar, listDrinks, startNight, type Drink } from '../../lib/repo';
import { CURRENCY, money, parseMoney, relativeDay } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import { colors, radius } from '../../theme';
import { getDb } from '../../lib/db';

export default function Precos() {
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const { data } = useLoad(async () => {
    const [bar, drinks] = await Promise.all([getBar(barId), listDrinks(barId)]);
    const db = await getDb();
    const last = await db.getFirstAsync<{ started_at: number }>(
      'SELECT started_at FROM nights WHERE bar_id = ? AND deleted = 0 ORDER BY started_at DESC LIMIT 1',
      barId,
    );
    return { bar, drinks, lastVisit: last?.started_at ?? null };
  }, [barId]);

  // Pré-preenche com o último preço de cada bebida (sem apagar o que já foi editado).
  useEffect(() => {
    if (!data) return;
    setPrices((prev) => {
      const next = { ...prev };
      for (const d of data.drinks) if (next[d.id] === undefined) next[d.id] = d.lastPrice ? money(d.lastPrice) : '';
      return next;
    });
  }, [data]);

  const drinks = data?.drinks ?? [];
  const hasChanges = drinks.some((d) => isChanged(d, prices[d.id]));

  async function confirm() {
    const parsed = drinks.map((d) => ({ drinkId: d.id, price: parseMoney(prices[d.id] ?? '') }));
    const bad = drinks.filter((_, i) => Number.isNaN(parsed[i].price));
    if (bad.length) {
      Alert.alert('Falta o preço', `Escreve o preço de: ${bad.map((b) => b.name).join(', ')}`);
      return;
    }
    setBusy(true);
    const nightId = await startNight(barId, parsed);
    router.replace({ pathname: '/noite/[nightId]', params: { nightId } });
  }

  async function saveDrink() {
    const price = parseMoney(newPrice);
    if (!newName.trim() || Number.isNaN(price)) return;
    const id = await addDrink(barId, newName, price);
    setPrices((p) => ({ ...p, [id]: money(price) }));
    setNewName('');
    setNewPrice('');
    setSheet(false);
  }

  function confirmDelete(d: Drink) {
    Alert.alert('Tirar bebida?', `"${d.name}" deixa de aparecer neste bar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar', style: 'destructive', onPress: () => void deleteDrink(d.id) },
    ]);
  }

  return (
    <Screen>
      <Header
        title={data?.bar?.name ?? ''}
        subtitle="Preços de hoje"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Card>
        <T style={{ color: colors.textSoft, fontSize: 15, lineHeight: 21 }}>
          {drinks.length === 0
            ? 'Adiciona as bebidas que costumas pedir aqui e o preço de cada uma. Na próxima vez já vêm preenchidas.'
            : data?.lastVisit
              ? `Preenchido com os preços de ${relativeDay(data.lastVisit)}. Toca num preço só se mudou.`
              : 'Confirma o preço de cada bebida.'}
        </T>
      </Card>

      <View style={{ flex: 1, gap: 10 }}>
        {drinks.map((d) => {
          const changed = isChanged(d, prices[d.id]);
          return (
            <View key={d.id} style={s.row}>
              <Pressable
                style={{ flex: 1, gap: 2 }}
                onLongPress={() => confirmDelete(d)}
                accessibilityHint="Segura para tirar esta bebida"
              >
                <T style={s.name} numberOfLines={1}>
                  {d.name}
                </T>
                {changed ? (
                  <T style={s.changed}>Antes: {money(d.lastPrice)} {CURRENCY}</T>
                ) : null}
              </Pressable>
              <View style={[s.priceBox, changed && s.priceBoxChanged]}>
                <TextInput
                  accessibilityLabel={`Preço de ${d.name}`}
                  value={prices[d.id] ?? ''}
                  onChangeText={(v) => setPrices((p) => ({ ...p, [d.id]: v }))}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={[s.priceInput, changed && { color: '#FFD27A' }]}
                />
                <T style={[s.cur, changed && { color: '#FFD27A' }]}>{CURRENCY}</T>
              </View>
            </View>
          );
        })}
        <Button
          title={drinks.length ? 'Outra bebida' : 'Adicionar bebida'}
          icon="plus"
          variant="dashed"
          height={60}
          fontSize={18}
          onPress={() => setSheet(true)}
        />
      </View>

      <Button
        title={hasChanges ? 'Guardar e começar' : 'Preços certos'}
        icon="check"
        height={88}
        fontSize={26}
        disabled={drinks.length === 0 || busy}
        onPress={confirm}
      />

      <Sheet visible={sheet} title="Bebida nova" onClose={() => setSheet(false)}>
        <Field label="Nome" value={newName} onChangeText={setNewName} placeholder="Ex.: 2M" autoFocus autoCapitalize="words" />
        <Field
          label={`Preço (${CURRENCY})`}
          value={newPrice}
          onChangeText={setNewPrice}
          placeholder="100"
          keyboardType="decimal-pad"
          onSubmitEditing={saveDrink}
        />
        <Button
          title="Adicionar"
          icon="check"
          onPress={saveDrink}
          disabled={!newName.trim() || Number.isNaN(parseMoney(newPrice)) || newPrice === ''}
        />
      </Sheet>
    </Screen>
  );
}

function isChanged(d: Drink, value: string | undefined) {
  if (!d.lastPrice || value === undefined || value === '') return false;
  const v = parseMoney(value);
  return !Number.isNaN(v) && v !== d.lastPrice;
}

const s = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 72,
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontSize: 22, fontWeight: '700' },
  changed: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    height: 54,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 128,
    justifyContent: 'flex-end',
  },
  priceBoxChanged: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  priceInput: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'right', minWidth: 60, padding: 0 },
  cur: { color: colors.text, fontSize: 22, fontWeight: '700', marginLeft: 6 },
});

