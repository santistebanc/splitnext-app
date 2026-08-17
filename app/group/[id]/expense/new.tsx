import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { patchExpense } from '@/src/domain/expense';
import {
  expensePrefillFromSearchParams,
  type ExpensePrefill,
} from '@/src/domain/expensePrefill';
import { getGroupStore } from '@/src/store/groupStore';
import { addExpense, openGroup, updateExpense } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { currencySymbol } from '@/src/domain/currency';
import { formatCents, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function sharingFromPrefill(
  memberIds: readonly string[],
  prefill: ExpensePrefill | null,
): Record<string, boolean> {
  if (!prefill) {
    return Object.fromEntries(memberIds.map((id) => [id, true]));
  }
  const want = new Set(prefill.participantIds);
  return Object.fromEntries(memberIds.map((id) => [id, want.has(id)]));
}

/** "12,34" and "12.34" both mean 1234 cents; anything else is not money. */
function parseCents(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{
    id: string;
    expenseId?: string;
    payer?: string;
    amount?: string;
    participants?: string;
    what?: string;
  }>();
  const groupId = params.id ?? '';
  const editingId =
    typeof params.expenseId === 'string' ? params.expenseId : '';
  const router = useRouter();
  const navigation = useNavigation();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const editingRaw = editingId ? (expenses ?? {})[editingId] : undefined;
  const editing =
    editingRaw && editingRaw.deleted_at == null ? editingRaw : undefined;
  const prefill = editing ? null : expensePrefillFromSearchParams(params);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState(() =>
    prefill ? formatCents(prefill.amountCents) : '',
  );
  const [what, setWhat] = useState(() => prefill?.what ?? '');
  const [payerId, setPayerId] = useState<string | null>(
    () => prefill?.payerId ?? null,
  );
  const [sharing, setSharing] = useState<Readonly<Record<string, boolean>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

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

  const memberList = useMemo(
    () =>
      Object.values(members ?? {})
        .filter((m) => m.deleted_at == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  );

  useEffect(() => {
    navigation.setOptions({
      title: editing ? 'Edit expense' : 'New expense',
    });
  }, [navigation, editing]);

  useEffect(() => {
    if (!editing || memberList.length === 0) return;
    if (hydratedId === editing.id) return;
    setAmount(formatCents(editing.amount_cents));
    setWhat(editing.description);
    setPayerId(editing.payer_member_id);
    const allocated = new Set(
      (editing.allocations ?? []).map((a) => a.member_id),
    );
    setSharing(
      Object.fromEntries(memberList.map((m) => [m.id, allocated.has(m.id)])),
    );
    setHydratedId(editing.id);
  }, [editing, hydratedId, memberList]);

  useEffect(() => {
    if (payerId != null) return;
    if (editing) return;
    if (assumedMemberId) setPayerId(assumedMemberId);
  }, [assumedMemberId, payerId, editing]);

  useEffect(() => {
    if (editing) return;
    if (sharing != null || memberList.length === 0) return;
    setSharing(sharingFromPrefill(memberList.map((m) => m.id), prefill));
  }, [memberList, sharing, prefill, editing]);

  const cents = parseCents(amount);
  const participantIds = Object.entries(sharing ?? {})
    .filter(([, on]) => on)
    .map(([memberId]) => memberId);
  const liveIds = memberList.map((m) => m.id);
  const draft =
    editing && cents !== null && cents > 0 && payerId != null
      ? patchExpense(
          editing,
          liveIds,
          {
            payerMemberId: payerId,
            amountCents: cents,
            description: what,
            participantMemberIds: participantIds,
          },
          editing.updated_at,
        )
      : undefined;
  const canSave =
    !busy &&
    cents !== null &&
    cents > 0 &&
    payerId != null &&
    participantIds.length > 0 &&
    (!editing || draft != null);

  const labelOf = (memberId: string, displayName: string) =>
    memberLabel(displayName, memberId === assumedMemberId);

  const toggleShare = (memberId: string) => {
    setSharing((current) => ({
      ...(current ?? {}),
      [memberId]: !(current ?? {})[memberId],
    }));
  };

  const onSave = async () => {
    if (!canSave || cents === null || payerId == null) return;
    setBusy(true);
    try {
      if (editing) {
        await updateExpense(groupId, editing.id, {
          payerMemberId: payerId,
          amountCents: cents,
          description: what,
          participantMemberIds: participantIds,
        });
        router.back();
        return;
      }
      const expenseId = await addExpense(groupId, {
        payerMemberId: payerId,
        amountCents: cents,
        description: what,
        participantMemberIds: participantIds,
      });
      if (expenseId) router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {lastError ? (
        <Text style={styles.error}>
          {lastError.code}: {lastError.message}
        </Text>
      ) : null}

      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder={`Amount (${currencySymbol(group.currency_label)})`}
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <TextInput
        style={styles.input}
        value={what}
        onChangeText={setWhat}
        placeholder="What for"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Paid by</Text>
      {memberList.map((m) => {
        const isPayer = m.id === payerId;
        const isYou = m.id === assumedMemberId;
        return (
          <Pressable
            key={m.id}
            style={styles.memberRow}
            onPress={() => setPayerId(m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isPayer }}
          >
            <Text style={isYou || isPayer ? styles.you : styles.value}>
              {labelOf(m.id, m.display_name)}
            </Text>
            <Text style={styles.hintInline}>{isPayer ? 'paying' : ''}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.label}>Split between</Text>
      {memberList.map((m) => {
        const on = sharing?.[m.id] === true;
        const isYou = m.id === assumedMemberId;
        return (
          <Pressable
            key={m.id}
            style={styles.memberRow}
            onPress={() => toggleShare(m.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={isYou ? styles.you : styles.value}>
              {on ? '✓ ' : '○ '}
              {labelOf(m.id, m.display_name)}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.button, !canSave ? styles.buttonDisabled : null]}
        onPress={() => void onSave()}
        accessibilityRole="button"
        disabled={!canSave}
        testID="expense-save"
      >
        <Text style={styles.buttonText}>
          {editing ? 'Save' : 'Add expense'}
        </Text>
      </Pressable>
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
    color: colors.ink,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 18,
    color: colors.ink,
  },
  you: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
  },
  error: {
    color: colors.danger,
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
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: '600',
  },
  hintInline: {
    fontSize: 14,
    color: colors.ink,
    opacity: 0.7,
  },
});
