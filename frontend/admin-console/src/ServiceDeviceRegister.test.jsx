// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { ServiceDeviceRegister } from './ServiceDeviceRegister';
it('привязывает смартфон к выбранному сотруднику только после подтверждения и показывает конфликт сервера', async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true;
 const host = document.createElement('div'); document.body.append(host);
 const root = createRoot(host), original = globalThis.fetch;
 globalThis.fetch = vi.fn(async () => ({ ok:false, json:async()=>({error:{message:'У сотрудника уже есть привязанный смартфон.'}}) }));
 try {
  await act(async () => root.render(<ServiceDeviceRegister members={[{id:'person',fullName:'Тестовый Сотрудник',organizationId:'org'}]} organizations={[{id:'org',shortName:'Организация'}]}/>));
  await act(async () => { const select=host.querySelector('select');select.value='person';select.dispatchEvent(new Event('change',{bubbles:true})); });
  const device={manufacturer:'Test',model:'Phone',androidVersion:'14',appVersion:'0.1.0',publicKey:'-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----'};
  await act(async () => { const input=host.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,JSON.stringify(device));input.dispatchEvent(new Event('input',{bubbles:true})); });
  await act(async () => host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Test Phone');
  await act(async () => [...host.querySelectorAll('button')].find(b=>b.textContent==='Подтвердить привязку смартфона').click());
  expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/v1/admin/service-devices/person');
  expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual(device);
  expect(host.querySelector('[role=alert]').textContent).toContain('уже есть');
 } finally { await act(async()=>root.unmount());host.remove();globalThis.fetch=original; }
});
