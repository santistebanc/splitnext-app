import type { ActivityLine } from '@/src/domain/activity';
import { ActivityRow } from '@/src/ui/ActivityRow';
import { colors } from '@/src/ui/theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  lines: ActivityLine[];
  onUndo: (activityId: string) => void;
  testID?: string;
};

export function ActivityFeed({ lines, onUndo, testID = 'activity-page' }: Props) {
  return (
    <ScrollView
      testID={testID}
      style={styles.flex}
      contentContainerStyle={styles.container}
    >
      {lines.length === 0 ? (
        <Text style={styles.hint}>No activity yet.</Text>
      ) : (
        lines.map((line) => (
          <View key={line.id} style={styles.row} testID="activity-row">
            <ActivityRow
              line={line}
              lineStyle={styles.rowText}
              onUndo={() => onUndo(line.id)}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    paddingBottom: 48,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  row: {
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
});
