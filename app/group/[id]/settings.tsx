import { SettingsPanel } from '@/src/ui/SettingsPanel';
import { colors } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const groupId = id ?? '';

  return (
    <View style={styles.screen}>
      <SettingsPanel
        groupId={groupId}
        onClose={() => router.replace(`/group/${groupId}` as Href)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
