import { ChartPie } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function AnalyticsScreen() {
  return (
    <PlaceholderScreen
      title="Analytics"
      icon={ChartPie}
      description="Cash flow, spending by category, fixed vs variable expenses and savings rate."
    />
  );
}
