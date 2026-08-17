import { colors } from '@/src/ui/theme';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

const FONT_SIZE = 60;
const LINE_HEIGHT = 64;
const LETTER_SPACING = -1.8;
const SIZER_TAIL = '8';
const WIDTH_BUFFER = 8;
const PADDING_H = 12;

/** Keep digits and at most one decimal point with two places, while typing. */
function sanitizeAmountInput(text: string): string {
  let v = text.replace(',', '.');
  v = v.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  }
  return v;
}

type Props = {
  currencySymbol: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlurFormat?: () => void;
  autoFocus?: boolean;
};

export function ExpenseAmountInput({
  currencySymbol,
  value,
  onChangeText,
  onBlurFormat,
  autoFocus = false,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const [sizerWidth, setSizerWidth] = useState(80);
  const measureValue = `${value || '0.00'}${SIZER_TAIL}`;
  const inputWidth = Math.min(
    sizerWidth + WIDTH_BUFFER + PADDING_H * 2,
    screenWidth - 80,
  );

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocus]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.symbol}>{currencySymbol}</Text>
        <Text
          onLayout={(e) => setSizerWidth(e.nativeEvent.layout.width)}
          style={styles.sizer}
        >
          {measureValue}
        </Text>
        <TextInput
          ref={inputRef}
          testID="expense-amount"
          accessibilityLabel="Amount"
          selectTextOnFocus
          value={value}
          onChangeText={(text) => onChangeText(sanitizeAmountInput(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlurFormat?.();
          }}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          maxLength={11}
          autoFocus={autoFocus}
          style={[
            styles.input,
            Platform.OS === 'web' ? styles.inputWeb : null,
            {
              width: inputWidth,
              borderBottomWidth: focused ? 2 : 0,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: FONT_SIZE,
    fontWeight: '500',
    color: colors.ink,
    opacity: 0.45,
  },
  sizer: {
    position: 'absolute',
    opacity: 0,
    fontSize: FONT_SIZE,
    fontWeight: '600',
    letterSpacing: LETTER_SPACING,
    pointerEvents: 'none',
  },
  input: {
    paddingHorizontal: PADDING_H,
    fontSize: FONT_SIZE,
    fontWeight: '600',
    letterSpacing: LETTER_SPACING,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT,
    color: colors.ink,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  inputWeb: {
    outlineWidth: 0,
  },
});
