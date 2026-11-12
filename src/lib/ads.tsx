import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getMeta, setMeta } from './db';
import { colors, radius } from '../theme';

/**
 * Anúncios (Google AdMob) com duas regras:
 *  1. Nunca aparecem durante a noite nem perto de botões de ação
 *     (só no início sem noite aberta e no histórico).
 *  2. Premium desliga-os por completo.
 *
 * A biblioteca é nativa: no Expo Go não existe, por isso é carregada com
 * require() protegido. Sem ela os espaços de anúncio não mostram nada.
 */

type AdsLib = typeof import('react-native-google-mobile-ads');

let lib: AdsLib | null = null;
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('react-native-google-mobile-ads') as AdsLib;
  } catch {
    lib = null;
  }
}

export const adsAvailable = lib != null;

/* ------------------------------- Premium ------------------------------- */

let premium = false;
const premiumListeners = new Set<(v: boolean) => void>();

export async function loadPremium(): Promise<boolean> {
  premium = (await getMeta('premium')) === '1';
  premiumListeners.forEach((fn) => fn(premium));
  return premium;
}

/** Por agora é um interruptor local; mais tarde liga-se à compra na loja. */
export async function setPremium(value: boolean): Promise<void> {
  await setMeta('premium', value ? '1' : '0');
  premium = value;
  premiumListeners.forEach((fn) => fn(premium));
}

export function usePremium(): boolean {
  const [value, setValue] = useState(premium);
  useEffect(() => {
    premiumListeners.add(setValue);
    setValue(premium);
    return () => {
      premiumListeners.delete(setValue);
    };
  }, []);
  return value;
}

/* ---------------------------- Inicialização ---------------------------- */

let initialized: Promise<void> | null = null;

export function initAds(): Promise<void> {
  if (!lib) return Promise.resolve();
  if (!initialized) {
    const mobileAds = lib.default;
    initialized = (async () => {
      try {
        await mobileAds().setRequestConfiguration({
          // App para adultos, mas sem conteúdo extremo nos anúncios.
          maxAdContentRating: lib!.MaxAdContentRating.T,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
      } catch {
        // Sem anúncios não faz mal; a app continua.
      }
    })();
  }
  return initialized;
}

/* ------------------------------ Espaços -------------------------------- */

export type AdPlacement = 'home' | 'history';

const UNIT_IDS: Record<AdPlacement, string | undefined> = {
  home: process.env.EXPO_PUBLIC_ADMOB_BANNER_HOME,
  history: process.env.EXPO_PUBLIC_ADMOB_BANNER_HISTORY,
};

function unitIdFor(placement: AdPlacement): string | null {
  if (!lib) return null;
  // Em desenvolvimento, ou enquanto não houver IDs reais no .env, usa os IDs
  // de teste da Google (mostram "Test Ad" e não contam como cliques reais).
  if (__DEV__ || !UNIT_IDS[placement]) {
    return placement === 'home' ? lib.TestIds.ADAPTIVE_BANNER : lib.TestIds.BANNER;
  }
  return UNIT_IDS[placement]!;
}

/**
 * Espaço de anúncio, sempre identificado como tal. Desaparece se não houver
 * anúncio para mostrar, e nunca aparece com Premium ou no Expo Go.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const isPremium = usePremium();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void initAds();
  }, []);

  const unitId = unitIdFor(placement);
  if (!lib || !unitId || isPremium || failed) return null;

  const { BannerAd, BannerAdSize } = lib;
  const size = placement === 'home' ? BannerAdSize.ANCHORED_ADAPTIVE_BANNER : BannerAdSize.MEDIUM_RECTANGLE;

  return (
    <View style={[s.wrap, placement === 'history' && s.card]} accessibilityLabel="Anúncio">
      {loaded ? <Text style={s.tag}>Anúncio</Text> : null}
      <BannerAd
        unitId={unitId}
        size={size}
        requestOptions={{ keywords: ['bar', 'restaurante', 'música', 'comida', 'eventos'] }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', overflow: 'hidden', gap: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12, gap: 8 },
  tag: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
