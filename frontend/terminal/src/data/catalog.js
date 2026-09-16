export const TERMINAL_CATALOG = {
  version: 'terminal-local-placeholder-v2',
  source: 'local-placeholder',

  // UT-ICE-Hero-* is reserved for clean, homogeneous soft-ice visuals only.
  product: {
    id: 'soft_ice_cream',
    name: 'Сливочное',
    price: null,
    currency: 'RUB',
    available: true,
    media: {
      id: 'UT-ICE-Hero-001',
      role: 'PRIMARY_HERO',
      preview: null
    }
  },

  // Sprinkle and sauce media are independent visual layers. They must never
  // consume UT-ICE-Hero-* identifiers and may be composed over the base image.
  sprinkles: [
    { id: 'none', name: 'Без посыпки', price: 0, available: true, media: null },
    {
      id: 'nut_crumb',
      name: 'Ореховая крошка',
      shortDescription: 'Смесь премиальных орехов',
      price: null,
      available: true,
      media: { id: 'UT-SPR-001', role: 'OVERLAY', preview: null },
      allergens: ['nuts', 'peanut']
    },
    { id: 'confetti', name: 'Конфетти', price: null, available: true, media: { id: 'UT-SPR-002', role: 'OVERLAY', preview: null } },
    { id: 'wafer_crumb', name: 'Вафельная крошка', price: null, available: true, media: { id: 'UT-SPR-003', role: 'OVERLAY', preview: null } }
  ],

  sauces: [
    { id: 'none', name: 'Без топпинга', price: 0, available: true, media: null },
    { id: 'chocolate', name: 'Шоколадный', price: null, available: true, media: { id: 'UT-SAUCE-001', role: 'OVERLAY', preview: null } },
    { id: 'strawberry', name: 'Клубничный', price: null, available: true, media: { id: 'UT-SAUCE-002', role: 'OVERLAY', preview: null } },
    { id: 'caramel', name: 'Карамельный', price: null, available: true, media: { id: 'UT-SAUCE-003', role: 'OVERLAY', preview: null } }
  ]
};
