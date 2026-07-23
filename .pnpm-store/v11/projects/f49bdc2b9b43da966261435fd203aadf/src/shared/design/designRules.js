export const DESIGN_RULES = Object.freeze({
  spacing: Object.freeze([4, 8, 16, 24, 40, 64]),
  hierarchy: Object.freeze({
    h1: '30px',
    body: '16px',
  }),
  microcopy: Object.freeze({
    placeholder: 'Введите номер',
    cta: 'Продолжить с комфортом',
  }),
});

export function spacingRule(index) {
  return `${DESIGN_RULES.spacing[index]}px`;
}
