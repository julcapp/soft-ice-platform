import { describe, expect, it } from 'vitest';
import { moscowLocalToIso } from './promotionTime';

describe('promotion scheduling timezone', () => {
  it('treats datetime-local as Europe/Moscow wall clock', () => {
    expect(moscowLocalToIso('2026-08-25T17:00')).toBe('2026-08-25T14:00:00.000Z');
  });

  it('preserves seconds when supplied', () => {
    expect(moscowLocalToIso('2026-08-25T19:00:30')).toBe('2026-08-25T16:00:30.000Z');
  });
});
