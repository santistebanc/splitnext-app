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
  const emphasis = [styles.description, descriptionStyle];

  if (line.kind === 'expense_edited') {
    return (
      <Text style={style} testID={testID}>
        {line.who} edited{' '}
        <Text style={emphasis}>{line.description}</Text>
        {line.amount ? <> {line.amount}</> : null}
      </Text>
    );
  }

  if (line.kind === 'expense_deleted') {
    return (
      <Text style={style} testID={testID}>
        {line.who} deleted{' '}
        <Text style={emphasis}>{line.description}</Text>
        {line.amount ? <> {line.amount}</> : null}
      </Text>
    );
  }

  if (line.kind === 'member_kicked') {
    return (
      <Text style={style} testID={testID}>
        {line.who} removed <Text style={emphasis}>{line.description}</Text>
      </Text>
    );
  }

  if (line.kind === 'member_renamed') {
    return (
      <Text style={style} testID={testID}>
        {line.who} renamed <Text style={emphasis}>{line.description}</Text>
      </Text>
    );
  }

  if (line.kind === 'member_joined') {
    return (
      <Text style={style} testID={testID}>
        {line.who} joined as <Text style={emphasis}>{line.description}</Text>
      </Text>
    );
  }

  if (line.kind === 'member_left') {
    return (
      <Text style={style} testID={testID}>
        {line.who} left the group
      </Text>
    );
  }

  if (line.kind === 'group_renamed') {
    return (
      <Text style={style} testID={testID}>
        {line.who} renamed the group
      </Text>
    );
  }

  return (
    <Text style={style} testID={testID}>
      {line.who} added{' '}
      <Text style={emphasis}>{line.description}</Text>
      {line.amount ? <> {line.amount}</> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  description: {
    fontWeight: '600',
    color: colors.ink,
  },
});
