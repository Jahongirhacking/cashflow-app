import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Last line of defence: an unexpected render error shows a recoverable screen instead of a crash. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ hasError: false });

  override render(): ReactNode {
    if (this.state.hasError) return <ErrorFallback onRetry={this.reset} />;
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="heading" align="center">
        {t('errors.screen.title')}
      </Text>
      <Text
        variant="body"
        color="textSecondary"
        align="center"
        style={{ marginTop: theme.spacing.sm }}
      >
        {t('errors.screen.body')}
      </Text>
      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t('common.tryAgain')} onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
