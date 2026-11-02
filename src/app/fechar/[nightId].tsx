import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Label, Screen, T } from '../../components/ui';
import { closeNight, deleteNight, getNightDetail, reopenNight } from '../../lib/repo';
import { CURRENCY, money, shortDate, time } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import { colors, radius } from '../../theme';

export default function Fechar() {
  const { nightId } = useLocalSearchParams<{ nightId: string }>();
  const { data: night } = useLoad(() => getNightDetail(nightId), [nightId]);

  if (!night) return <Screen>{null}</Screen>;

  const isOpen = night.endedAt == null;
  const items = night.drinks.filter((d) => d.count > 0);

  async function pay() {
    await closeNight(nightId);
    router.dismissAll();
    router.replace('/');
  }

  function goBack() {
    if (isOpen) router.replace({ pathname: '/noite/[nightId]', params: { nightId } });
    else router.back();
  }

  function confirmDelete() {
    Alert.alert('Apagar esta noite?', 'Sai do histórico e dos totais.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteNight(nightId);
          router.back();
        },
      },
    ]);
  }

  async function reopen() {
    await reopenNight(nightId);
    router.replace({ pathname: '/noite/[nightId]', params: { nightId } });
  }

  const endLabel = night.endedAt ? time(night.endedAt) : 'agora';

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Label style={{ fontSize: 14 }}>{isOpen ? 'A tua conta' : 'Resumo da noite'}</Label>
        <T style={{ fontSize: 26, fontWeight: '800' }}>{night.barName}</T>
        <T style={{ color: colors.muted, fontSize: 15 }}>
          {shortDate(night.startedAt)} · {time(night.startedAt)} – {endLabel}
        </T>
      </View>

      <ScrollView style={{ flexGrow: 0, maxHeight: 340 }}>
        <Card style={{ paddingVertical: 4 }}>
          {items.length === 0 ? (
            <T style={{ color: colors.muted, paddingVertical: 20, textAlign: 'center' }}>Nenhuma bebida registada.</T>
          ) : (
            items.map((d, i) => (
              <View key={d.id} style={[s.row, i < items.length - 1 && s.rowBorder]}>
                <View style={{ gap: 2, flex: 1 }}>
                  <T style={{ fontSize: 20, fontWeight: '700' }} numberOfLines={1}>
                    {d.name}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 14 }}>
                    {d.count} × {money(d.price)} {CURRENCY}
                  </T>
                </View>
                <T style={{ fontSize: 22, fontWeight: '800' }}>{money(d.count * d.price)}</T>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View style={s.total}>
        <View style={{ gap: 2 }}>
          <T style={s.totalLabel}>TOTAL</T>
          <T style={{ color: colors.accentText, fontSize: 16, fontWeight: '600' }}>
            {night.totalDrinks} {night.totalDrinks === 1 ? 'bebida' : 'bebidas'}
          </T>
        </View>
        <T style={s.totalValue} numberOfLines={1} >
          {money(night.total)} <T style={{ color: colors.accentText, fontSize: 22, fontWeight: '800' }}>{CURRENCY}</T>
        </T>
      </View>

      {isOpen ? (
        <T style={{ color: colors.textSoft, fontSize: 15, textAlign: 'center' }}>
          Compara com a conta do bar antes de pagar.
        </T>
      ) : null}

      <View style={{ marginTop: 'auto', gap: 12 }}>
        {isOpen ? (
          <>
            <Button title="Paguei, fechar" icon="check" variant="light" onPress={pay} />
            <Button title="Ainda não, voltar" variant="outline" height={64} fontSize={19} onPress={goBack} />
          </>
        ) : (
          <>
            <Button title="Voltar" variant="outline" height={64} fontSize={19} onPress={goBack} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Reabrir" variant="outline" height={56} fontSize={16} style={{ flex: 1 }} onPress={reopen} />
              <Button title="Apagar" icon="trash" variant="danger" height={56} fontSize={16} style={{ flex: 1 }} onPress={confirmDelete} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: 8, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.tile },
  total: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  totalLabel: { color: colors.accentText, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  totalValue: { color: colors.accentText, fontSize: 48, fontWeight: '800', flexShrink: 1 },
});
