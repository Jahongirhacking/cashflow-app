import { Plus } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function AddScreen() {
  return (
    <PlaceholderScreen
      title="Add transaction"
      icon={Plus}
      description="Manual and Uzbek voice entry with a confirmation step before anything is written."
    />
  );
}
