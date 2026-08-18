import type { ActivityLine } from '@/src/domain/activity';
import { relativeTimeLabel } from '@/src/domain/relativeTime';
import { ActivityLineText } from '@/src/ui/ActivityLineText';
import { colors } from '@/src/ui/theme';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type Props = {
  line: ActivityLine;
  lineStyle?: StyleProp<TextStyle>;
  testID?: string;
  onUndo?: () => void;
};

export function ActivityRow({ line, lineStyle, testID, onUndo }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const showUndo = Boolean(line.canUndo && onUndo);

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.body}>
        <ActivityLineText line={line} style={[styles.line, lineStyle]} />
        {showUndo ? (
          <Pressable
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            testID="activity-undo"
            style={styles.undo}
            hitSlop={8}
          >
            <Text style={styles.undoLabel}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.when} testID={testID ? `${testID}-when` : undefined}>
        {relativeTimeLabel(line.at, now)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  line: {
    flexShrink: 1,
  },
  undo: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 8,
  },
  undoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  when: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    paddingTop: 1,
  },
});
