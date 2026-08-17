import { InFrameOverlay } from '@/src/ui/inFrameOverlay';
import { colors } from '@/src/ui/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  testID?: string;
  confirmTestID?: string;
  destructive?: boolean;
  busy?: boolean;
};

export function ConfirmDrawer({
  visible,
  onRequestClose,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  onConfirm,
  testID,
  confirmTestID,
  destructive = false,
  busy = false,
}: Props) {
  return (
    <InFrameOverlay visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={busy}
        />
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          testID={testID}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.cancel}
              onPress={onRequestClose}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              disabled={busy}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID={confirmTestID}
              style={[
                styles.confirm,
                destructive ? styles.confirmDanger : styles.confirmDefault,
                busy ? styles.disabled : null,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              disabled={busy}
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive ? styles.confirmTextDanger : null,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </InFrameOverlay>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 28, 22, 0.4)',
  },
  sheet: {
    backgroundColor: colors.bg,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 14,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  message: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  confirm: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDefault: {
    backgroundColor: colors.accent,
  },
  confirmDanger: {
    backgroundColor: colors.danger,
  },
  confirmText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmTextDanger: {
    color: colors.accentInk,
  },
  disabled: {
    opacity: 0.5,
  },
});
