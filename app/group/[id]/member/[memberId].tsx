import { MemberDetail } from '@/src/ui/MemberDetail';
import { colors } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function MemberScreen() {
  const { id, memberId } = useLocalSearchParams<{
    id: string;
    memberId: string;
  }>();
  const router = useRouter();
  const groupId = id ?? '';

  return (
    <View style={styles.screen}>
      <MemberDetail
        groupId={groupId}
        memberId={memberId ?? ''}
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
