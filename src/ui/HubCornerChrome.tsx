import { colors } from '@/src/ui/theme';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  topInset: number;
  onHome: () => void;
  onSettings: () => void;
};

/** Home and Settings on the hub canvas — not a stack header. */
export function HubCornerChrome({ topInset, onHome, onSettings }: Props) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { paddingTop: topInset }]}
    >
      <Pressable
        onPress={onHome}
        accessibilityRole="button"
        accessibilityLabel="Home"
        style={styles.hit}
      >
        <SymbolView
          name={{ ios: 'house', android: 'home', web: 'home' }}
          size={22}
          tintColor={colors.ink}
        />
      </Pressable>
      <Pressable
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={styles.hit}
      >
        <Text style={styles.settings}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settings: {
    fontSize: 18,
    color: colors.muted,
  },
});
