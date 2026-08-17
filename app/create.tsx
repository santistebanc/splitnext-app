import { createGroup } from '@/src/sync/groupSync';
import { colors } from '@/src/ui/theme';
import { useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function CreateGroupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Create group' });
  }, [navigation]);

  const canSubmit = !busy && name.trim() !== '' && creatorName.trim() !== '';

  const onCreate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createGroup({
        name,
        currency_label: currency,
        creator_name: creatorName,
      });
      router.replace(`/group/${id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.fieldGroup}>
        <Text style={styles.sec}>Group name</Text>
        <TextInput
          style={styles.field}
          value={name}
          onChangeText={setName}
          placeholder="Group name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.sec}>Your name</Text>
        <TextInput
          style={styles.field}
          value={creatorName}
          onChangeText={setCreatorName}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.sec}>Currency</Text>
        <TextInput
          style={styles.field}
          value={currency}
          onChangeText={setCurrency}
          placeholder="Currency"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        testID="create-submit"
        style={[styles.button, !canSubmit ? styles.buttonDisabled : null]}
        onPress={() => void onCreate()}
        accessibilityRole="button"
        accessibilityLabel="Submit create group"
        disabled={!canSubmit}
      >
        {busy ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : (
          <Text style={styles.buttonText}>Create group</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 16,
    backgroundColor: colors.bg,
  },
  fieldGroup: {
    gap: 6,
  },
  sec: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: '600',
  },
});
