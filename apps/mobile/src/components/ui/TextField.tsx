import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | undefined;
  hint?: string;
  /** Rendered inside the field on the right (e.g. a unit). */
  suffix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, suffix, style, editable = true, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor: error
              ? theme.colors.expense
              : focused
                ? theme.colors.focusRing
                : theme.colors.borderStrong,
            borderRadius: theme.radii.md,
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted,
          },
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, theme.typography.body, { color: theme.colors.text }, style]}
        />
        {suffix ? (
          <Text variant="caption" color="textMuted" style={{ marginRight: 12 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="expense" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // minWidth 0 + overflow hidden: a web <input> has an intrinsic width (~150px) and would otherwise
  // push the suffix past the field (and the card) inside a narrow flex cell.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 46,
    minWidth: 0,
    overflow: 'hidden',
  },
  // The field border doubles as the focus ring, so suppress the browser outline on web.
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
});
