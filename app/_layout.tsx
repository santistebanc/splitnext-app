import { useLobbyForegroundSync } from '@/src/sync/appForegroundSync';
import { usePushNotificationOpen } from '@/src/push/usePushNotificationOpen';
import { colors } from '@/src/ui/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  useLobbyForegroundSync();
  usePushNotificationOpen();

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
