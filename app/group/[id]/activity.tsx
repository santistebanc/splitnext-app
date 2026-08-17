import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { activityLines } from '@/src/domain/activity';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup } from '@/src/sync/groupSync';
import { ActivityLineText } from '@/src/ui/ActivityLineText';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const navigation = useNavigation();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const activities = useValue(store$.activities);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  useEffect(() => {
    navigation.setOptions({ title: 'Activity' });
  }, [navigation]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );

  const lines = useMemo(
    () =>
      activityLines(
        activities ?? {},
        members ?? {},
        expenses ?? {},
        group.currency_label || 'EUR',
        assumedMemberId,
      ),
    [activities, members, expenses, group.currency_label, assumedMemberId],
  );

  return (
    <ScrollView
      testID="activity-page"
      contentContainerStyle={styles.container}
    >
      {lines.length === 0 ? (
        <Text style={styles.hint}>No activity yet.</Text>
      ) : (
        lines.map((line, index) => (
          <View
            key={`${line.description}-${line.amount}-${index}`}
            style={styles.row}
            testID="activity-row"
          >
            <ActivityLineText line={line} style={styles.rowText} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 48,
    backgroundColor: colors.bg,
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
