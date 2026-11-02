import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Field, IconButton, Label, Screen, Sheet, T, styles as ui, tap } from '../../components/ui';
import { Icon } from '../../components/Icon';
import {
  addConsumption,
  addDrinkToNight,
  getNightDetail,
  removeConsumptions,
  removeLastOfDrink,
} from '../../lib/repo';
import { CURRENCY, money, parseMoney, time } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import { colors, radius, tilePalette } from '../../theme';

type Toast = { text: string; undoIds?: string[] };

const HOLD_MS = 1500;

export default function Noite() {
  useKeepAwake();
  const { nightId } = useLocalSearchParams<{ nightId: string }>();
  const { data: night } = useLoad(() => getNightDetail(nightId), [nightId]);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheet, setSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Se a noite já foi fechada (ex.: noutro telefone), vai para o resumo.
  useEffect(() => {
    if (night?.endedAt) router.replace({ pathname: '/fechar/[nightId]', params: { nightId } });
  }, [night?.endedAt, nightId]);

  function showToast(t: Toast) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function add(drinkId: string, name: string) {
    tap();
    const ids = await addConsumption(nightId, drinkId);
    showToast({ text: `+1 ${name}`, undoIds: ids });
  }

  async function remove(drinkId: string, name: string) {
    tap(true);
    const ok = await removeLastOfDrink(nightId, drinkId);
    if (ok) showToast({ text: `−1 ${name}` });
  }

  async function undo() {
    if (!toast?.undoIds) return;
    tap();
    await removeConsumptions(toast.undoIds);
    setToast(null);
  }

  async function saveDrink() {
    const price = parseMoney(newPrice);
    if (!night || !newName.trim() || Number.isNaN(price)) return;
    await addDrinkToNight(nightId, night.barId, newName, price);
    setNewName('');
    setNewPrice('');
    setSheet(false);
  }

  if (!night) return <Screen>{null}</Screen>;

  const many = night.drinks.length > 4;
  const tileH = many ? 150 : 190;

  return (
    <Screen style={{ paddingBottom: 12 }}>
      <View style={s.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label style={{ fontSize: 14 }}>
            {night.barName} · desde {time(night.startedAt)}
          </Label>
          <T style={s.total} numberOfLines={1}>
            {money(night.total)} <T style={s.totalCur}>{CURRENCY}</T>
          </T>
          <T style={{ fontSize: 17, color: colors.textSoft }}>
            {night.totalDrinks} {night.totalDrinks === 1 ? 'bebida' : 'bebidas'}
          </T>
        </View>
        <IconButton icon="back" label="Ir para o início (a noite continua)" onPress={() => router.replace('/')} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
        {night.drinks.map((d, i) => {
          const c = tilePalette[i % tilePalette.length];
          return (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={`Mais uma ${d.name}. Tens ${d.count}.`}
              accessibilityHint="Segura para tirar uma"
              onPress={() => void add(d.id, d.name)}
              onLongPress={() => void remove(d.id, d.name)}
              delayLongPress={600}
              style={({ pressed }) => [s.tile, { backgroundColor: c.bg, height: tileH }, pressed && ui.pressed]}
            >
              <View style={{ gap: 2 }}>
                <T style={[s.tileName, { color: c.fg }]} numberOfLines={2}>
                  {d.name}
                </T>
                <T style={[s.tilePrice, { color: c.fg }]}>
                  {money(d.price)} {CURRENCY}
                </T>
              </View>
              <View style={s.tileBottom}>
                <T style={[s.tileCount, { color: c.fg }, many && { fontSize: 48 }]}>{d.count}</T>
                <T style={[s.tilePlus, { color: c.fg }]}>+1</T>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Outra bebida"
          onPress={() => setSheet(true)}
          style={({ pressed }) => [s.tile, s.tileAdd, { height: night.drinks.length % 2 ? tileH : 72 }, pressed && ui.pressed]}
        >
          <Icon name="plus" color={colors.accent} strokeWidth={2.4} />
          <T style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>Outra bebida</T>
        </Pressable>
      </ScrollView>

      {toast ? (
        <View style={s.toast}>
          <T style={s.toastText} numberOfLines={1}>
            {toast.text}
          </T>
          {toast.undoIds ? (
            <Pressable accessibilityRole="button" onPress={undo} style={({ pressed }) => [s.undo, pressed && ui.pressed]}>
              <T style={s.undoText}>DESFAZER</T>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <T style={s.hint}>Toca para somar · Segura para tirar uma</T>
      )}

      <HoldToClose onDone={() => router.replace({ pathname: '/fechar/[nightId]', params: { nightId } })} />

      <Sheet visible={sheet} title="Bebida nova" onClose={() => setSheet(false)}>
        <Field label="Nome" value={newName} onChangeText={setNewName} placeholder="Ex.: Gin tónico" autoFocus autoCapitalize="words" />
        <Field
          label={`Preço (${CURRENCY})`}
          value={newPrice}
          onChangeText={setNewPrice}
          placeholder="150"
          keyboardType="decimal-pad"
          onSubmitEditing={saveDrink}
        />
        <Button
          title="Adicionar"
          icon="check"
          onPress={saveDrink}
          disabled={!newName.trim() || newPrice === '' || Number.isNaN(parseMoney(newPrice))}
        />
      </Sheet>
    </Screen>
  );
}

/** Botão que só fecha a conta depois de segurar ~1,5 s (evita toques sem querer). */
function HoldToClose({ onDone }: { onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  function start() {
    tap();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) {
        tap(true);
        progress.setValue(0);
        onDone();
      }
    });
  }

  function cancel() {
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  }

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fechar conta"
      accessibilityHint="Segura dois segundos"
      onPressIn={start}
      onPressOut={cancel}
      style={s.close}
    >
      <Animated.View style={[s.closeFill, { width }]} />
      <T style={{ fontSize: 22, fontWeight: '800' }}>Fechar conta</T>
      <T style={{ fontSize: 13, color: colors.muted }}>Segura para fechar</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  total: { fontSize: 56, fontWeight: '800', lineHeight: 62 },
  totalCur: { fontSize: 26, color: colors.muted, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 4 },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
  },
  tileAdd: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  tileName: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  tilePrice: { fontSize: 15, fontWeight: '600', opacity: 0.85 },
  tileBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  tileCount: { fontSize: 64, fontWeight: '800', lineHeight: 68 },
  tilePlus: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 14, height: 64, textAlignVertical: 'center', paddingTop: 22 },
  toast: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    height: 64,
    paddingLeft: 20,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toastText: { color: colors.accentText, fontSize: 19, fontWeight: '700', flex: 1 },
  undo: { backgroundColor: colors.accentText, borderRadius: radius.sm, height: 48, paddingHorizontal: 18, justifyContent: 'center' },
  undoText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  close: {
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  closeFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accentDim },
});
