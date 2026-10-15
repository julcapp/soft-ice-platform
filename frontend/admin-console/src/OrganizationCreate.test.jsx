// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { OrganizationCreate } from './OrganizationCreate';
it('сохраняет организацию только после явного подтверждения', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), saved = vi.fn();
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 'org' } }) }));
  try {
    await act(async () => root.render(<OrganizationCreate organizations={[]} onSaved={saved} />));
    await act(async () => host.querySelector('button').click());
    const inputs = host.querySelectorAll('input');
    await act(async () => { for (const input of inputs) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'У Тимоши'); input.dispatchEvent(new Event('input', { bubbles: true })); } });
    await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
    expect(host.textContent).toContain('Подтвердить и сохранить');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Подтвердить и сохранить').click());
    expect(globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(saved).toHaveBeenCalledWith({ id: 'org' });
  } finally { await act(async () => root.unmount()); host.remove(); globalThis.fetch = original; }
});
it('выбирает организацию из базы и показывает её руководителя и контакты', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), selected = vi.fn(), original = globalThis.fetch;
  const org = { id: 'existing', shortName: 'ООО Тест', fullName: 'Тестовая организация', inn: '7017438363', directorName: 'Иванов Иван Иванович', phone: '+79000000000', email: 'office@example.org' };
  globalThis.fetch = vi.fn(async (url) => ({ ok: true, json: async () => ({ data: url.endsWith('/lookup/config') ? { configured: false } : [org] }) }));
  try {
    await act(async () => root.render(<OrganizationCreate organizations={[{ id: org.id, shortName: org.shortName }]} onSelect={selected} />));
    await act(async () => { const select = host.querySelector('select'); select.value = org.id; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(selected).toHaveBeenCalledWith(org.id);
    expect(host.textContent).toContain(org.directorName);
    expect(host.textContent).toContain(org.email);
    expect(host.textContent).toContain(org.inn);
    expect(globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  } finally { await act(async () => root.unmount()); host.remove(); globalThis.fetch = original; }
});
