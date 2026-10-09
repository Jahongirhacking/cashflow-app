import {
  ArrowLeftRight,
  ChartPie,
  Ellipsis,
  House,
  LayoutGrid,
  type LucideIcon,
  Plus,
  Repeat,
  Settings,
  TrendingUp,
} from 'lucide-react-native';
import type { TranslationKey } from '@/i18n';

export interface NavItem {
  name: string;
  href: string;
  titleKey: TranslationKey;
  icon: LucideIcon;
}

/** Desktop sidebar entries (full navigation). */
export const sidebarItems: NavItem[] = [
  { name: 'index', href: '/', titleKey: 'nav.dashboard', icon: House },
  {
    name: 'transactions',
    href: '/transactions',
    titleKey: 'nav.transactions',
    icon: ArrowLeftRight,
  },
  { name: 'recurring', href: '/recurring', titleKey: 'nav.recurring', icon: Repeat },
  { name: 'investments', href: '/investments', titleKey: 'nav.investments', icon: TrendingUp },
  { name: 'analytics', href: '/analytics', titleKey: 'nav.analytics', icon: ChartPie },
  { name: 'categories', href: '/categories', titleKey: 'nav.categories', icon: LayoutGrid },
  { name: 'settings', href: '/settings', titleKey: 'nav.settings', icon: Settings },
];

/** Mobile bottom tabs (compact navigation). */
export const tabItems: NavItem[] = [
  { name: 'index', href: '/', titleKey: 'nav.home', icon: House },
  {
    name: 'transactions',
    href: '/transactions',
    titleKey: 'nav.transactions',
    icon: ArrowLeftRight,
  },
  { name: 'add', href: '/add', titleKey: 'nav.add', icon: Plus },
  { name: 'analytics', href: '/analytics', titleKey: 'nav.analytics', icon: ChartPie },
  { name: 'more', href: '/more', titleKey: 'nav.more', icon: Ellipsis },
];

/** Routes that live in the tab navigator but are not shown as tabs. */
export const hiddenTabRoutes = ['recurring', 'investments', 'categories', 'settings'] as const;

/** Entries listed on the mobile "More" screen. */
export const moreItems: NavItem[] = sidebarItems.filter((item) =>
  (hiddenTabRoutes as readonly string[]).includes(item.name),
);
