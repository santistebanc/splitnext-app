import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { patchExpense } from '@/src/domain/expense';
import {
  equalSplitState,
  deriveSplitEditor,
  splitStateFromAllocations,
  type SplitEditorState,
} from '@/src/domain/splitEditor';
import type { ExpensePrefill } from '@/src/domain/expensePrefill';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Props = {
  groupId: string;
  editingId?: string;
  prefill?: ExpensePrefill | null;
  onClose: () => void;
};

export function ExpenseForm({ groupId, editingId = '', prefill = null, onClose }: Props) {
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

  const onDelete = useCallback(async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteExpense(groupId, editing.id);
      onClose();
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }, [editing, groupId, onClose]);

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
        onClose();
        return;
      }
      const expenseId = await addExpense(groupId, {
        payerMemberId: payerId,
        amountCents: cents,
        description: what,
        splitAmong: derived.splitAmong,
      });
      if (expenseId) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="expense-form-panel" style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit expense' : 'New expense'}
        </Text>
        <View style={styles.headActions}>
          {editing ? (
            <Pressable
              testID="expense-delete"
              onPress={() => setConfirmingDelete(true)}
              disabled={busy || confirmingDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete expense"
              style={[styles.deleteBtn, busy || confirmingDelete ? styles.disabled : null]}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="expense-close"
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
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
          message="This removes the expense from balances and lists. You can Undo it from Activity."
          confirmLabel="Delete expense"
          onConfirm={() => void onDelete()}
          testID="expense-delete-confirm"
          confirmTestID="expense-delete-confirm-ok"
          destructive
          busy={busy}
        />
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
  headActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
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
  disabled: {
    opacity: 0.5,
  },
});
