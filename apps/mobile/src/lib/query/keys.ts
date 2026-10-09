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
    facets: ['transactions', 'facets'] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  recurring: {
    all: ['recurring'] as const,
    list: ['recurring', 'list'] as const,
    schedule: (month: string) => ['recurring', 'schedule', month] as const,
  },
  investments: {
    all: ['investments'] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overview: (period: string) => ['analytics', 'overview', period] as const,
    monthly: (months: number) => ['analytics', 'monthly', months] as const,
    categories: (period: string, type: string) =>
      ['analytics', 'categories', period, type] as const,
    fixedVariable: (period: string) => ['analytics', 'fixed-variable', period] as const,
    trend: (period: string) => ['analytics', 'trend', period] as const,
  },
  planning: {
    month: (params: Record<string, unknown>) => ['analytics', 'planning', params] as const,
  },
} as const;
