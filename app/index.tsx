import { lastOpenedHubId } from '@/src/domain/lastOpened';
import {
  markAutoOpenedLastGroup,
  shouldAutoOpenLastGroup,
} from '@/src/domain/lastOpenedSession';
import { getLastOpenedGroupId, listLobbyGroupIds } from '@/src/secrets/tokens';
import { LobbyPanel } from '@/src/ui/LobbyPanel';
import { colors } from '@/src/ui/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function LobbyScreen() {
  const router = useRouter();
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    void listLobbyGroupIds().then(setGroupIds);
  }, []);

  useEffect(() => {
    if (groupIds.length === 0 || !shouldAutoOpenLastGroup()) return;
    void (async () => {
      const last = await getLastOpenedGroupId();
      if (!last || !groupIds.includes(last)) return;
      markAutoOpenedLastGroup();
      router.replace(`/group/${last}`);
    })();
  }, [groupIds, router]);

  return (
    <View style={styles.screen}>
      <LobbyPanel onSelectGroup={(id) => router.push(`/group/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
