// Bütün istifadəçi mətnləri bir yerdə (README §13). Kodda sərbəst mətn yazılmır.
export const t = {
  app: {
    name: 'Agaemi Kassa',
    shortName: 'Kassa',
  },
  nav: {
    dashboard: 'Panel',
    transactions: 'Əməliyyatlar',
    stats: 'Statistika',
    more: 'Daha çox',
  },
  common: {
    total: 'Cəmi',
    free: 'Sərbəst',
    savings: 'Yığım',
    thisMonth: 'Bu ay',
    income: 'Mədaxil',
    expense: 'Məxaric',
    transfer: 'Köçürmə',
    difference: 'Fərq',
    comingSoon: (phase: number) => `Mərhələ ${phase}-də gələcək`,
  },
  dashboard: {
    title: 'Panel',
    wallets: 'Cüzdanlar',
    addIncome: '+ Mədaxil',
    addExpense: '− Məxaric',
    addTransfer: '⇄ Köçürmə',
  },
  transactions: {
    title: 'Əməliyyatlar',
    empty: 'Hələ əməliyyat yoxdur — ilk xərcini əlavə et',
  },
  stats: {
    title: 'Statistika',
  },
  more: {
    title: 'Daha çox',
    debts: 'Borclar',
    goals: 'Hədəflər',
    templates: 'Şablonlar',
    wallets: 'Cüzdanlar',
    categories: 'Kateqoriyalar',
    budgets: 'Büdcə',
    backup: 'Ehtiyat nüsxə',
    settings: 'Ayarlar',
  },
  update: {
    ready: 'Yeni versiya hazırdır',
    reload: 'Yenilə',
    later: 'Sonra',
  },
  seed: {
    wallets: {
      cash: 'Nağd',
      card: 'Kart',
    },
  },
} as const;
