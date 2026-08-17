import {
  allCurrencies,
  currencyName,
  currencySymbol,
} from '@/src/domain/currency';
import { InFrameOverlay } from '@/src/ui/inFrameOverlay';
import { colors } from '@/src/ui/theme';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  value: string;
  onChange: (code: string) => void;
};

export function CurrencySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);
  const currencies = useMemo(() => allCurrencies(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return currencies;
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [currencies, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      <Pressable
        testID="currency-select"
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Currency, ${currencyName(value)}`}
      >
        <Text style={styles.symbol}>{currencySymbol(value)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {currencyName(value)}
        </Text>
        <Text style={styles.code}>{value}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <InFrameOverlay visible={open} onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close currency list"
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.sheetTitle}>Currency</Text>
            <TextInput
              ref={searchRef}
              testID="currency-search"
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.code === value;
                return (
                  <Pressable
                    testID="currency-option"
                    style={[styles.row, selected ? styles.rowSelected : null]}
                    onPress={() => {
                      onChange(item.code);
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} ${item.code}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.rowSymbol}>{item.symbol}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowCode}>{item.code}</Text>
                  </Pressable>
                );
              }}
            />
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
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    minWidth: 28,
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
  },
  code: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.4,
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
  search: {
    borderWidth: 1,
    borderColor: colors.line,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowSelected: {
    backgroundColor: colors.youRow,
  },
  rowSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    minWidth: 36,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
  },
  rowCode: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.4,
  },
});
