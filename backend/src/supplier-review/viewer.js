(function(){
'use strict';
const BASE='/api/supplier-review/';
const nativeFetch=window.fetch.bind(window);
const query=new URLSearchParams(location.search);let language=['ru','en','zh'].includes(query.get('lang'))?query.get('lang'):(localStorage.getItem('supplier-language')||'en');
// UI compatibility marker has no authentication capability and never leaves this adapter.
const sessionGet=sessionStorage.getItem.bind(sessionStorage);
Object.defineProperty(sessionStorage,'getItem',{value:function(k){return k==='softice_admin_access_token'?'supplier-readonly-ui-marker':sessionGet(k);}});
let dictionary={};let queued=false;const originals=new WeakMap();let toolbar;
window.fetch=async function(input,init={}){
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.origin!==location.origin)return new Response(JSON.stringify({error:{code:'SUPPLIER_EXTERNAL_REQUEST_DENIED'}}),{status:403,headers:{'Content-Type':'application/json'}});
 if(url.pathname==='/api/v1/admin/auth/me'&&(init.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='GET')return nativeFetch(BASE+'identity',{cache:'no-store'});
 if(url.pathname.startsWith('/api/v1/')){
  const method=(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(method!=='GET')return new Response(JSON.stringify({error:{code:'SUPPLIER_READ_ONLY',message:labels().blocked}}),{status:403,headers:{'Content-Type':'application/json'}});
  const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));headers.delete('Authorization');headers.delete('X-Admin-Permissions');
  const r=await nativeFetch(BASE+'read/'+url.pathname.slice('/api/v1/'.length)+url.search,{...init,method:'GET',headers,credentials:'same-origin'});
  if(r.status===401)location.replace(BASE+'?lang='+language);return r;
 }
 if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith(BASE))return new Response(JSON.stringify({error:{code:'SUPPLIER_PATH_DENIED'}}),{status:403,headers:{'Content-Type':'application/json'}});
 return nativeFetch(input,init);
};
function labels(){return{ru:{title:'Кабинет поставщика · все разделы · только просмотр',exit:'Выйти',blocked:'Для поставщика разрешён только просмотр.',expiry:'Доступ до 15.11.2026',profile:'Chahine CHIHA · только просмотр'},en:{title:'Supplier workspace · all sections · read only',exit:'Sign out',blocked:'Supplier access is read-only.',expiry:'Access until 15 Nov 2026',profile:'Chahine CHIHA · read only'},zh:{title:'供应商工作台 · 全部模块 · 只读',exit:'退出',blocked:'供应商仅有查看权限。',expiry:'访问有效期至 2026年11月15日',profile:'Chahine CHIHA · 只读'}}[language];}
const action=/^(Emergency Stop|Emergency stop|Archive|Validate|Архивировать|Проверить безопасность|Сохран|Созда|Удал|Убрать|Примен|Подготов|Выполнить|Оформить|Подтвердить|Одобр|Отклон|Активир|Деактивир|Отключ|Включ|Назнач|Переназнач|Принять|Заверш|Запросить|Заплан|Отметить|Прочитать|Поставить|Написать|Начать|Продлить|Установить|Снять|Вернуть|Взять|Добавить|Отложить|Переоткрыть|Повторить безопасно|Проверить камеру|Run now|▶ Run|＋ Создать|Ⅱ Пауза)/;
function translated(value){if(language==='ru')return value;const leading=value.match(/^\s*/)[0],trailing=value.match(/\s*$/)[0],key=value.trim();if(dictionary[key])return leading+dictionary[key][language]+trailing;
 const pair=/^([^:]+):(.+)$/.exec(key);if(pair&&dictionary[pair[1].trim()])return leading+dictionary[pair[1].trim()][language]+':'+pair[2]+trailing;
 if(key.startsWith('Удалить выбранные'))return (language==='zh'?'删除所选':'Delete selected')+key.slice('Удалить выбранные'.length);
 // Only known UI phrase fragments are replaced; unrecognized business data stays original.
 let s=value;for(const [k,v] of fragments)if(s.includes(k))s=s.split(k).join(v[language]);return s;
}
let fragments=[];
function renderExtra(){
 const route=location.hash.slice(1);const isFleet=route==='machines',isOperators=route==='operators';const main=document.querySelector('#root main');
 if(!isFleet&&!isOperators){document.body.classList.remove('supplier-extra');document.querySelector('#supplier-extra-content')?.remove();return;}
 if(!main)return;document.body.classList.add('supplier-extra');
 let box=document.querySelector('#supplier-extra-content');if(box&&box.dataset.route===route)return;box?.remove();box=document.createElement('section');box.id='supplier-extra-content';box.dataset.route=route;box.className='card';
 function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
 box.append(text('h1',isFleet?'Парк автоматов':'Рабочее место оператора'),text('p',isFleet?'Список аппаратов из существующих цифровых проекций. Режим данных указан отдельно.':'Назначения операторов по аппаратам. Рабочие действия выполняются в отдельной служебной панели.'),text('p','Только просмотр'));main.append(box);
 const loading=text('p','Загрузка…');box.append(loading);
 window.fetch('/api/v1/admin/machine-twins').then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(payload=>{if(!box.isConnected)return;loading.remove();const rows=Array.isArray(payload.data)?payload.data:[];
 if(!rows.length){box.append(text('p','В этом разделе пока нет записей'));return;}
 const scroll=document.createElement('div');scroll.className='table-scroll';const table=document.createElement('table');const head=document.createElement('thead'),tr=document.createElement('tr');for(const label of isFleet?['Аппарат','Модель','Расположение','Статус','Режим данных','Действия']:['Аппарат','Назначенный оператор','Статус','Режим данных','Действия'])tr.append(text('th',label));head.append(tr);table.append(head);const body=document.createElement('tbody');
 for(const row of rows){const tr=document.createElement('tr');const values=isFleet?[row.name||row.machineId,row.model||'—',row.location||'—',row.operationalStatus||'UNKNOWN',row.dataMode||'UNKNOWN']:[row.name||row.machineId,row.assignedOperator?.name||'Не назначен',row.operationalStatus||'UNKNOWN',row.dataMode||'UNKNOWN'];values.forEach(v=>tr.append(text('td',String(v))));const td=document.createElement('td'),a=text('a','Открыть цифровой двойник');a.href='#machine-twins/'+encodeURIComponent(row.machineId)+'/overview';td.append(a);tr.append(td);body.append(tr);}table.append(body);scroll.append(table);box.append(scroll);
 }).catch(()=>{loading.textContent='Панель управления недоступна';});
}

function patch(){queued=false;if(!document.body)return;observer.disconnect();renderExtra();
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=walker.nextNode()){
  if(n.parentElement?.closest('script,style,code,pre,textarea,#supplier-toolbar,[data-supplier-original]'))continue;
  const old=originals.get(n);const source=old&&n.nodeValue===old.rendered?old.source:n.nodeValue;
  const rendered=translated(source);originals.set(n,{source,rendered});if(n.nodeValue!==rendered)n.nodeValue=rendered;
 }
 for(const node of document.querySelectorAll('[placeholder],[title],[aria-label]')){if(node.closest('#supplier-toolbar'))continue;for(const attr of ['placeholder','title','aria-label']){if(!node.hasAttribute(attr))continue;const k='supplierOriginal'+attr.replace('-','');if(!node.dataset[k])node.dataset[k]=node.getAttribute(attr);const s=translated(node.dataset[k]);if(node.getAttribute(attr)!==s)node.setAttribute(attr,s);}}
 for(const input of document.querySelectorAll('#root .pe-editor input,#root .pe-editor select,#root .pe-editor textarea,#root .catalog-price input,#root .catalog-form input,#root .catalog-form select,#root .setting-toggle input,#root .setting-field select')){input.disabled=true;input.title=labels().blocked;}
 for(const b of document.querySelectorAll('#root button,#root input[type=submit]')){const original=b.dataset.supplierActionSource||(originals.get(b.firstChild)?.source||b.textContent);b.dataset.supplierActionSource=original;if(action.test(original.trim())||b.type==='submit'){b.disabled=true;b.title=labels().blocked;b.dataset.supplierBlocked='true';}}
 for(const media of document.querySelectorAll('#root img[src],#root video[src],#root source[src]')){const src=media.getAttribute('src');if(src?.startsWith('/api/v1/'))media.setAttribute('src',BASE+'read/'+src.slice('/api/v1/'.length));}
 const profile=document.querySelector('.user-menu');if(profile){profile.setAttribute('aria-label',labels().profile);profile.dataset.supplierOriginal='true';profile.style.visibility='visible';const name=profile.querySelector('strong'),role=profile.querySelector('small'),avatar=profile.querySelector(':scope > span');if(name)name.textContent='Chahine CHIHA';if(role)role.textContent=labels().profile.split(' · ')[1];if(avatar)avatar.textContent='CC';}
 for(const el of document.querySelectorAll('#root a[href]')){const href=el.getAttribute('href');if(href?.startsWith('/api/v1/')){el.setAttribute('href',BASE+'read/'+href.slice('/api/v1/'.length));}
 if(href&&!href.startsWith('#')&&!href.startsWith('?')){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}}
 if(toolbar){toolbar.querySelector('strong').textContent=labels().title;toolbar.querySelector('small').textContent=labels().expiry;toolbar.querySelector('button').textContent=labels().exit;}
 document.documentElement.lang=language==='zh'?'zh-CN':language;
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}
const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(patch);}});
async function boot(){
 const r=await nativeFetch(BASE+'dictionary.json',{cache:'no-store'});dictionary=await r.json();
 fragments=Object.entries(dictionary).filter(([k])=>k.length>=5&&(/[：:]$/.test(k)||/^←|^Операция|^Выбрано|^Записей/.test(k))).sort((a,b)=>b[0].length-a[0].length);
 toolbar=document.createElement('div');toolbar.id='supplier-toolbar';const strong=document.createElement('strong'),small=document.createElement('small'),select=document.createElement('select'),out=document.createElement('button');
 select.setAttribute('aria-label','Language');for(const [key,label]of Object.entries({ru:'Русский',en:'English',zh:'简体中文'})){const o=document.createElement('option');o.value=key;o.textContent=label;select.append(o);}select.value=language;
 select.onchange=()=>{language=select.value;localStorage.setItem('supplier-language',language);const u=new URL(location.href);u.searchParams.set('lang',language);history.replaceState(null,'',u);patch();};out.onclick=async()=>{await nativeFetch(BASE+'logout',{method:'POST'});location.replace(BASE+'?lang='+language);};
 toolbar.append(strong,small,select,out);document.body.prepend(toolbar);
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-supplier-blocked]');if(b){e.preventDefault();e.stopImmediatePropagation();}},true);
 patch();setInterval(async()=>{const r=await nativeFetch(BASE+'review',{cache:'no-store'});if(!r.ok)location.replace(BASE+'?lang='+language);},60000);
}
window.addEventListener('hashchange',()=>requestAnimationFrame(patch));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(console.error));else boot().catch(console.error);
})();
