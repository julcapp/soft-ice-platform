import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TestClubAccount} from './TestClubAccount';
import {PlatformTestTopups} from './PlatformTestTopups';
function CustomerTestAccount({customerId}){
 const [account,setAccount]=useState(null);
 useEffect(()=>{const abort=new AbortController();fetch(`/api/v1/admin/customer-360/customers/${encodeURIComponent(customerId)}`,{signal:abort.signal}).then(async response=>{if(response.ok)setAccount((await response.json()).data?.loyalty?.testClubAccount||null);}).catch(()=>{});return()=>abort.abort();},[customerId]);
 return <TestClubAccount account={account}/>;
}
// Additive entry preserves the deployed console's existing bundle and standalone sections.
export function installTestClubAdminAddon(){
 let active=null,pending=false;
 const cleanup=()=>{if(active){active.root.unmount();active.node.remove();active=null;}};
 const refresh=()=>{
  pending=false;const route=location.hash.slice(1),match=/^(?:users|customer-360)\/([0-9a-f-]{36})$/i.exec(route);
  if(active&&(active.route!==route||!active.node.isConnected))cleanup();
  if(match){
   const workspace=document.querySelector('.crm-workspace'),existing=workspace?.querySelector('[aria-label="Тестовый клубный счёт"]');
   if(!active&&workspace&&!existing){const node=document.createElement('div');node.dataset.testClubAddon='';const identity=workspace.querySelector('.customer-identity');if(identity)identity.after(node);else workspace.prepend(node);const root=createRoot(node);active={root,node,route};root.render(<CustomerTestAccount customerId={match[1]}/>);}
   // Older tables receive TEST IDs from the API; unsupported real refunds stay unavailable.
   for(const option of document.querySelectorAll('option'))if(option.value.startsWith('test-club-topup:'))option.remove();
   for(const cell of document.querySelectorAll('td'))if(['TEST_CLUB_TOPUP','CLUB_INITIAL_TOPUP'].includes(cell.textContent.trim()))cell.textContent='Пополнение клуба · ТЕСТ';
  }else if(route==='payments'){
   const page=document.querySelector('.payments-page');
   if(!active&&page&&!document.querySelector('[aria-label="Тестовые пополнения клиентов"]')){const node=document.createElement('div');node.dataset.testClubAddon='';page.before(node);const root=createRoot(node);active={root,node,route};root.render(<PlatformTestTopups/>);}
  }else cleanup();
 };
 const schedule=()=>{if(!pending){pending=true;queueMicrotask(refresh);}};
 const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);schedule();
 return()=>{observer.disconnect();window.removeEventListener('hashchange',schedule);cleanup();};
}
