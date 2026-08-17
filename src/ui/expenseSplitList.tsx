import {
  commitMemberFixedAmount,
  decreaseMemberSplit,
  deriveSplitEditor,
  increaseMemberSplit,
  type SplitEditorState,
} from '@/src/domain/splitEditor';
import { currencySymbol } from '@/src/domain/currency';
import { formatCents, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Member = { id: string; display_name: string };

function StepButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
      style={({ pressed }) => [styles.step, pressed ? styles.pressed : null]}
    >
      <Text style={styles.stepText}>{children}</Text>
    </Pressable>
  );
}

export function ExpenseSplitList({
  roster,
  memberIds,
  amountCents,
  state,
  assumedMemberId,
  currency,
  onChange,
}: {
  roster: readonly Member[];
  memberIds: readonly string[];
  amountCents: number;
  state: SplitEditorState;
  assumedMemberId: string | null;
  currency: string;
  onChange: (next: SplitEditorState) => void;
}) {
  const derived = deriveSplitEditor(memberIds, amountCents, state);
  const symbol = currencySymbol(currency);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fixedEditValue, setFixedEditValue] = useState('');

  const beginFixed = (memberId: string) => {
    if (!derived.amountIsPressable(memberId)) return;
    setFixedEditValue(
      formatCents(derived.allocCentsByMember[memberId] ?? 0),
    );
    setEditingFixedId(memberId);
  };

  const commitFixed = (memberId: string) => {
    onChange(
      commitMemberFixedAmount(
        memberIds,
        amountCents,
        state,
        memberId,
        fixedEditValue,
      ),
    );
    setEditingFixedId(null);
  };

  return (
    <View>
      {roster.map((m) => {
        const shares = state.shares[m.id] ?? 0;
        const fixedCents = state.fixedCents[m.id] ?? null;
        const active = derived.isActive(m.id);
        const showUp = derived.showIncreaseControl(m.id);
        const amountPress = derived.amountIsPressable(m.id);
        const isEditing = editingFixedId === m.id;
        const isYou = m.id === assumedMemberId;
        const label = memberLabel(m.display_name, isYou);
        const alloc = derived.allocCentsByMember[m.id] ?? 0;

        return (
          <View key={m.id} style={styles.row}>
            <Text
              style={isYou ? styles.you : styles.name}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View style={styles.controls}>
              <View style={styles.slot}>
                {active && showUp ? (
                  <StepButton
                    label="Increase share"
                    onPress={() =>
                      onChange(
                        increaseMemberSplit(memberIds, amountCents, state, m.id),
                      )
                    }
                  >
                    ▲
                  </StepButton>
                ) : null}
              </View>
              <View style={styles.amountSlot}>
                {active && isEditing ? (
                  <TextInput
                    autoFocus
                    value={fixedEditValue}
                    onChangeText={setFixedEditValue}
                    onBlur={() => commitFixed(m.id)}
                    onSubmitEditing={() => commitFixed(m.id)}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    accessibilityLabel="Fixed share"
                    style={styles.fixedInput}
                  />
                ) : active && amountPress ? (
                  <Pressable
                    onPress={() => beginFixed(m.id)}
                    accessibilityLabel="Edit share amount"
                  >
                    <Text style={fixedCents != null ? styles.fixedAmt : styles.amt}>
                      {symbol}
                      {formatCents(alloc)}
                    </Text>
                  </Pressable>
                ) : active ? (
                  <Text style={styles.amt}>
                    {symbol}
                    {formatCents(alloc)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.slot}>
                {active ? (
                  shares === 1 && fixedCents == null ? (
                    <Pressable
                      onPress={() =>
                        onChange(
                          decreaseMemberSplit(
                            memberIds,
                            amountCents,
                            state,
                            m.id,
                          ),
                        )
                      }
                      accessibilityLabel="Decrease share"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true }}
                    >
                      <Text style={styles.check}>✓</Text>
                    </Pressable>
                  ) : (
                    <StepButton
                      label="Decrease share"
                      onPress={() =>
                        onChange(
                          decreaseMemberSplit(
                            memberIds,
                            amountCents,
                            state,
                            m.id,
                          ),
                        )
                      }
                    >
                      ▼
                    </StepButton>
                  )
                ) : (
                  <Pressable
                    onPress={() =>
                      onChange(
                        increaseMemberSplit(memberIds, amountCents, state, m.id),
                      )
                    }
                    accessibilityLabel="Add to split"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: false }}
                  >
                    <Text style={styles.empty}>○</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
  },
  name: {
    flex: 1,
    fontSize: 18,
    color: colors.ink,
  },
  you: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slot: {
    width: 34,
    alignItems: 'center',
  },
  amountSlot: {
    width: 72,
    alignItems: 'center',
  },
  step: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  stepText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
  },
  amt: {
    fontSize: 16,
    color: colors.muted,
  },
  fixedAmt: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
  },
  fixedInput: {
    width: 64,
    borderBottomWidth: 1.5,
    borderColor: colors.accent,
    fontSize: 16,
    color: colors.accent,
    textAlign: 'center',
    padding: 0,
  },
  check: {
    fontSize: 18,
    color: colors.accent,
  },
  empty: {
    fontSize: 18,
    color: colors.muted,
  },
});
