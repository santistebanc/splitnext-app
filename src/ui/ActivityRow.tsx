import type { ActivityLine } from '@/src/domain/activity';
import { relativeTimeLabel } from '@/src/domain/relativeTime';
import { ActivityLineText } from '@/src/ui/ActivityLineText';
import { colors } from '@/src/ui/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  line: ActivityLine;
  lineStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function ActivityRow({ line, lineStyle, testID }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.row} testID={testID}>
      <ActivityLineText line={line} style={[styles.line, lineStyle]} />
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
  line: {
    flex: 1,
    minWidth: 0,
  },
  when: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    paddingTop: 1,
  },
});
