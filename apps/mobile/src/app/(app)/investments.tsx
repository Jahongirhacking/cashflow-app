import { TrendingUp } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function InvestmentsScreen() {
  return (
    <PlaceholderScreen
      title="Investments"
      icon={TrendingUp}
      description="Deposits, stocks, crypto, gold and business holdings with profit and return."
    />
  );
}
