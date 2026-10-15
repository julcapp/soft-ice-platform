// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { MainMenuButton, NavigationSaveProvider, useBeforeNavigation } from './NavigationSave';
import { CatalogPricesPage } from './CatalogPrices';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(async () => { if(root) await act(async()=>root.unmount()); host?.remove(); history.replaceState(null,'','#'); });
async function mount(children) { history.replaceState(null,'','#catalog-prices'); host=document.createElement('div');document.body.append(host);root=createRoot(host); await act(async()=>root.render(<NavigationSaveProvider>{children}</NavigationSaveProvider>)); }
function Rule({ plan }) { useBeforeNavigation(()=>plan); return null; }
it('waits for saving before returning and prevents repeated clicks', async()=>{
 let finish;const save=vi.fn(()=>new Promise(resolve=>finish=resolve));
 await mount(<><Rule plan={{save}}/><MainMenuButton/></>);
 await act(async()=>host.querySelector('button').click());
 expect(location.hash).toBe('#catalog-prices');expect(save).toHaveBeenCalledTimes(1);expect(host.querySelector('button').disabled).toBe(true);
 await act(async()=>finish(true));expect(location.hash).toBe('#dashboard');
});
it('checks pending confirmation before saving any other form',async()=>{
 const save=vi.fn();await mount(<><Rule plan={{save}}/><Rule plan={{block:'Подтвердите регистрацию'}}/><MainMenuButton/></>);
 await act(async()=>host.querySelector('button').click());expect(save).not.toHaveBeenCalled();expect(location.hash).toBe('#catalog-prices');expect(host.querySelector('[role=alert]').textContent).toContain('Подтвердите');
});
it('protects sidebar links when a save rejects',async()=>{
 await mount(<><Rule plan={{save:async()=>{throw new Error('Сервер недоступен')}}}/><a href="#organizations">Организации</a></>);
 await act(async()=>host.querySelector('a').click());expect(location.hash).toBe('#catalog-prices');expect(host.textContent).toContain('Сервер недоступен');
});
it('saves the edited catalog price and keeps its input on server failure',async()=>{
 const item={id:'a',sku:'a',category:'ICE_CREAM',nameRu:'Тест',basePrice:100,currency:'RUB',machines:[]};
 const client={list:vi.fn(async()=>[item]),listMachines:vi.fn(async()=>[]),updatePrices:vi.fn(async()=>{throw new Error('Ошибка БД')})};
 await mount(<><MainMenuButton/><CatalogPricesPage client={client}/></>);
 const input=host.querySelector('[aria-label="Цена Тест"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'12');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Главное меню').click());
 expect(client.updatePrices).toHaveBeenCalledWith([{id:'a',basePrice:12,currency:'RUB'}]);expect(location.hash).toBe('#catalog-prices');expect(input.value).toBe('12');
 client.updatePrices.mockImplementation(async(changes)=>{item.basePrice=changes[0].basePrice});
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Главное меню').click());expect(location.hash).toBe('#dashboard');expect(item.basePrice).toBe(12);
});

it('asks to save, discard or stay when a user card has a draft', async()=>{
 const save=vi.fn(async()=>true),discard=vi.fn();await mount(<><Rule plan={{dirty:true,save,discard}}/><MainMenuButton/></>);
 await act(async()=>host.querySelector('button').click());
 expect(host.querySelector('[role=dialog]')).not.toBeNull();expect(save).not.toHaveBeenCalled();
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Остаться').click());expect(location.hash).toBe('#catalog-prices');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Главное меню').click());
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Перейти без сохранения').click());expect(discard).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();expect(location.hash).toBe('#dashboard');
});
it('failed save retains the previous route', async()=>{
 const save=vi.fn(async()=>false);await mount(<><Rule plan={{dirty:true,save}}/><MainMenuButton/></>);
 await act(async()=>host.querySelector('button').click());await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Сохранить и перейти').click());expect(save).toHaveBeenCalledOnce();expect(location.hash).toBe('#catalog-prices');expect(host.querySelector('[role=alert]')).not.toBeNull();
});
