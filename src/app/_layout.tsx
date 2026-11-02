import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../lib/db';
import { startSync } from '../lib/sync';
import { colors } from '../theme';

export default function RootLayout() {
  useEffect(() => {
    void getDb().then(() => startSync());
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="noite/[nightId]" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
