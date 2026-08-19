import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { activityLines } from '@/src/domain/activity';
import { getGroupStore } from '@/src/store/groupStore';
import { openGroup, undoActivity } from '@/src/sync/groupSync';
import { ActivityFeed } from '@/src/ui/ActivityFeed';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
    <View style={styles.screen}>
      <ActivityFeed
        lines={lines}
        onUndo={(activityId) => void undoActivity(groupId, activityId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 14,
    backgroundColor: colors.bg,
  },
});
