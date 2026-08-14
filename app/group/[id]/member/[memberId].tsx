import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import { settlementHref } from '@/src/domain/expensePrefill';
import {
  settlementsForMember,
  suggestSettlements,
} from '@/src/domain/settle';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup } from '@/src/sync/groupSync';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);

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

  const nameOf = (id: string, displayName: string) =>
    memberLabel(displayName, id === assumedMemberId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net balance</Text>
        <Text
          style={[
            styles.netAmt,
            net > 0 ? styles.amtPos : net < 0 ? styles.amtNeg : null,
          ]}
        >
          {formatMoney(net, group.currency_label, true)}
        </Text>
      </View>

      {transfers.length > 0 ? (
        <View testID="settle">
          <Text style={styles.sec}>Settle</Text>
          <Text style={styles.sub}>
            Suggested efficient transfers for the group
          </Text>
          {transfers.map((s, i) => {
            const amount = formatMoney(s.amount_cents, group.currency_label);
            const to = nameOf(s.to_member_id, s.to_display_name);
            const from = nameOf(s.from_member_id, s.from_display_name);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 48,
    backgroundColor: colors.bg,
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
    color: colors.muted,
    fontSize: 14,
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
  sec: {
    marginTop: 18,
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
  },
});
