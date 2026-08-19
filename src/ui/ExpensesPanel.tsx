import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { expenseEditHref } from '@/src/domain/expensePrefill';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup } from '@/src/sync/groupSync';
import { expenseIsPending } from '@/src/sync/queuePolicy';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  groupId: string;
  onClose: () => void;
  onOpenExpense?: (expenseId: string) => void;
};

export function ExpensesPanel({ groupId, onClose, onOpenExpense }: Props) {
  const router = useRouter();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const queue = useValue(store$.queue);
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

  const expenseList = useMemo(
    () =>
      Object.values(expenses ?? {})
        .filter((e) => e.deleted_at == null)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [expenses],
  );

  const nameOf = (memberId: string) => {
    const m = (members ?? {})[memberId];
    return memberLabel(m?.display_name ?? '', memberId === assumedMemberId);
  };

  return (
    <View testID="expenses-panel" style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.headerTitle}>All expenses</Text>
        <Pressable
          testID="expenses-close"
          style={styles.closeBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {expenseList.length === 0 ? (
          <Text style={styles.hint}>
            {assumedMemberId
              ? 'No expenses yet — add the first one.'
              : 'This device is not a member of this group; expenses are recorded against you.'}
          </Text>
        ) : (
          expenseList.map((e) => {
            const pending = expenseIsPending(queue ?? [], e.id);
            const title = e.description || '(no description)';
            return (
              <Pressable
                key={e.id}
                testID="expense-row"
                style={styles.row}
                onPress={() =>
                  onOpenExpense
                    ? onOpenExpense(e.id)
                    : router.push(expenseEditHref(groupId, e.id) as Href)
                }
                accessibilityRole="button"
                accessibilityLabel={pending ? `${title}, pending` : title}
              >
                <View style={styles.body}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.sub}>
                    {nameOf(e.payer_member_id)}
                    {e.allocations?.length
                      ? ` · split ${e.allocations.length} way${e.allocations.length === 1 ? '' : 's'}`
                      : ''}
                    {pending ? (
                      <Text style={styles.pending}> · Pending</Text>
                    ) : null}
                  </Text>
                </View>
                <Text style={styles.amt}>
                  {formatMoney(e.amount_cents, group.currency_label)}
                </Text>
              </Pressable>
            );
          })
        )}
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
  container: {
    padding: 14,
    paddingBottom: 48,
    backgroundColor: colors.bg,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    color: colors.ink,
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.muted,
  },
  pending: {
    fontSize: 13,
    color: colors.warn,
  },
  amt: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.ink,
  },
});
