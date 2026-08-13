import { Stack } from 'expo-router';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f2efe8' },
        headerTintColor: '#1a1c16',
        contentStyle: { backgroundColor: '#f2efe8' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Group' }} />
      <Stack.Screen name="expense/new" options={{ title: 'New expense' }} />
    </Stack>
  );
}
