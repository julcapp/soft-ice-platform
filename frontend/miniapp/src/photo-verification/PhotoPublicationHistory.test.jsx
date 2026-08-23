import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoPublicationHistory, moderationLabel, publicationLabel } from './PhotoPublicationHistory.jsx';

describe('PhotoPublicationHistory', () => {
  it('renders personal photo history heading without exposing antifraud internals', () => {
    const html = renderToStaticMarkup(<PhotoPublicationHistory client={() => new Promise(() => {})} />);
    expect(html).toContain('Мои фотографии');
    expect(html).toContain('Загружаем историю');
    expect(html).not.toContain('fraudScore');
    expect(html).not.toContain('sha256');
  });

  it('treats published and confirmed as the same customer-facing success state', () => {
    expect(publicationLabel('published')).toBe('Опубликовано');
    expect(publicationLabel('confirmed')).toBe('Опубликовано');
    expect(publicationLabel('failed')).toBe('Ошибка публикации');
  });

  it('uses Russian customer-facing moderation labels', () => {
    expect(moderationLabel('approved')).toBe('Проверено — одобрено');
    expect(moderationLabel('manual_review')).toBe('Нужна дополнительная проверка');
    expect(moderationLabel('rejected')).toBe('Отклонено');
  });
});
