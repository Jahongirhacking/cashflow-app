import { type PaymentMethod, parseIsoDate, todayIsoDate, addDays } from '@finance/shared';
import { monthShort, translate } from '@/i18n';
import {
  Bitcoin,
  Briefcase,
  Building2,
  Bus,
  CircleEllipsis,
  Clapperboard,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  PiggyBank,
  PlusCircle,
  Repeat,
  ShoppingBag,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Zap,
} from 'lucide-react-native';

/** "Today", "Yesterday" or "7 Oct 2026". */
export function formatDateLabel(isoDate: string, today = todayIsoDate()): string {
  if (isoDate === today) return translate('common.today');
  if (isoDate === addDays(today, -1)) return translate('common.yesterday');
  return formatShortDate(isoDate);
}

export function formatShortDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${date.getDate()} ${monthShort()[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK', 'OTHER'];

/** Localised payment-method label (current locale). */
export function paymentLabel(method: PaymentMethod): string {
  switch (method) {
    case 'CASH':
      return translate('common.cash');
    case 'CARD':
      return translate('common.card');
    case 'BANK':
      return translate('common.bank');
    default:
      return translate('common.other');
  }
}

const ICON_RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /salary|oylik|maosh|wage/i, icon: Briefcase },
  { match: /deposit|depozit|omonat|jamg|saving/i, icon: PiggyBank },
  { match: /crypto|kripto|bitcoin|btc|usdt|binance/i, icon: Bitcoin },
  { match: /stock|aksiya|share|etf|dividend/i, icon: TrendingUp },
  { match: /bonus|mukofot/i, icon: Gift },
  { match: /freelance|frilans/i, icon: Laptop },
  { match: /business|biznes/i, icon: Building2 },
  { match: /other income|boshqa daromad/i, icon: PlusCircle },
  { match: /food|ovqat|taom|restoran|cafe|bozor|grocer/i, icon: Utensils },
  { match: /transport|taksi|taxi|metro|benzin|fuel|avto/i, icon: Bus },
  { match: /hous|rent|ijara|uy|kvartira/i, icon: House },
  { match: /utilit|kommunal|svet|gaz|suv|internet/i, icon: Zap },
  { match: /family|oila/i, icon: Users },
  { match: /credit|kredit|loan|qarz/i, icon: CreditCard },
  { match: /subscri|obuna|claude|netflix|spotify/i, icon: Repeat },
  { match: /shop|xarid|kiyim|cloth/i, icon: ShoppingBag },
  { match: /educat|ta.?lim|kurs|course|kitob|book/i, icon: GraduationCap },
  { match: /health|salomat|dori|apteka|shifo/i, icon: HeartPulse },
  { match: /entertain|ko.?ngil|kino|cinema|game|o.?yin/i, icon: Clapperboard },
  { match: /other|boshqa/i, icon: CircleEllipsis },
];

/** Best-effort icon for a category name (default English names and common Uzbek ones). */
export function categoryIcon(name: string): LucideIcon {
  return ICON_RULES.find((rule) => rule.match.test(name))?.icon ?? Tag;
}

/** "1250000" → "1,250,000" while typing; keeps a single decimal point. */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPart = '', ...rest] = cleaned.split('.');
  const grouped = intPart.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length > 0 ? `${grouped}.${rest.join('').slice(0, 2)}` : grouped;
}

export function parseAmountInput(text: string): number {
  const value = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}
