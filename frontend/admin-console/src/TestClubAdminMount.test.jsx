/** @vitest-environment jsdom */
import React,{act} from 'react';
import {it,expect,vi} from 'vitest';
import {installTestClubAdminAddon} from './TestClubAdminMount';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('adds one test section to an existing card and removes unsupported test refunds',async()=>{
 const previous=global.fetch;global.fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{loyalty:{testClubAccount:{availableBalanceRub:150,creditedRub:150,debitedRub:0}}}})});
 document.body.innerHTML='<div class="crm-workspace"><section class="customer-identity">Клиент</section><table><tbody><tr><td>TEST_CLUB_TOPUP</td></tr></tbody></table><select><option value="">Выберите</option><option value="test-club-topup:1">Тест</option><option value="payment:1">Платёж</option></select></div>';
 location.hash='#users/251eda93-85b5-4cb4-83b7-00a5ce335150';let stop;
 try{await act(async()=>{stop=installTestClubAdminAddon();await Promise.resolve();});await act(async()=>{await Promise.resolve();});expect(document.querySelectorAll('[aria-label="Тестовый клубный счёт"]').length).toBe(1);expect(document.body.textContent).toContain('150,00');expect(document.querySelector('td').textContent).toContain('ТЕСТ');expect(document.querySelectorAll('option').length).toBe(2);expect(global.fetch).toHaveBeenCalledTimes(1);}finally{act(()=>stop());document.body.innerHTML='';global.fetch=previous;location.hash='';}
});
