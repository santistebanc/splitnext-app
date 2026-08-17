import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
  memberIsClaimed,
} from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import { lobbyGroupTitle } from '@/src/domain/lobby';
import { getGroupStore } from '@/src/store/groupStore';
import { addMember, openGroup } from '@/src/sync/groupSync';
import { mintInvite } from '@/src/sync/invite';
import { inviteShareText } from '@/src/sync/inviteShareText';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

async function copyText(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // The visible join link is the fallback.
  }
}

/** Fewer members → larger rows, matching the hub-chrome prototype. */
function balScale(count: number): number {
  if (count <= 2) return 1.7;
  if (count <= 3) return 1.55;
  if (count <= 4) return 1.4;
  if (count <= 5) return 1.3;
  if (count <= 6) return 1.22;
  if (count <= 7) return 1.15;
  if (count <= 8) return 1.1;
  if (count <= 10) return 1.05;
  if (count <= 12) return 1;
  return 0.95;
}

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const router = useRouter();
  const navigation = useNavigation();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const addRef = useRef<TextInput>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  const title = lobbyGroupTitle(group.name);
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title,
      headerLeft: () => (
        <Pressable
          onPress={() => router.navigate('/')}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerBack}
        >
          <Text style={styles.headerBackText}>←</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, title]);

  useEffect(() => {
    if (addOpen) addRef.current?.focus();
  }, [addOpen]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );
  const namesOnly = bindingIsOpen(expenses ?? {});
  const scale = balScale(balances.length);

  const onAdd = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await addMember(groupId, newName);
      setNewName('');
      setAddOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const onInvite = async (memberId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await mintInvite(groupId, memberId);
      if (!token) {
        setJoinLink(null);
        return;
      }
      const link = inviteShareText(token);
      setJoinLink(link);
      await copyText(link);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        testID="balances"
      >
        {lastError ? (
          <Text style={styles.error}>
            {lastError.code}: {lastError.message}
          </Text>
        ) : null}

        {namesOnly && joinLink ? (
          <View style={styles.joinBlock}>
            <Text style={styles.joinHint}>
              Join link copied — paste it on the other device, or open it there.
            </Text>
            <Text selectable style={styles.mono} accessibilityLabel="Join link">
              {joinLink}
            </Text>
          </View>
        ) : null}

        {balances.length === 0 ? (
          <Text style={styles.hint}>No members yet.</Text>
        ) : namesOnly ? (
          balances.map((b) => {
            const isYou = b.member_id === assumedMemberId;
            const claimed = memberIsClaimed(binds ?? {}, b.member_id);
            const label = memberLabel(b.display_name, isYou);
            return (
              <View
                key={b.member_id}
                style={[styles.balRow, isYou ? styles.balRowYou : null]}
              >
                <Text
                  style={[
                    styles.rosterName,
                    isYou ? styles.balNameYou : null,
                    { fontSize: (isYou ? 17 : 15) * scale },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {!claimed ? (
                  <Pressable
                    style={[styles.chip, busy ? styles.disabled : null]}
                    onPress={() => void onInvite(b.member_id)}
                    accessibilityRole="button"
                    disabled={busy}
                  >
                    <Text style={styles.chipText}>Invite</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          balances.map((b) => {
            const isYou = b.member_id === assumedMemberId;
            const label = memberLabel(b.display_name, isYou);
            const amt = formatMoney(b.net_cents, group.currency_label, true);
            const amtStyle =
              b.net_cents > 0
                ? styles.amtPos
                : b.net_cents < 0
                  ? styles.amtNeg
                  : styles.amt;
            return (
              <Pressable
                key={b.member_id}
                testID="balance-row"
                style={[styles.balRow, isYou ? styles.balRowYou : null]}
                onPress={() =>
                  router.push(`/group/${groupId}/member/${b.member_id}` as Href)
                }
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.balName,
                    isYou ? styles.balNameYou : null,
                    { fontSize: (isYou ? 17 : 15) * scale },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                <Text
                  style={[
                    amtStyle,
                    isYou ? styles.amtYou : null,
                    { fontSize: (isYou ? 18 : 16) * scale },
                  ]}
                >
                  {amt}
                </Text>
              </Pressable>
            );
          })
        )}

        {namesOnly ? (
          <View style={styles.addBlock}>
            <TextInput
              style={styles.addField}
              value={newName}
              onChangeText={setNewName}
              placeholder="Member name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />
            <Pressable
              style={[styles.add, busy ? styles.disabled : null]}
              onPress={() => void onAdd()}
              accessibilityRole="button"
              disabled={busy}
            >
              <Text style={styles.addText}>Add member</Text>
            </Pressable>
          </View>
        ) : null}

        {!namesOnly ? (
          <View style={styles.footer}>
            {addOpen ? (
              <TextInput
                ref={addRef}
                style={styles.addQuietField}
                value={newName}
                onChangeText={setNewName}
                placeholder="Member name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void onAdd()}
                onBlur={() => setAddOpen(false)}
                editable={!busy}
              />
            ) : (
              <Pressable
                onPress={() => setAddOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Add member"
              >
                <Text style={styles.addQuiet}>Add member</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push(`/group/${groupId}/expenses` as Href)}
              accessibilityRole="button"
            >
              <Text style={styles.balLink}>All expenses →</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.fabBar}>
        <Pressable
          style={styles.fabIcon}
          onPress={() => router.push(`/group/${groupId}/settings` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Text style={styles.fabIconText}>⚙</Text>
        </Pressable>
        {assumedMemberId ? (
          <Pressable
            style={styles.fab}
            onPress={() => router.push(`/group/${groupId}/expense/new` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Add expense"
          >
            <Text style={styles.fabText}>+ Expense</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingBottom: 96,
  },
  headerBack: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 18,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  hint: {
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  balRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  balRowYou: {
    backgroundColor: colors.youRow,
  },
  joinBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 6,
  },
  joinHint: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.youRow,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  rosterName: {
    flex: 1,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'left',
  },
  balName: {
    flex: 1,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'right',
  },
  balNameYou: {
    fontWeight: '700',
  },
  amt: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.ink,
  },
  amtPos: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.accent,
  },
  amtNeg: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.warn,
  },
  amtYou: {
    fontWeight: '700',
  },
  addBlock: {
    paddingHorizontal: 14,
    paddingTop: 16,
    gap: 8,
  },
  addField: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  add: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  addText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  fabBar: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'box-none',
  },
  fabIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconText: {
    fontSize: 22,
    color: colors.accent,
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  addQuiet: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  addQuietField: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  balLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  fab: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  fabText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
  },
});
