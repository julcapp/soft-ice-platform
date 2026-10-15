/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {OrganizationsPage} from './Organizations';
import {AdminErrorBoundary} from './AdminErrorBoundary';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.restoreAllMocks();});
function mount(element){container=document.createElement('div');document.body.append(container);root=createRoot(container);return act(async()=>{root.render(element);});}
it('a missing organization client method becomes a visible load error',async()=>{
 const clients={getOrganization:async()=>({}),getOrganizationUnits:async()=>[],getOrganizationMembers:async()=>[],getOrganizationLocations:async()=>[],getOrganizationMachines:async()=>[],getOrganizationResponsibilities:async()=>[]};
 await mount(<OrganizationsPage route="organizations/org/overview" clients={clients}/>);
 expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(container.textContent).toContain('Не удалось получить данные');
});
it('unexpected render errors show recovery controls instead of a blank screen',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});function Broken(){throw Error('render failure');}
 await mount(<AdminErrorBoundary><Broken/></AdminErrorBoundary>);
 expect(container.textContent).toContain('Не удалось открыть раздел');expect(container.textContent).toContain('Повторить загрузку');expect(container.textContent).toContain('Главное меню');
});
