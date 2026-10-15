// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { StaffCreate } from './ServiceAccess';
import { PasswordInput } from './PasswordInput';
import { normalizePersonName } from './personName';
it('показывает и скрывает пароль без изменения значения и отправки формы', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), submitted = vi.fn();
  try {
    await act(async () => root.render(<form onSubmit={submitted}><PasswordInput value="secret-test-123" readOnly minLength={9}/></form>));
    expect(host.querySelector('input').type).toBe('password');
    await act(async () => host.querySelector('button').click());
    expect(host.querySelector('input').type).toBe('text');
    expect(host.querySelector('input').value).toBe('secret-test-123');
    expect(host.querySelector('button').getAttribute('aria-label')).toBe('Скрыть пароль');
    await act(async () => host.querySelector('button').click());
    expect(host.querySelector('input').type).toBe('password');
    expect(submitted).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
it('выбирает существующего мастера для логина техника и отправляет ID после подтверждения', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), original = globalThis.fetch, saved = vi.fn();
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { memberId: 'person' } }) }));
  try {
    await act(async () => root.render(<StaffCreate initial={{ role: 'SERVICE_SPECIALIST', userId: 'tech-login' }} organizations={[{id:'org',shortName:'Тест'}]} members={[{id:'person',organizationId:'org',fullName:'Хаов Геннадий Эдуардович',roles:['MACHINE_RESPONSIBLE']}]} onSaved={saved} />));
    await act(async () => { const select = host.querySelectorAll('select')[2]; select.value='person'; select.dispatchEvent(new Event('change',{bubbles:true})); });
    expect(host.querySelectorAll('input').length).toBe(0);
    await act(async () => host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll('button')].find((b)=>b.textContent==='Подтвердить и сохранить').click());
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body).toEqual({organizationId:'org',role:'SERVICE_SPECIALIST',memberId:'person',userId:'tech-login'});
    expect(saved).toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); globalThis.fetch=original; }
});
it('приводит ФИО и двойные фамилии к заглавным буквам', () => {
  expect(normalizePersonName('  хаов   геннадий ЭДУАРДОВИЧ ')).toBe('Хаов Геннадий Эдуардович');
  expect(normalizePersonName('иванова-петрова анна-мария')).toBe('Иванова-Петрова Анна-Мария');
});
