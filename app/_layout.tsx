import { useLobbyForegroundSync } from '@/src/sync/appForegroundSync';
import { usePushNotificationOpen } from '@/src/push/usePushNotificationOpen';
import { colors } from '@/src/ui/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  useLobbyForegroundSync();
  usePushNotificationOpen();

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
        <Stack.Screen
          name="index"
          options={{ headerShown: false, title: 'SplitNext' }}
        />
        <Stack.Screen name="create" options={{ title: 'Create group' }} />
        <Stack.Screen name="join" options={{ title: 'Join group' }} />
        <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
