import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#f2efe8' },
          headerTintColor: '#1a1c16',
          contentStyle: { backgroundColor: '#f2efe8' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SplitNext' }} />
        <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
      </Stack>
    </>
  );
}
