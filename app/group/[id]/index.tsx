import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
} from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import { getGroupStore } from '@/src/store/groupStore';
import {
  addMember,
  bindMe,
  bumpGroupName,
  openGroup,
} from '@/src/sync/groupSync';
import { mintInvite } from '@/src/sync/invite';
import { inviteShareText } from '@/src/sync/inviteShareText';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { formatMoney, memberLabel } from '@/src/ui/format';
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
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinLink, setJoinLink] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  const title = group.name === '' ? '(empty)' : group.name;
  useEffect(() => {
    navigation.setOptions({
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

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );
  /** Every member stays offerable until the first expense lands. */
  const canChoose = useMemo(() => bindingIsOpen(expenses ?? {}), [expenses]);

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );
  const scale = balScale(balances.length);

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
    if (busy || !canChoose) return;
    setBusy(true);
    try {
      await bindMe(groupId, memberId);
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

        {joinLink ? (
          <>
            <Text style={styles.hint}>
              Join link copied — paste it on the other device, or open it there.
            </Text>
            <Text selectable style={styles.mono} accessibilityLabel="Join link">
              {joinLink}
            </Text>
          </>
        ) : null}

        {balances.length === 0 ? (
          <Text style={styles.hint}>No members yet — add yourself first.</Text>
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
              <View
                key={b.member_id}
                style={[styles.balRow, isYou ? styles.balRowYou : null]}
              >
                <Pressable
                  testID="balance-row"
                  style={styles.balOpen}
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
                <View style={styles.chips}>
                  {!isYou ? (
                    <Pressable
                      style={styles.chip}
                      onPress={() => void onInvite(b.member_id)}
                      accessibilityRole="button"
                      disabled={busy}
                    >
                      <Text style={styles.chipText}>Invite</Text>
                    </Pressable>
                  ) : null}
                  {canChoose && !isYou ? (
                    <Pressable
                      style={styles.chip}
                      onPress={() => void onBind(b.member_id)}
                      accessibilityRole="button"
                      disabled={busy}
                    >
                      <Text style={styles.chipText}>This is me</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push(`/group/${groupId}/expenses` as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.balLink}>All expenses →</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Member name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
        />
        <Pressable
          style={[styles.addMember, busy ? styles.buttonDisabled : null]}
          onPress={() => void onAdd()}
          accessibilityRole="button"
          disabled={busy}
        >
          <Text style={styles.addMemberText}>Add member</Text>
        </Pressable>

        <Pressable
          style={styles.bump}
          onPress={onBump}
          accessibilityRole="button"
        >
          <Text style={styles.bumpText}>Bump name (merge + wake)</Text>
        </Pressable>
      </ScrollView>

      {assumedMemberId ? (
        <View style={styles.fabBar}>
          <Pressable
            style={[styles.fab, busy ? styles.buttonDisabled : null]}
            onPress={() => router.push(`/group/${groupId}/expense/new` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Add expense"
            disabled={busy}
          >
            <Text style={styles.fabText}>+ Expense</Text>
          </Pressable>
        </View>
      ) : null}
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
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  balRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  balRowYou: {
    backgroundColor: colors.youRow,
  },
  balOpen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
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
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  balLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  input: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  addMember: {
    marginHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-end',
  },
  addMemberText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  bump: {
    marginTop: 24,
    marginHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bumpText: {
    color: colors.muted,
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  fabBar: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    pointerEvents: 'box-none',
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
