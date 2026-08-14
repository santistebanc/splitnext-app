import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup } from '@/src/sync/groupSync';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
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

  useEffect(() => {
    navigation.setOptions({ title: 'All expenses' });
  }, [navigation]);

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
    <ScrollView contentContainerStyle={styles.container}>
      {expenseList.length === 0 ? (
        <Text style={styles.hint}>
          {assumedMemberId
            ? 'No expenses yet — add the first one. Adding it fixes who you are.'
            : 'Tap This is me on a member first; expenses are recorded against you.'}
        </Text>
      ) : (
        expenseList.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={styles.body}>
              <Text style={styles.title}>
                {e.description || '(no description)'}
              </Text>
              <Text style={styles.sub}>
                {nameOf(e.payer_member_id)}
                {e.allocations?.length
                  ? ` · split ${e.allocations.length} way${e.allocations.length === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.amt}>
              {formatMoney(e.amount_cents, group.currency_label)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  amt: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.ink,
  },
});
