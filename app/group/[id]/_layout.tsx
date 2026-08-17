import { colors } from '@/src/ui/theme';
import { Stack } from 'expo-router';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Group' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="member/[memberId]" options={{ title: 'Member' }} />
      <Stack.Screen name="expenses" options={{ title: 'All expenses' }} />
      <Stack.Screen name="expense/new" options={{ title: 'New expense' }} />
    </Stack>
  );
}
