/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {TestClubAccount} from './TestClubAccount';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('shows test available/credited/debited sums without calling them real money or bonuses',()=>{
 const host=document.createElement('div'),root=createRoot(host);
 try{act(()=>root.render(<TestClubAccount account={{availableBalanceRub:143,creditedRub:150,debitedRub:7}}/>));expect(host.textContent).toContain('Тестовый клубный счёт');expect(host.textContent).toContain('143,00');expect(host.textContent).toContain('150,00');expect(host.textContent).toContain('7,00');expect(host.textContent).toContain('Отдельно от реальных денег и бонусов');}finally{act(()=>root.unmount());}
});
