import {
  lobbyGroupTitle,
  lobbyMemberSummary,
} from '@/src/domain/lobby';
import { listLobbyGroupIds } from '@/src/secrets/tokens';
import { getGroupStore } from '@/src/store/groupStore';
import { joinGroup } from '@/src/sync/invite';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function LobbyGroupRow({ groupId }: { groupId: string }) {
  const router = useRouter();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const title = lobbyGroupTitle(group.name);
  const summary = lobbyMemberSummary(members ?? {});
  const label = summary ? `${title}, ${summary}` : title;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/group/${groupId}`)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {summary ? (
        <Text style={styles.rowMembers} numberOfLines={1}>
          {summary}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function LobbyScreen() {
  const router = useRouter();
  const joinRef = useRef<TextInput>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitePaste, setInvitePaste] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);

  const refresh = useCallback(async () => {
    setGroupIds(await listLobbyGroupIds());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (joinOpen) joinRef.current?.focus();
  }, [joinOpen]);

  const onJoin = async () => {
    if (!invitePaste.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinGroup(invitePaste);
      await refresh();
      setJoinOpen(false);
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

      <Pressable
        style={styles.button}
        onPress={() => router.push('/create')}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Create group</Text>
      </Pressable>

      <Text style={styles.section}>On this device</Text>
      {groupIds.length === 0 ? (
        <Text style={styles.empty}>No groups yet.</Text>
      ) : (
        groupIds.map((id) => <LobbyGroupRow key={id} groupId={id} />)
      )}

      {joinOpen ? (
        <TextInput
          ref={joinRef}
          style={styles.input}
          value={invitePaste}
          onChangeText={setInvitePaste}
          placeholder="Paste invite token or join link"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void onJoin()}
          onBlur={() => setJoinOpen(false)}
          editable={!busy}
        />
      ) : (
        <Pressable
          onPress={() => setJoinOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Join with link"
        >
          <Text style={styles.joinLink}>Join with link</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  button: {
    backgroundColor: colors.accent,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  joinLink: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  error: {
    color: colors.danger,
  },
  section: {
    marginTop: 12,
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
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  rowMembers: {
    fontSize: 13,
    color: colors.muted,
  },
});
