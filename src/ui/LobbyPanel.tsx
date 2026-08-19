import {
  lobbyGroupTitle,
  lobbyMemberSummary,
} from '@/src/domain/lobby';
import { getGroupStore } from '@/src/store/groupStore';
import { joinGroup } from '@/src/sync/invite';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  listLobbyGroupIds,
} from '@/src/secrets/tokens';

type GroupRowProps = {
  groupId: string;
  onSelect: (groupId: string) => void;
};

function LobbyGroupRow({ groupId, onSelect }: GroupRowProps) {
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const title = lobbyGroupTitle(group.name);
  const summary = lobbyMemberSummary(members ?? {});
  const label = summary ? `${title}, ${summary}` : title;

  return (
    <Pressable
      style={styles.row}
      onPress={() => onSelect(groupId)}
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

type Props = {
  currentGroupId?: string;
  onSelectGroup: (groupId: string) => void;
  onClose?: () => void;
};

export function LobbyPanel({ currentGroupId, onSelectGroup, onClose }: Props) {
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      onSelectGroup(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'join_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="lobby-panel" style={styles.screen}>
      {onClose ? (
        <View style={styles.head}>
          <Text style={styles.headerTitle}>Groups</Text>
          <Pressable
            testID="lobby-close"
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          onClose ? styles.containerOverlay : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!onClose ? <Text style={styles.brand}>SplitNext</Text> : null}

        {groupIds.length > 0 ? (
          <View>
            <Text style={styles.section}>groups</Text>
            {groupIds.map((id) => (
              <LobbyGroupRow
                key={id}
                groupId={id}
                onSelect={onSelectGroup}
              />
            ))}
          </View>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={() => router.push('/create')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Create group</Text>
        </Pressable>

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
        {currentGroupId ? null : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  containerOverlay: {
    justifyContent: 'flex-start',
    paddingTop: 8,
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
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
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
