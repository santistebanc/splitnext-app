import { joinGroup } from '@/src/sync/invite';
import { colors } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const raw = Array.isArray(token) ? token[0] : token;
    if (!raw) {
      setError('invite_invalid');
      return;
    }
    started.current = true;
    void joinGroup(raw)
      .then((id) => {
        router.replace(`/group/${id}`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'join_failed');
      });
  }, [token, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>Joining the group…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: 16,
    color: colors.ink,
    opacity: 0.75,
  },
  error: {
    color: colors.danger,
    fontSize: 16,
  },
});
