import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
} from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import { getGroupStore } from '@/src/store/groupStore';
import {
  addExpense,
  addMember,
  bindMe,
  bumpGroupName,
  openGroup,
} from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const syncStatus = useValue(store$.syncStatus);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [busy, setBusy] = useState(false);

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
  /** Every member stays offerable until the first expense lands. */
  const canChoose = useMemo(() => bindingIsOpen(expenses ?? {}), [expenses]);

  const memberList = useMemo(
    () =>
      Object.values(members ?? {})
        .filter((m) => m.deleted_at == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  );

  const expenseList = useMemo(
    () =>
      Object.values(expenses ?? {})
        .filter((e) => e.deleted_at == null)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [expenses],
  );

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );

  const nameOf = (memberId: string) =>
    (members ?? {})[memberId]?.display_name || '(unnamed)';

  /** Money as text plus the tone it should be read in. */
  const money = (cents: number, signed = false) => {
    const sign = !signed || cents === 0 ? '' : cents > 0 ? '+' : '−';
    return {
      text: `${sign}${(Math.abs(cents) / 100).toFixed(2)} ${group.currency_label}`,
      style: !signed || cents === 0 ? styles.value : cents > 0 ? styles.owed : styles.owes,
    };
  };

  /** "12,34" and "12.34" both mean 1234 cents; anything else is not money. */
  const parseCents = (text: string): number | null => {
    const cleaned = text.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
    return Math.round(Number(cleaned) * 100);
  };

  const onAddExpense = async () => {
    const cents = parseCents(amount);
    if (cents === null || cents <= 0 || busy) return;
    if (!assumedMemberId) return;
    setBusy(true);
    try {
      await addExpense(groupId, {
        payerMemberId: assumedMemberId,
        amountCents: cents,
        description: what,
      });
      setAmount('');
      setWhat('');
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Group id</Text>
      <Text style={styles.mono}>{group.id}</Text>

      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{group.name === '' ? '(empty)' : group.name}</Text>

      <Text style={styles.label}>Version</Text>
      <Text style={styles.mono}>{String(group.version)}</Text>

      <Text style={styles.label}>Sync</Text>
      <Text style={styles.status}>{syncStatus}</Text>
      {lastError ? (
        <Text style={styles.error}>
          {lastError.code}: {lastError.message}
        </Text>
      ) : null}

      <Text style={styles.label}>Members</Text>
      {memberList.length === 0 ? (
        <Text style={styles.hint}>No members yet — add yourself first.</Text>
      ) : (
        memberList.map((m) => {
          const isYou = m.id === assumedMemberId;
          const label =
            m.display_name === ''
              ? '(unnamed)'
              : isYou
                ? `You (${m.display_name})`
                : m.display_name;
          return (
            <View key={m.id} style={styles.memberRow}>
              <Text style={isYou ? styles.you : styles.value}>{label}</Text>
              {canChoose && !isYou ? (
                <Pressable
                  style={styles.smallButton}
                  onPress={() => void onBind(m.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.smallButtonText}>This is me</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <TextInput
        style={styles.input}
        value={newName}
        onChangeText={setNewName}
        placeholder="Member name"
        placeholderTextColor="#8a8d82"
        autoCapitalize="words"
      />
      <Pressable
        style={[styles.button, busy ? styles.buttonDisabled : null]}
        onPress={() => void onAdd()}
        accessibilityRole="button"
        disabled={busy}
      >
        <Text style={styles.buttonText}>Add member</Text>
      </Pressable>

      <Text style={styles.label}>Balances</Text>
      {expenseList.length === 0 ? (
        <Text style={styles.hint}>
          Nothing spent yet — everyone is square.
        </Text>
      ) : (
        balances.map((b) => {
          const isYou = b.member_id === assumedMemberId;
          return (
            <View key={b.member_id} style={styles.memberRow}>
              <Text style={isYou ? styles.you : styles.value}>
                {isYou ? `You (${b.display_name})` : b.display_name}
              </Text>
              <Text style={money(b.net_cents, true).style}>
                {money(b.net_cents, true).text}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.label}>Expenses</Text>
      {expenseList.length === 0 ? (
        <Text style={styles.hint}>
          {assumedMemberId
            ? 'No expenses yet — add the first one. Adding it fixes who you are.'
            : 'Tap This is me on a member first; expenses are recorded against you.'}
        </Text>
      ) : (
        expenseList.map((e) => (
          <View key={e.id} style={styles.memberRow}>
            <Text style={styles.value}>
              {e.description || '(no description)'} · {nameOf(e.payer_member_id)}
              {e.allocations?.length
                ? ` · split ${e.allocations.length} ways`
                : ''}
            </Text>
            <Text style={styles.you}>{money(e.amount_cents).text}</Text>
          </View>
        ))
      )}

      {assumedMemberId ? (
        <>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder={`Amount (${group.currency_label})`}
            placeholderTextColor="#8a8d82"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <TextInput
            style={styles.input}
            value={what}
            onChangeText={setWhat}
            placeholder="What for"
            placeholderTextColor="#8a8d82"
          />
          <Pressable
            style={[
              styles.button,
              busy || parseCents(amount) === null ? styles.buttonDisabled : null,
            ]}
            onPress={() => void onAddExpense()}
            accessibilityRole="button"
            disabled={busy || parseCents(amount) === null}
          >
            <Text style={styles.buttonText}>Add expense</Text>
          </Pressable>
        </>
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        onPress={onBump}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Bump name (merge + wake)</Text>
      </Pressable>

      <Text style={styles.hint}>
        Add a member, tap This is me, then record an expense. Kill and reopen —
        You (Name) and the expense should stick. Another device with this group
        pulls both on open.
      </Text>
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
    color: '#1a1c16',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 18,
    color: '#1a1c16',
  },
  you: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f6b4a',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#1a1c16',
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6b4a',
  },
  error: {
    color: '#8b1e1e',
  },
  owes: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8b1e1e',
  },
  owed: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6b4a',
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
    borderColor: '#d9d6cc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1c16',
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1f6b4a',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#f2efe8',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    backgroundColor: '#1f6b4a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#f2efe8',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1f6b4a',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1f6b4a',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    marginTop: 16,
    fontSize: 14,
    color: '#1a1c16',
    opacity: 0.7,
    lineHeight: 20,
  },
});
