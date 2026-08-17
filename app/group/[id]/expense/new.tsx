import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { patchExpense } from '@/src/domain/expense';
import {
  equalSplitState,
  deriveSplitEditor,
  splitStateFromAllocations,
  type SplitEditorState,
} from '@/src/domain/splitEditor';
import {
  expensePrefillFromSearchParams,
  type ExpensePrefill,
} from '@/src/domain/expensePrefill';
import { getGroupStore } from '@/src/store/groupStore';
import { addExpense, deleteExpense, openGroup, updateExpense } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { currencySymbol } from '@/src/domain/currency';
import { ConfirmDrawer } from '@/src/ui/ConfirmDrawer';
import { ExpenseAmountInput } from '@/src/ui/ExpenseAmountInput';
import { ExpenseSplitList } from '@/src/ui/expenseSplitList';
import { PayerSelect } from '@/src/ui/PayerSelect';
import { formatCents } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function splitStateFromPrefill(
  memberIds: readonly string[],
  prefill: ExpensePrefill | null,
): SplitEditorState {
  if (!prefill) return equalSplitState(memberIds);
  const want = new Set(prefill.participantIds);
  return {
    shares: Object.fromEntries(
      memberIds.map((id) => [id, want.has(id) ? 1 : 0]),
    ),
    fixedCents: {},
  };
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
  const [splitState, setSplitState] = useState<SplitEditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
      headerRight: editing
        ? () => (
            <Pressable
              testID="expense-delete"
              onPress={() => setConfirmingDelete(true)}
              disabled={busy || confirmingDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete expense"
              style={{ paddingHorizontal: 12, opacity: busy || confirmingDelete ? 0.5 : 1 }}
            >
              <Text style={styles.deleteHeader}>Delete</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, editing, busy, confirmingDelete]);

  const onDelete = useCallback(async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteExpense(groupId, editing.id);
      router.back();
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }, [editing, groupId, router]);

  useEffect(() => {
    if (!editing || memberList.length === 0) return;
    if (hydratedId === editing.id) return;
    setAmount(formatCents(editing.amount_cents));
    setWhat(editing.description);
    setPayerId(editing.payer_member_id);
    setSplitState(
      splitStateFromAllocations(
        editing.allocations ?? [],
        memberList.map((m) => m.id),
      ),
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
    if (splitState != null || memberList.length === 0) return;
    setSplitState(splitStateFromPrefill(memberList.map((m) => m.id), prefill));
  }, [memberList, splitState, prefill, editing]);

  const cents = parseCents(amount);
  const liveIds = memberList.map((m) => m.id);
  const derived =
    splitState != null
      ? deriveSplitEditor(liveIds, cents != null && cents > 0 ? cents : 0, splitState)
      : null;
  const draft =
    editing &&
    cents !== null &&
    cents > 0 &&
    payerId != null &&
    derived != null
      ? patchExpense(
          editing,
          liveIds,
          {
            payerMemberId: payerId,
            amountCents: cents,
            description: what,
            splitAmong: derived.splitAmong,
          },
          editing.updated_at,
        )
      : undefined;
  const canSave =
    !busy &&
    payerId != null &&
    derived?.canSave === true &&
    (!editing || draft != null);

  const onSave = async () => {
    if (!canSave || cents === null || payerId == null || derived == null) return;
    setBusy(true);
    try {
      if (editing) {
        await updateExpense(groupId, editing.id, {
          payerMemberId: payerId,
          amountCents: cents,
          description: what,
          splitAmong: derived.splitAmong,
        });
        router.back();
        return;
      }
      const expenseId = await addExpense(groupId, {
        payerMemberId: payerId,
        amountCents: cents,
        description: what,
        splitAmong: derived.splitAmong,
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

      <PayerSelect
        members={memberList}
        value={payerId}
        assumedMemberId={assumedMemberId}
        onChange={setPayerId}
      />

      <ExpenseAmountInput
        currencySymbol={currencySymbol(group.currency_label)}
        value={amount}
        onChangeText={setAmount}
        autoFocus={!editingId}
        onBlurFormat={() => {
          if (cents != null) setAmount(formatCents(cents));
        }}
      />

      <Text style={styles.label}>Split between</Text>
      {splitState ? (
        <ExpenseSplitList
          roster={memberList}
          memberIds={liveIds}
          amountCents={cents != null && cents > 0 ? cents : 0}
          state={splitState}
          assumedMemberId={assumedMemberId}
          currency={group.currency_label}
          onChange={setSplitState}
        />
      ) : null}

      <TextInput
        style={styles.input}
        value={what}
        onChangeText={setWhat}
        placeholder="What for"
        placeholderTextColor={colors.muted}
      />

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

      <ConfirmDrawer
        visible={Boolean(editing && confirmingDelete)}
        onRequestClose={() => setConfirmingDelete(false)}
        title="Delete expense?"
        message="This removes the expense from balances and lists. It cannot be undone yet."
        confirmLabel="Delete expense"
        onConfirm={() => void onDelete()}
        testID="expense-delete-confirm"
        confirmTestID="expense-delete-confirm-ok"
        destructive
        busy={busy}
      />
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
  error: {
    color: colors.danger,
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
  deleteHeader: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
