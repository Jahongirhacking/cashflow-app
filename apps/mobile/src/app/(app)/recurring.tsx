import { Repeat } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function RecurringScreen() {
  return (
    <PlaceholderScreen
      title="Recurring"
      icon={Repeat}
      description="Track subscriptions, loan payments and other fixed monthly expenses."
    />
  );
}
