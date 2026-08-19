import { ExpensesPanel } from '@/src/ui/ExpensesPanel';
import { colors } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const groupId = id ?? '';

  return (
    <View style={styles.screen}>
      <ExpensesPanel
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
