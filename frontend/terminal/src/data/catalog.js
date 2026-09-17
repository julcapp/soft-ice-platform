export const TERMINAL_CATALOG = {
  version: 'terminal-approved-v1',
  source: 'approved-terminal-catalog',
  product: {
    id: 'soft_ice_cream', name: 'Сливочное', price: 120, currency: 'RUB', available: true,
    media: { id: 'UT-ICE-Hero-001', role: 'PRIMARY_HERO', preview: null }
  },
  sprinkles: [
    { id: 'none', name: 'Без посыпки', price: 0, available: true, media: null },
    { id: 'nut_crumb', name: 'Ореховая крошка', price: 35, available: true, media: { id: 'UT-SPR-001', role: 'OVERLAY', preview: null }, allergens: ['nuts','peanut'] },
    { id: 'confetti', name: 'Конфетти', price: 35, available: true, media: { id: 'UT-SPR-002', role: 'OVERLAY', preview: null } },
    { id: 'wafer_crumb', name: 'Вафельная крошка', price: 35, available: true, media: { id: 'UT-SPR-003', role: 'OVERLAY', preview: null } }
  ],
  sauces: [
    { id: 'none', name: 'Без топпинга', price: 0, available: true, media: null },
    { id: 'chocolate', name: 'Шоколадный', price: 45, available: true, media: { id: 'UT-SAUCE-001', role: 'OVERLAY', preview: null } },
    { id: 'strawberry', name: 'Клубничный', price: 35, available: true, media: { id: 'UT-SAUCE-002', role: 'OVERLAY', preview: null } },
    { id: 'caramel', name: 'Карамельный', price: 35, available: true, media: { id: 'UT-SAUCE-003', role: 'OVERLAY', preview: null } }
  ]
};
