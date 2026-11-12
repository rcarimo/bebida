import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { Button, Card, Field, Header, Label, Screen, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { getSyncStatus, logout, onSyncStatus, syncNow, type SyncStatus } from '../lib/sync';
import { shortDate, time } from '../lib/format';
import { colors } from '../theme';

function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Esse email não parece válido.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou senha errados.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com esse email. Entra em vez de criar.';
    case 'auth/weak-password':
      return 'A senha precisa de pelo menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sem internet. Tenta outra vez quando tiveres rede.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Espera um pouco.';
    default:
      return e instanceof Error ? e.message : 'Algo correu mal.';
  }
}

export default function Perfil() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onSyncStatus(setStatus), []);

  async function submit() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    if (!email.trim()) {
      setError('Escreve o teu email primeiro.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email enviado', 'Vê a tua caixa de entrada para criar uma senha nova.');
    } catch (e) {
      setError(authError(e));
    }
  }

  function confirmLogout() {
    Alert.alert('Sair da conta?', 'Os teus dados ficam guardados na conta e saem deste telefone.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (e) {
            Alert.alert('Não deu para sair', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <Header title="Conta" onBack={() => router.back()} />

      {!isFirebaseConfigured ? (
        <Card style={{ gap: 8 }}>
          <T style={{ fontSize: 18, fontWeight: '700' }}>Sincronização ainda não configurada</T>
          <T style={{ color: colors.textSoft, lineHeight: 22 }}>
            A app está a guardar tudo só neste telefone. Para entrar com email e guardar os dados na conta, preenche o
            ficheiro .env com os dados do teu projeto Firebase (ver README).
          </T>
        </Card>
      ) : status.user ? (
        <>
          <Card style={{ gap: 6 }}>
            <Label>Ligado como</Label>
            <T style={{ fontSize: 20, fontWeight: '700' }}>{status.user.email}</T>
          </Card>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="cloud" color={status.state === 'error' ? colors.danger : colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontSize: 17, fontWeight: '700' }}>
                {status.state === 'syncing'
                  ? 'A sincronizar…'
                  : status.state === 'error'
                    ? 'Falhou a sincronização'
                    : 'Dados guardados na conta'}
              </T>
              <T style={{ color: colors.muted, fontSize: 14 }}>
                {status.state === 'error'
                  ? 'Tenta de novo quando tiveres internet.'
                  : status.lastSyncAt
                    ? `Última vez: ${shortDate(status.lastSyncAt)}, ${time(status.lastSyncAt)}`
                    : 'Ainda não sincronizou.'}
              </T>
            </View>
          </Card>
          <Button
            title="Sincronizar agora"
            variant="outline"
            height={64}
            fontSize={19}
            disabled={status.state === 'syncing'}
            onPress={() => void syncNow()}
          />
          <Button title="Sair da conta" variant="danger" height={56} fontSize={17} onPress={confirmLogout} />
        </>
      ) : (
        <>
          <T style={{ color: colors.textSoft, fontSize: 16, lineHeight: 22 }}>
            Entra com o teu email para guardar o histórico na conta e não perder nada se mudares de telefone. A app
            continua a funcionar sem internet.
          </T>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="nome@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : ''}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={submit}
          />
          {error ? <T style={{ color: colors.danger, fontSize: 15 }}>{error}</T> : null}
          <Button
            title={mode === 'login' ? 'Entrar' : 'Criar conta'}
            icon="check"
            disabled={busy || !email.trim() || password.length < 6}
            onPress={submit}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <T style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>
              {mode === 'login' ? 'Não tenho conta — criar' : 'Já tenho conta — entrar'}
            </T>
          </Pressable>
          {mode === 'login' ? (
            <Pressable accessibilityRole="button" onPress={resetPassword} style={{ paddingVertical: 8, alignItems: 'center' }}>
              <T style={{ color: colors.muted, fontSize: 15 }}>Esqueci a senha</T>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}
