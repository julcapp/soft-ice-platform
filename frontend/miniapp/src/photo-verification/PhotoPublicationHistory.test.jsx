import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoPublicationHistory } from './PhotoPublicationHistory.jsx';

describe('PhotoPublicationHistory', () => {
  it('renders personal photo history heading without exposing antifraud internals', () => {
    const html = renderToStaticMarkup(<PhotoPublicationHistory client={() => new Promise(() => {})} />);
    expect(html).toContain('Мои фотографии');
    expect(html).toContain('Загружаем историю');
    expect(html).not.toContain('fraudScore');
    expect(html).not.toContain('sha256');
  });
});
