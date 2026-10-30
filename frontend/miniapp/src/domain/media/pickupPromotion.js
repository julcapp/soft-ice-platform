// Owner-approved advertising images; independent of the purchased configuration.
const slides = Object.freeze([
  { id: 'pickup_promo_vanilla', src: '/images/marketing/pickup/vanilla_cup.webp', alt: 'Рекламное изображение сливочного мороженого в фирменном стаканчике' },
  { id: 'pickup_promo_strawberry_swirl', src: '/images/marketing/pickup/strawberry_swirl.webp', alt: 'Рекламная композиция: ягодное мороженое и клубника' },
  { id: 'pickup_promo_strawberry_cup', src: '/images/marketing/pickup/strawberry_cup.webp', alt: 'Рекламная композиция: мороженое в стаканчике с клубникой' },
]);
export function getPickupPromotion() {
  return { slides, intervalMs: 5000, caption: '* Изображение приведено в рекламных целях. Вы получаете мороженое, собранное по вашему выбору.' };
}
