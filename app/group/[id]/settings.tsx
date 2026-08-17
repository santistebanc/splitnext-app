import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { settingsDoneEnabled } from '@/src/domain/group';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup, updateGroup } from '@/src/sync/groupSync';
import { leaveGroup } from '@/src/sync/leave';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { ConfirmDrawer } from '@/src/ui/ConfirmDrawer';
import { CurrencySelect } from '@/src/ui/CurrencySelect';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const router = useRouter();
  const navigation = useNavigation();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const binds = useValue(store$.binds);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency_label);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  useEffect(() => {
    setGroupName(group.name);
    setCurrency(group.currency_label);
  }, [group.name, group.currency_label]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );
  const canDone = settingsDoneEnabled(groupName, assumedMemberId);

  const onDone = async () => {
    if (!canDone || busy || leaving) return;
    setBusy(true);
    try {
      await updateGroup(groupId, {
        name: groupName.trim(),
        currency_label: currency.trim(),
      });
      router.replace(`/group/${groupId}` as Href);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Settings',
      headerRight: () => (
        <Pressable
          onPress={() => void onDone()}
          disabled={!canDone || busy || leaving}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[styles.headerDone, !canDone || busy || leaving ? styles.disabled : null]}
        >
          <Text style={styles.headerDoneText}>Done</Text>
        </Pressable>
      ),
    });
  }, [navigation, canDone, busy, leaving, groupName, currency, groupId]);

  const onLeave = async () => {
    if (leaving || busy) return;
    setLeaving(true);
    const ok = await leaveGroup(groupId);
    setLeaving(false);
    if (ok) {
      router.replace('/' as Href);
      return;
    }
    setConfirming(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {lastError ? (
        <Text style={styles.error}>
          {lastError.code}: {lastError.message}
        </Text>
      ) : null}

      <View style={styles.section}>
        <View style={styles.fieldGroup}>
          <Text style={styles.sec}>Group name</Text>
          <TextInput
            style={styles.field}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.sec}>Currency</Text>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </View>
        {!groupName.trim() ? (
          <Text style={styles.hint}>Name the group to continue.</Text>
        ) : !assumedMemberId ? (
          <Text style={styles.hint}>
            This device is not a member of this group.
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.done, !canDone || busy || leaving ? styles.disabled : null]}
          onPress={() => void onDone()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          disabled={!canDone || busy || leaving}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.danger}>
        <Pressable
          testID="leave"
          style={[styles.leave, busy || leaving ? styles.disabled : null]}
          onPress={() => setConfirming(true)}
          accessibilityRole="button"
          accessibilityLabel="Leave group"
          disabled={busy || leaving}
        >
          <Text style={styles.leaveText}>Leave group</Text>
        </Pressable>
      </View>

      <ConfirmDrawer
        visible={confirming}
        onRequestClose={() => setConfirming(false)}
        title="Leave group?"
        message={`You’ll leave ${group.name.trim() || 'this group'}. Outstanding balances stay until settled.`}
        confirmLabel="Leave group"
        onConfirm={() => void onLeave()}
        testID="leave-confirm"
        confirmTestID="leave-confirm-ok"
        destructive
        busy={leaving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 24,
    backgroundColor: colors.bg,
  },
  section: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  error: {
    color: colors.danger,
  },
  sec: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  headerDone: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerDoneText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  done: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  doneText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  danger: {
    paddingTop: 8,
  },
  leave: {
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
  },
  leaveText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
