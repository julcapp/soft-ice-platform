(function(){
'use strict';
if(location.pathname.startsWith('/api/')||window.__softiceAccountControls)return;
window.__softiceAccountControls=true;
const KEY='softice_admin_access_token';
const KEYS=[KEY,'access_token'];
const originalFetch=window.fetch.bind(window);
let signingOut=false;
function token(){return sessionStorage.getItem(KEY)||sessionStorage.getItem('access_token')||'';}
function clearTokens(){for(const k of KEYS){sessionStorage.removeItem(k);localStorage.removeItem(k);}}
function style(){if(document.querySelector('#softice-account-style'))return;const s=document.createElement('style');s.id='softice-account-style';s.textContent=`.softice-logout-button{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;min-height:42px;padding:9px 16px;border:1px solid #b9cfc9;border-radius:12px;background:#fff;color:#193b39;font:700 14px system-ui;cursor:pointer;white-space:nowrap}.softice-logout-button:hover{background:#edf7f3}.softice-logout-button:focus-visible{outline:3px solid #ffb84d;outline-offset:2px}.softice-logout-button:disabled{opacity:.6;cursor:wait}.softice-account-overlay{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:20px;background:#f8f4ee;overflow:auto;font:15px system-ui;color:#243c36}.softice-account-box{background:white;padding:28px;border:1px solid #dfd8ce;border-radius:20px;width:min(100%,440px)}.softice-account-box h1{font-size:24px;margin:0 0 10px}.softice-account-box p{line-height:1.5}.softice-account-box label{display:grid;gap:7px;margin:18px 0}.softice-account-box input{font:inherit;width:100%;box-sizing:border-box;border:1px solid #b4c7c0;border-radius:10px;padding:12px;min-height:44px}.softice-account-box button{font:700 15px system-ui;background:#0f766e;color:white;border:0;border-radius:10px;padding:12px 18px;min-height:44px;cursor:pointer}.softice-account-error{color:#a12c27}.softice-account-muted{color:#65776e}@media(max-width:767px){.header-actions{gap:8px!important}.softice-logout-button{padding:8px 12px;min-height:42px}.header .search{min-width:0}}`;document.head.append(s);}
function showLogin(message=''){
 if(!document.body){document.addEventListener('DOMContentLoaded',()=>showLogin(message),{once:true});return;}
 if(document.querySelector('#softice-account-login'))return;
 style();const overlay=document.createElement('section');overlay.className='softice-account-overlay';overlay.id='softice-account-login';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','softice-account-title');
 function el(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
 const box=el('div');box.className='softice-account-box';const heading=el('h1','Вход в учётную запись');heading.id='softice-account-title';const intro=el('p',message||'Введите логин и пароль администратора.');intro.className='softice-account-muted';const form=el('form');const user=el('input'),password=el('input');user.name='login';user.autocomplete='username';user.required=true;password.name='password';password.type='password';password.autocomplete='current-password';password.required=true;
 for(const [title,input]of [['Логин',user],['Пароль',password]]){const label=el('label');label.append(el('span',title),input);form.append(label);}
 const submit=el('button','Войти');submit.type='submit';const error=el('p');error.className='softice-account-error';error.setAttribute('role','alert');form.append(submit,error);
 form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;submit.textContent='Входим…';error.textContent='';try{const r=await originalFetch('/api/v1/admin/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:user.value,password:password.value})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.data?.token)throw new Error(data.error?.message||'Не удалось войти. Проверьте логин и пароль.');clearTokens();sessionStorage.setItem(KEY,data.data.token);password.value='';const url=new URL(location.href);url.searchParams.delete('login');url.searchParams.delete('signedout');location.replace(url.href);}catch(e){error.textContent=e.message||'Не удалось подключиться к серверу.';}finally{submit.disabled=false;submit.textContent='Войти';}});
 const supplierLink=el('a','Вход для инженера поставщика');supplierLink.href='/api/supplier-review/?lang=en';supplierLink.style.display='block';supplierLink.style.marginTop='20px';box.append(heading,intro,form,supplierLink);overlay.append(box);document.body.append(overlay);user.focus();
}
async function logout(){
 if(signingOut)return;signingOut=true;document.querySelectorAll('.softice-logout-button').forEach(b=>{b.disabled=true;b.textContent='Выходим…';});
 const accessToken=token();let revoked=true;
 try{if(accessToken){const r=await originalFetch('/api/v1/admin/auth/logout',{method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+accessToken}});revoked=r.ok||r.status===401;}}catch{revoked=false;}
 finally{clearTokens();const url=new URL(location.href);url.searchParams.set('login','1');url.searchParams.set('signedout',revoked?'1':'local');location.replace(url.href);}
}
window.fetch=async function(input,init={}){
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 const protectedRequest=url.origin===location.origin&&/^\/api\/v1\/(admin(?:\/|$)|organizations(?:\/|$)|service-workspace(?:\/|$))/.test(url.pathname);
 if(!protectedRequest||url.pathname==='/api/v1/admin/auth/login')return originalFetch(input,init);
 const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));const accessToken=token();if(accessToken&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+accessToken);
 const response=await originalFetch(input,{...init,headers});if(response.status===401&&!signingOut){clearTokens();showLogin('Сеанс завершён. Войдите повторно.');}return response;
};
function mount(){const host=document.querySelector('.header-actions');if(!host||host.querySelector('.softice-logout-button'))return;style();const b=document.createElement('button');b.type='button';b.className='softice-logout-button';b.textContent='Выйти';b.setAttribute('aria-label','Выйти из учётной записи');b.addEventListener('click',logout);host.append(b);}
function boot(){mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});const query=new URLSearchParams(location.search);if(query.get('login')==='1')showLogin(query.get('signedout')==='local'?'Выход на этом устройстве выполнен. Сервер не подтвердил отзыв сеанса; повторите вход при восстановлении связи.':query.has('signedout')?'Вы вышли из учётной записи. Можно войти под другим логином.':'');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
