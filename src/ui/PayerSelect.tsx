import { InFrameOverlay } from '@/src/ui/inFrameOverlay';
import { memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Member = { id: string; display_name: string };

type Props = {
  members: readonly Member[];
  value: string | null;
  assumedMemberId: string | null;
  onChange: (memberId: string) => void;
};

export function PayerSelect({
  members,
  value,
  assumedMemberId,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = members.find((m) => m.id === value);
  const selectedLabel = selected
    ? memberLabel(selected.display_name, selected.id === assumedMemberId)
    : null;

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        testID="payer-select"
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          selectedLabel ? `Paid by, ${selectedLabel}` : 'Paid by, choose member'
        }
      >
        <Text style={styles.label}>Paid by</Text>
        <View style={styles.value}>
          <Text
            style={[
              styles.name,
              !selectedLabel ? styles.placeholder : null,
              selected && selected.id === assumedMemberId ? styles.you : null,
            ]}
            numberOfLines={1}
          >
            {selectedLabel ?? 'Choose…'}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </View>
      </Pressable>

      <InFrameOverlay visible={open} onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close paid by list"
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.sheetTitle}>Paid by</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {members.map((m) => {
                const isYou = m.id === assumedMemberId;
                const isSelected = m.id === value;
                const label = memberLabel(m.display_name, isYou);
                return (
                  <Pressable
                    key={m.id}
                    testID="payer-option"
                    style={[styles.row, isSelected ? styles.rowSelected : null]}
                    onPress={() => {
                      onChange(m.id);
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[styles.rowName, isYou ? styles.you : null]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </InFrameOverlay>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'right',
  },
  placeholder: {
    color: colors.muted,
    fontWeight: '400',
  },
  chevron: {
    fontSize: 12,
    color: colors.muted,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 28, 22, 0.4)',
  },
  sheet: {
    backgroundColor: colors.bg,
    maxHeight: '78%',
    paddingTop: 12,
    paddingBottom: 20,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowSelected: {
    backgroundColor: colors.youRow,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
  },
  you: {
    fontWeight: '700',
    color: colors.accent,
  },
});
