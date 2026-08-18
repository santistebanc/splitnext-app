import type { ActivityLine } from '@/src/domain/activity';
import { ActivityRow } from '@/src/ui/ActivityRow';
import { colors } from '@/src/ui/theme';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const AUTO_DISMISS_MS = 4000;

type Props = {
  line: ActivityLine | null;
  onPress: () => void;
  onDismiss: () => void;
};

export function ActivityToast({ line, onPress, onDismiss }: Props) {
  useEffect(() => {
    if (!line) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [line, onDismiss]);

  if (!line) return null;

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        testID="activity-toast"
        style={styles.toast}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="View activity"
      >
        <ActivityRow line={line} lineStyle={styles.text} testID="activity-toast-line" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    elevation: 10,
  },
  toast: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
});
