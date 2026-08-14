import { useLobbyForegroundSync } from '@/src/sync/appForegroundSync';
import { colors } from '@/src/ui/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  useLobbyForegroundSync();

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SplitNext' }} />
        <Stack.Screen name="join" options={{ title: 'Join group' }} />
        <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
