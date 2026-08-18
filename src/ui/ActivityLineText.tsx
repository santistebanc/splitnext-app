import type { ActivityLine } from '@/src/domain/activity';
import { colors } from '@/src/ui/theme';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  line: ActivityLine;
  style?: StyleProp<TextStyle>;
  descriptionStyle?: TextStyle;
  testID?: string;
};

export function ActivityLineText({ line, style, descriptionStyle, testID }: Props) {
  return (
    <Text style={style} testID={testID}>
      {line.who} added{' '}
      <Text style={[styles.description, descriptionStyle]}>{line.description}</Text>{' '}
      {line.amount}
    </Text>
  );
}

const styles = StyleSheet.create({
  description: {
    fontWeight: '600',
    color: colors.ink,
  },
});
