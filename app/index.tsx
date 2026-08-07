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
import { isWellFormedInviteCode } from '@/src/domain/inviteCode';
import { listLobbyGroupIds } from '@/src/secrets/tokens';
import { createGroup, redeemInvite } from '@/src/sync/groupSync';

/** What each redeem failure means to the person holding the code. */
const JOIN_MESSAGES: Record<string, string> = {
  invalid_code: 'That code does not match an invite.',
  already_redeemed: 'That code has already been used.',
  expired: 'That invite has expired — ask for a new one.',
  member_gone: 'The person that invite was for is no longer in the group.',
  member_already_bound:
    'Someone already joined as that person — ask for a new invite.',
  already_joined: 'You are already in that group.',
};

export default function LobbyScreen() {
  const router = useRouter();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

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
    if (busy || !isWellFormedInviteCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      const { groupId } = await redeemInvite(code);
      setCode('');
      await refresh();
      router.push(`/group/${groupId}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'join_failed';
      setError(JOIN_MESSAGES[reason] ?? `Could not join: ${reason}`);
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
          <ActivityIndicator color="#f2efe8" />
        ) : (
          <Text style={styles.buttonText}>Create group</Text>
        )}
      </Pressable>

      <Text style={styles.section}>Join with code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => {
          setCode(text);
          if (error) setError(null);
        }}
        placeholder="ABCD-2345"
        placeholderTextColor="#8a8d82"
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Invite code"
      />
      <Pressable
        style={[
          styles.secondaryButton,
          (busy || !isWellFormedInviteCode(code)) && styles.buttonDisabled,
        ]}
        onPress={() => void onJoin()}
        disabled={busy || !isWellFormedInviteCode(code)}
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
    color: '#1a1c16',
  },
  sub: {
    fontSize: 16,
    color: '#1a1c16',
    opacity: 0.75,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1f6b4a',
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#f2efe8',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#8b1e1e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d6cc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: '#1a1c16',
    backgroundColor: '#fff',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1f6b4a',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1f6b4a',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c16',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    color: '#1a1c16',
    opacity: 0.6,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1c16',
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#1a1c16',
  },
});
