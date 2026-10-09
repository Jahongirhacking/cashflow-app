import { formatMoney, type InvestmentType } from '@finance/shared';
import { Bitcoin, type LucideIcon, PiggyBank, TrendingUp } from 'lucide-react-native';
import type { Translate } from '@/i18n';

export const INVESTMENT_ICONS: Record<InvestmentType, LucideIcon> = {
  DEPOSIT: PiggyBank,
  CRYPTO: Bitcoin,
  STOCK: TrendingUp,
};

export function investmentTypeLabel(type: InvestmentType, t: Translate): string {
  return t(`inv.type.${type}`);
}

/** Signed money: net > 0 is realised profit, net < 0 is money still invested. */
export function netLabel(net: number): string {
  return `${net > 0 ? '+' : net < 0 ? '-' : ''}${formatMoney(Math.abs(net))}`;
}

export function netHint(net: number, t: Translate): string {
  if (net > 0) return t('inv.netHint.positive');
  if (net < 0) return t('inv.netHint.negative');
  return t('inv.netHint.zero');
}
