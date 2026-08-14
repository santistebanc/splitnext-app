import { listLobbyGroupIds } from '@/src/secrets/tokens';
import { createGroup } from '@/src/sync/groupSync';
import { joinGroup } from '@/src/sync/invite';
import { colors } from '@/src/ui/theme';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function LobbyScreen() {
  const router = useRouter();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitePaste, setInvitePaste] = useState('');

  const refresh = useCallback(async () => {
    setGroupIds(await listLobbyGroupIds());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createGroup();
      await refresh();
      router.push(`/group/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create_failed');
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!invitePaste.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinGroup(invitePaste);
      await refresh();
      router.push(`/group/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'join_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SplitNext</Text>
      <Text style={styles.sub}>Walking skeleton — create a group to prove sync.</Text>

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void onCreate()}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : (
          <Text style={styles.buttonText}>Create group</Text>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        value={invitePaste}
        onChangeText={setInvitePaste}
        placeholder="Paste invite token or join link"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={[styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={() => void onJoin()}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Join group</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>On this device</Text>
      {groupIds.length === 0 ? (
        <Text style={styles.empty}>No groups yet.</Text>
      ) : (
        groupIds.map((id) => (
          <Pressable
            key={id}
            style={styles.row}
            onPress={() => router.push(`/group/${id}`)}
            accessibilityRole="button"
          >
            <Text style={styles.rowText}>{id}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 16,
    color: colors.ink,
    opacity: 0.75,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.accent,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
  },
  section: {
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.ink,
    opacity: 0.6,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink,
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink,
  },
});
