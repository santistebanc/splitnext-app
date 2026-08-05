import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  deviceHasActiveBind,
} from '@/src/domain/assumedMember';
import { getGroupStore } from '@/src/store/groupStore';
import {
  addMember,
  bindMe,
  bumpGroupName,
  openGroup,
} from '@/src/sync/groupSync';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const syncStatus = useValue(store$.syncStatus);
  const lastError = useValue(store$.lastError);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );
  const alreadyBound = useMemo(
    () =>
      deviceUserId
        ? deviceHasActiveBind(binds ?? {}, deviceUserId)
        : true,
    [binds, deviceUserId],
  );

  const memberList = useMemo(
    () =>
      Object.values(members ?? {})
        .filter((m) => m.deleted_at == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  );

  const onBump = () => {
    void bumpGroupName(groupId, 'Demo ' + (group.version + 1));
  };

  const onAdd = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await addMember(groupId, newName);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  const onBind = async (memberId: string) => {
    if (busy || alreadyBound) return;
    setBusy(true);
    try {
      await bindMe(groupId, memberId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Group id</Text>
      <Text style={styles.mono}>{group.id}</Text>

      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{group.name === '' ? '(empty)' : group.name}</Text>

      <Text style={styles.label}>Version</Text>
      <Text style={styles.mono}>{String(group.version)}</Text>

      <Text style={styles.label}>Sync</Text>
      <Text style={styles.status}>{syncStatus}</Text>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <Text style={styles.label}>Members</Text>
      {memberList.length === 0 ? (
        <Text style={styles.hint}>No members yet — add yourself first.</Text>
      ) : (
        memberList.map((m) => {
          const isYou = m.id === assumedMemberId;
          const label =
            m.display_name === ''
              ? '(unnamed)'
              : isYou
                ? `You (${m.display_name})`
                : m.display_name;
          return (
            <View key={m.id} style={styles.memberRow}>
              <Text style={isYou ? styles.you : styles.value}>{label}</Text>
              {!alreadyBound ? (
                <Pressable
                  style={styles.smallButton}
                  onPress={() => void onBind(m.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.smallButtonText}>This is me</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <TextInput
        style={styles.input}
        value={newName}
        onChangeText={setNewName}
        placeholder="Member name"
        placeholderTextColor="#8a8d82"
        autoCapitalize="words"
      />
      <Pressable
        style={[styles.button, busy ? styles.buttonDisabled : null]}
        onPress={() => void onAdd()}
        accessibilityRole="button"
        disabled={busy}
      >
        <Text style={styles.buttonText}>Add member</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={onBump}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Bump name (merge + wake)</Text>
      </Pressable>

      <Text style={styles.hint}>
        Add a member, tap This is me, kill and reopen — You (Name) should stick.
        Another device with this group pulls the roster on open.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 8,
    paddingBottom: 48,
  },
  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1c16',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 18,
    color: '#1a1c16',
  },
  you: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f6b4a',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#1a1c16',
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6b4a',
  },
  error: {
    color: '#8b1e1e',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d9d6cc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1c16',
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1f6b4a',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#f2efe8',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    backgroundColor: '#1f6b4a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#f2efe8',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 16,
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
  hint: {
    marginTop: 16,
    fontSize: 14,
    color: '#1a1c16',
    opacity: 0.7,
    lineHeight: 20,
  },
});
