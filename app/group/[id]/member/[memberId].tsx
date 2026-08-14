import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import {
  memberBuckets,
  type BucketLine,
} from '@/src/domain/buckets';
import { settlementHref } from '@/src/domain/expensePrefill';
import {
  settlementsForMember,
  suggestSettlements,
} from '@/src/domain/settle';
import { getGroupStore } from '@/src/store/groupStore';
import { leaveGroup } from '@/src/sync/leave';
import { openGroup } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function bucketLineLabel(
  line: BucketLine,
  nameOf: (id: string) => string,
): string {
  const desc = line.description || '(no description)';
  const names = line.counterpart_ids.map(nameOf);
  return names.length > 0 ? `${desc} · ${names.join(' + ')}` : desc;
}

export default function MemberScreen() {
  const { id, memberId } = useLocalSearchParams<{
    id: string;
    memberId: string;
  }>();
  const groupId = id ?? '';
  const targetId = memberId ?? '';
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
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [offerLeave, setOfferLeave] = useState(false);

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

  const member = (members ?? {})[targetId];
  const isYou = targetId === assumedMemberId;
  const subjectName = member
    ? memberLabel(member.display_name, false)
    : '(unnamed)';
  const title = member
    ? memberLabel(member.display_name, isYou)
    : '(unnamed)';

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );
  const net = balances.find((b) => b.member_id === targetId)?.net_cents ?? 0;
  const transfers = useMemo(
    () => settlementsForMember(suggestSettlements(balances), targetId),
    [balances, targetId],
  );
  const buckets = useMemo(
    () => memberBuckets(targetId, members ?? {}, expenses ?? {}),
    [targetId, members, expenses],
  );

  const nameOf = (id: string) => {
    const m = (members ?? {})[id];
    return memberLabel(m?.display_name ?? '', id === assumedMemberId);
  };

  const currency = group.currency_label;
  const paidHeading = isYou ? 'You paid for' : `${subjectName} paid for`;
  const owesHeading = isYou ? 'You owe for' : `${subjectName} owes for`;
  const showLeave = isYou || offerLeave;

  const onLeave = async () => {
    if (leaving) return;
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
      <Bucket
        testID="paid-for"
        heading={paidHeading}
        lines={buckets.paidFor}
        currency={currency}
        nameOf={nameOf}
      />
      <Bucket
        testID="owes-for"
        heading={owesHeading}
        lines={buckets.owesFor}
        currency={currency}
        nameOf={nameOf}
      />

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net balance</Text>
        <Text
          style={[
            styles.netAmt,
            net > 0 ? styles.amtPos : net < 0 ? styles.amtNeg : null,
          ]}
        >
          {formatMoney(net, currency, true)}
        </Text>
      </View>

      {transfers.length > 0 ? (
        <View testID="settle" style={styles.settle}>
          <Text style={styles.sec}>Settle</Text>
          <Text style={styles.sub}>
            Suggested efficient transfers for the group
          </Text>
          {transfers.map((s, i) => {
            const amount = formatMoney(s.amount_cents, currency);
            const to = nameOf(s.to_member_id);
            const from = nameOf(s.from_member_id);
            const label = isYou
              ? `Pay ${amount} to ${to}`
              : `${from} pays ${amount} to ${to}`;
            return (
              <Pressable
                key={`${s.from_member_id}-${s.to_member_id}-${i}`}
                testID="settle-row"
                style={styles.pay}
                onPress={() => router.push(settlementHref(groupId, s) as Href)}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={styles.payText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {lastError ? (
        <Text style={styles.err}>
          {lastError.code}: {lastError.message}
        </Text>
      ) : null}

      {showLeave ? (
        <View style={styles.danger}>
          {confirming ? (
            <View testID="leave-confirm">
              <Text style={styles.confirmTitle}>Leave group?</Text>
              <Text style={styles.confirmCopy}>
                You’ll leave {group.name.trim() || 'this group'}. Outstanding
                balances stay until settled.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.cancel}
                  onPress={() => setConfirming(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  disabled={leaving}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="leave-confirm-ok"
                  style={styles.leaveOk}
                  onPress={() => void onLeave()}
                  accessibilityRole="button"
                  accessibilityLabel="Leave group"
                  disabled={leaving}
                >
                  <Text style={styles.leaveOkText}>Leave group</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              testID="leave"
              style={styles.leave}
              onPress={() => {
                setOfferLeave(true);
                setConfirming(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Leave group"
            >
              <Text style={styles.leaveText}>Leave group</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Bucket({
  testID,
  heading,
  lines,
  currency,
  nameOf,
}: {
  testID: string;
  heading: string;
  lines: BucketLine[];
  currency: string;
  nameOf: (id: string) => string;
}) {
  return (
    <View testID={testID} style={styles.bucket}>
      <Text style={styles.sec}>{heading}</Text>
      {lines.length === 0 ? (
        <Text style={styles.empty}>None</Text>
      ) : (
        lines.map((line) => {
          const left = bucketLineLabel(line, nameOf);
          return (
            <View key={line.expense_id} testID="bucket-line" style={styles.line}>
              <Text style={styles.lineLeft}>{left}</Text>
              <Text
                style={[
                  styles.lineAmt,
                  line.amount_cents > 0
                    ? styles.amtPos
                    : line.amount_cents < 0
                      ? styles.amtNeg
                      : null,
                ]}
              >
                {formatMoney(line.amount_cents, currency, true)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 48,
    backgroundColor: colors.bg,
  },
  bucket: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  empty: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  lineLeft: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
  },
  lineAmt: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.ink,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  netLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  netAmt: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 16,
    color: colors.ink,
  },
  amtPos: {
    color: colors.accent,
  },
  amtNeg: {
    color: colors.warn,
  },
  settle: {
    marginTop: 16,
  },
  sec: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  sub: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  pay: {
    backgroundColor: colors.accent,
    padding: 14,
    marginTop: 8,
  },
  payText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
  },
  err: {
    marginTop: 16,
    color: colors.danger,
    fontSize: 13,
  },
  danger: {
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
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
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  confirmCopy: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 14,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  leaveOk: {
    flex: 1,
    backgroundColor: colors.danger,
    padding: 14,
    alignItems: 'center',
  },
  leaveOkText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
  },
});
