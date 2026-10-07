import { LayoutGrid } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function CategoriesScreen() {
  return (
    <PlaceholderScreen
      title="Categories"
      icon={LayoutGrid}
      description="Default and custom categories with fixed/variable classification."
    />
  );
}
