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
      <Stack.Screen name="index" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, title: 'Settings' }} />
      <Stack.Screen name="member/[memberId]" options={{ headerShown: false, title: 'Member' }} />
      <Stack.Screen name="expenses" options={{ title: 'All expenses' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
      <Stack.Screen name="expense/new" options={{ title: 'New expense' }} />
      <Stack.Screen
        name="expense/[expenseId]"
        options={{ title: 'Edit expense' }}
      />
    </Stack>
  );
}
