/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {CustomerBenefitsPage} from './CustomerBenefits';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.unstubAllGlobals();});
it('shows modes and keeps historical posting and activation separate from saving',async()=>{
 const data={current:{version:1,status:'DRAFT',rules:[{key:'purchase_percent',label:'Бонусы за покупку',value:5,unit:'%',mode:'demo',condition:'После подтверждения выдачи',source:'Аудит'}]},versions:[]};
 vi.stubGlobal('fetch',vi.fn(async url=>({ok:true,json:async()=>({data:String(url).endsWith('/journal')?[]:data})})));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>{root.render(<CustomerBenefitsPage/>);});
 expect(container.textContent).toContain('Demo');expect(container.textContent).toContain('Начислений по новым правилам пока нет.');
 const activation=Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Включить версию для будущих покупок');expect(activation.disabled).toBe(true);
 const preview=Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Рассчитать без начисления');expect(preview.disabled).toBe(false);
 expect(container.querySelector('[aria-label="Бонусы за покупку"]').value).toBe('5');
});
it('adds an editable custom draft and offers no live switch without engine',async()=>{
 const data={current:{version:1,status:'DRAFT',rules:[]},versions:[]};
 vi.stubGlobal('fetch',vi.fn(async url=>({ok:true,json:async()=>({data:String(url).endsWith('/journal')?[]:data})})));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<CustomerBenefitsPage/>));
 await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='+ Добавить правило').click());
 expect(container.querySelector('input[aria-label^="Название:"]').value).toBe('Новое правило');
 const modes=container.querySelector('select[aria-label^="Режим:"]');
 expect(Array.from(modes.options).map(o=>o.value)).toEqual(['draft','off']);
 expect(container.querySelector('textarea')).not.toBeNull();
});
