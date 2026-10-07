import type { LucideIcon } from 'lucide-react-native';
import { EmptyState } from '@/components/feedback/StateViews';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  description: string;
}

/** Temporary stand-in for feature screens that arrive in later phases. */
export function PlaceholderScreen({ title, subtitle, icon, description }: PlaceholderScreenProps) {
  return (
    <Screen title={title} subtitle={subtitle}>
      <Card padding="lg">
        <EmptyState icon={icon} title={`${title} is coming next`} description={description} />
      </Card>
    </Screen>
  );
}
