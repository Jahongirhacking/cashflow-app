/** Central registry of query keys so invalidation stays consistent across features. */
export const queryKeys = {
  health: ['health'] as const,
  auth: {
    me: ['auth', 'me'] as const,
  },
  spreadsheet: {
    status: ['spreadsheet', 'status'] as const,
    info: ['spreadsheet', 'info'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (params: Record<string, unknown>) => ['transactions', 'list', params] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  recurring: {
    all: ['recurring'] as const,
  },
  investments: {
    all: ['investments'] as const,
    detail: (id: string) => ['investments', 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overview: ['analytics', 'overview'] as const,
    monthly: (months: number) => ['analytics', 'monthly', months] as const,
    categories: (month: string | null) => ['analytics', 'categories', month] as const,
    fixedVariable: (month: string | null) => ['analytics', 'fixed-variable', month] as const,
  },
} as const;
