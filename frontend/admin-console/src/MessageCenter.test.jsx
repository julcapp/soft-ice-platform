// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { MessageCenterPage } from './MessageCenter';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();});
async function mount(element){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(element));}
it('shows unique numbers, separate channel statuses and passes channel filters',async()=>{
 const client={list:vi.fn(async()=>({total:51,items:[{id:'crm:1',number:'MSG-1',subject:'Тест',recipientName:'Сотрудник',recipientType:'TEAM',createdAt:'2026-10-08T04:00:00Z',deliveries:[{id:'d1',channel:'MAX',status:'SENT',sentAt:'2026-10-08T04:00:01Z'},{id:'d2',channel:'TELEGRAM',status:'FAILED'}]}]}))};
 await mount(<MessageCenterPage client={client}/>);
 expect(host.querySelector('a').getAttribute('href')).toBe('#message-center/crm%3A1');expect(host.textContent).toContain('Отправлено');expect(host.textContent).toContain('Ошибка');
 await act(async()=>{const select=host.querySelector('[aria-label="Канал сообщения"]');select.value='MAX';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(client.list.mock.lastCall[0].channel).toBe('MAX');
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Далее').click());expect(client.list.mock.lastCall[0].offset).toBe(50);
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Назад').click());expect(client.list.mock.lastCall[0].offset).toBe(0);
});
it('shows the stored text safely, provider identity and delivery history',async()=>{
 const client={get:vi.fn(async()=>({number:'MSG-1',recipientName:'Тест',recipientType:'CUSTOMER',body:'<script>danger</script>\nСообщение',source:'CRM',createdAt:'2026-10-08T04:00:00Z',deliveries:[{id:'d1',channel:'MAX',status:'SENT',providerMessageId:'p-77'}],history:[{id:'h1',deliveryId:'d1',status:'SENT',occurredAt:'2026-10-08T04:00:00Z'}]}))};
 await mount(<MessageCenterPage client={client} route="message-center/crm%3A1"/>);expect(client.get.mock.calls[0][0]).toBe('crm:1');expect(host.querySelector('script')).toBeNull();expect(host.textContent).toContain('<script>danger</script>');expect(host.textContent).toContain('p-77');expect(host.textContent).toContain('История фиксации');
});
it('shows access failure instead of an empty list',async()=>{
 await mount(<MessageCenterPage client={{list:async()=>{throw new Error('Доступ запрещён')}}}/>);expect(host.querySelector('[role=alert]').textContent).toContain('Доступ запрещён');
});
