export const flavorOfDay = {
  id: 'vanilla',
  name: 'Ванильное мягкое мороженое',
  label: 'Вкус дня'
};

export const product = {
  id: 'soft_ice_cup',
  name: 'Мягкое мороженое',
  price: 130,
  currency: '₽',
  pricingNote: 'Сироп и топпинг входят в стоимость'
};

export const productVisuals = {
  base: {
    label: 'Ванильное мороженое в стаканчике',
    emoji: '🥛🍦'
  },
  syrups: {
    strawberry: { label: 'Ванильное мороженое с клубничным сиропом', emoji: '🍓🍦' },
    chocolate: { label: 'Ванильное мороженое с шоколадным сиропом', emoji: '🍫🍦' },
    caramel: { label: 'Ванильное мороженое с карамельным сиропом', emoji: '🍯🍦' }
  },
  toppings: {
    oreo: { label: 'с Oreo', emoji: '⚫' },
    sprinkles: { label: 'с цветной посыпкой', emoji: '🌈' },
    choco_crunch: { label: 'с шоколадной крошкой', emoji: '🍫' }
  }
};

export const syrups = [
  { id: 'strawberry', name: 'Клубника', icon: '🍓' },
  { id: 'chocolate', name: 'Шоколад', icon: '🍫' },
  { id: 'caramel', name: 'Карамель', icon: '🍯' }
];

export const toppings = [
  { id: 'oreo', name: 'Oreo', icon: '⚫' },
  { id: 'sprinkles', name: 'Цветная посыпка', icon: '🌈' },
  { id: 'choco_crunch', name: 'Шоколадная крошка', icon: '🍫' }
];
