import { createElement } from 'react';
import { categoryIcon } from '@/features/transactions/utils';

/** Renders the lucide icon matched to a category name without creating a component type during render. */
export function CategoryIcon({
  name,
  size = 18,
  color,
}: {
  name: string;
  size?: number;
  color: string;
}) {
  return createElement(categoryIcon(name), { size, color });
}
