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

export interface NavItem {
  name: string;
  href: string;
  title: string;
  icon: LucideIcon;
}

/** Desktop sidebar entries (full navigation). */
export const sidebarItems: NavItem[] = [
  { name: 'index', href: '/', title: 'Dashboard', icon: House },
  { name: 'transactions', href: '/transactions', title: 'Transactions', icon: ArrowLeftRight },
  { name: 'recurring', href: '/recurring', title: 'Recurring', icon: Repeat },
  { name: 'investments', href: '/investments', title: 'Investments', icon: TrendingUp },
  { name: 'analytics', href: '/analytics', title: 'Analytics', icon: ChartPie },
  { name: 'categories', href: '/categories', title: 'Categories', icon: LayoutGrid },
  { name: 'settings', href: '/settings', title: 'Settings', icon: Settings },
];

/** Mobile bottom tabs (compact navigation). */
export const tabItems: NavItem[] = [
  { name: 'index', href: '/', title: 'Home', icon: House },
  { name: 'transactions', href: '/transactions', title: 'Transactions', icon: ArrowLeftRight },
  { name: 'add', href: '/add', title: 'Add', icon: Plus },
  { name: 'analytics', href: '/analytics', title: 'Analytics', icon: ChartPie },
  { name: 'more', href: '/more', title: 'More', icon: Ellipsis },
];

/** Routes that live in the tab navigator but are not shown as tabs. */
export const hiddenTabRoutes = ['recurring', 'investments', 'categories', 'settings'] as const;

/** Entries listed on the mobile "More" screen. */
export const moreItems: NavItem[] = sidebarItems.filter((item) =>
  (hiddenTabRoutes as readonly string[]).includes(item.name),
);
