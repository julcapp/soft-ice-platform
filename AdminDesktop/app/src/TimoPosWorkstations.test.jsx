// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./api/organizationClient',()=>({
  getOrganizations:vi.fn(async()=>[{id:'org-1',shortName:'Компания'}]),
  getOrganizationMembers:vi.fn(async()=>[{id:'seller-1',fullName:'Иванов И.И.'}]),
}));
vi.mock('./api/adminAuth',()=>({adminAuthHeaders:()=>({Authorization:'Bearer test'})}));
import {TimoPosWorkstationsPage} from './TimoPosWorkstations';

let container,root;
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  container=document.createElement('div');document.body.appendChild(container);
  root=createRoot(container);
  globalThis.fetch=vi.fn(async(path,options)=>{
    return {ok:true,json:async()=>({
      points:[{id:'point-1',name:'Точка №001'}],
      terminals:[{terminalId:'POS-001',pointId:'point-1'}],
      assignments:[{sellerId:'seller-1',pointId:'point-1',active:true}]
    })};
  });
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();});
it('shows separate TimoPOS admin entry and does not issue write operations on load',async()=>{
 await act(async()=>root.render(<TimoPosWorkstationsPage/>));
 expect(container.textContent).toContain('TimoPOS · Точки и продавцы');
 expect(container.textContent).toContain('Организация');
 expect(globalThis.fetch).not.toHaveBeenCalled();
});
it('loads point-terminal-seller bindings only after choosing organization',async()=>{
 await act(async()=>root.render(<TimoPosWorkstationsPage/>));
 const select=container.querySelector('#pos-org');
 await act(async()=>{select.value='org-1';select.dispatchEvent(new Event('change',{bubbles:true}))});
 expect(globalThis.fetch).toHaveBeenCalledTimes(1);
 expect(String(globalThis.fetch.mock.calls[0][0])).toContain('/api/v1/admin/timopos/organizations/org-1/points');
 expect(container.textContent).toContain('POS-001');
 expect(container.textContent).toContain('Иванов И.И.');
 expect(globalThis.fetch.mock.calls.every(call=>!['POST','PUT','DELETE'].includes(call[1]?.method))).toBe(true);
});
