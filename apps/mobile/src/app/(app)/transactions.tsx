import { ArrowLeftRight } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function TransactionsScreen() {
  return (
    <PlaceholderScreen
      title="Transactions"
      icon={ArrowLeftRight}
      description="Search, filter and manage every income and expense from your spreadsheet."
    />
  );
}
