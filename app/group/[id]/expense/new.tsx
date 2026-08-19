import {
  expensePrefillFromSearchParams,
  type ExpenseSearchParams,
} from '@/src/domain/expensePrefill';
import { ExpenseForm } from '@/src/ui/ExpenseForm';
import { colors } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<
    ExpenseSearchParams & { id: string; expenseId?: string }
  >();
  const router = useRouter();
  const groupId = params.id ?? '';
  const editingId =
    typeof params.expenseId === 'string' ? params.expenseId : '';
  const prefill = editingId ? null : expensePrefillFromSearchParams(params);

  return (
    <View style={styles.screen}>
      <ExpenseForm
        groupId={groupId}
        editingId={editingId}
        prefill={prefill}
        onClose={() => router.back()}
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
