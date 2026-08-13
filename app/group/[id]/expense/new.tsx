import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { getGroupStore } from '@/src/store/groupStore';
import { addExpense, openGroup } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/** "12,34" and "12.34" both mean 1234 cents; anything else is not money. */
function parseCents(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const router = useRouter();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Readonly<Record<string, boolean>> | null>(
    null,
  );
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

  const memberList = useMemo(
    () =>
      Object.values(members ?? {})
        .filter((m) => m.deleted_at == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members],
  );

  useEffect(() => {
    if (payerId == null && assumedMemberId) setPayerId(assumedMemberId);
  }, [assumedMemberId, payerId]);

  useEffect(() => {
    if (sharing != null || memberList.length === 0) return;
    setSharing(Object.fromEntries(memberList.map((m) => [m.id, true])));
  }, [memberList, sharing]);

  const cents = parseCents(amount);
  const participantIds = Object.entries(sharing ?? {})
    .filter(([, on]) => on)
    .map(([memberId]) => memberId);
  const canSave =
    !busy &&
    cents !== null &&
    cents > 0 &&
    payerId != null &&
    participantIds.length > 0;

  const labelOf = (memberId: string, displayName: string) => {
    const shown = displayName === '' ? '(unnamed)' : displayName;
    if (memberId !== assumedMemberId) return shown;
    return displayName === '' ? 'You (unnamed)' : `You (${displayName})`;
  };

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
      >
        <Text style={styles.buttonText}>Add expense</Text>
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
  error: {
    color: '#8b1e1e',
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
  hintInline: {
    fontSize: 14,
    color: '#1a1c16',
    opacity: 0.7,
  },
});
