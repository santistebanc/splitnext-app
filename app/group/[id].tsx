import { getGroupStore } from '@/src/store/groupStore';
import { bumpGroupName, openGroup } from '@/src/sync/groupSync';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const syncStatus = useValue(store$.syncStatus);
  const lastError = useValue(store$.lastError);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
  }, [groupId]);

  const onBump = () => {
    void bumpGroupName(groupId, 'Demo ' + (group.version + 1));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group id</Text>
      <Text style={styles.mono}>{group.id}</Text>

      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{group.name === '' ? '(empty)' : group.name}</Text>

      <Text style={styles.label}>Version</Text>
      <Text style={styles.mono}>{String(group.version)}</Text>

      <Text style={styles.label}>Sync</Text>
      <Text style={styles.status}>{syncStatus}</Text>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={onBump}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Bump name (merge + wake)</Text>
      </Pressable>

      <Text style={styles.hint}>
        on_server / fetched means the remote path worked. Kill the app and
        reopen — the group should still be here from SQLite.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 8,
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
    fontSize: 20,
    color: '#1a1c16',
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
  button: {
    marginTop: 24,
    backgroundColor: '#1f6b4a',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#f2efe8',
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
