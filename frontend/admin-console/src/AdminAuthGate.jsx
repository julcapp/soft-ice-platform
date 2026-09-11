import React,{createContext,useContext,useEffect,useMemo,useState}from'react';

const TOKEN_KEY='softice_admin_access_token';
const AuthContext=createContext(null);
let fetchInstalled=false;
const nativeFetch=window.fetch.bind(window);

function installAuthenticatedFetch(){
  if(fetchInstalled)return;
  fetchInstalled=true;
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const sameOrigin=url.startsWith('/')||url.startsWith(window.location.origin);
    const token=sessionStorage.getItem(TOKEN_KEY);
    if(!sameOrigin||!url.includes('/api/')||!token)return nativeFetch(input,init);
    const headers=new Headers(init.headers||(typeof input!=='string'?input.headers:undefined)||{});
    if(!headers.has('Authorization'))headers.set('Authorization',`Bearer ${token}`);
    return nativeFetch(input,{...init,headers});
  };
}
installAuthenticatedFetch();

async function api(path,options={}){
  const response=await window.fetch(path,{...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  if(response.status===204)return null;
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(body?.error?.message||'Ошибка аутентификации.'),{status:response.status,body});
  return body.data;
}

export function useAdminAuth(){return useContext(AuthContext)}

export function AdminAuthGate({children}){
  const[state,setState]=useState({status:'loading',user:null,error:''});
  useEffect(()=>{let active=true;const token=sessionStorage.getItem(TOKEN_KEY);if(!token){setState({status:'anonymous',user:null,error:''});return()=>{active=false}};api('/api/v1/admin/auth/me').then(user=>active&&setState({status:'ready',user,error:''})).catch(()=>{sessionStorage.removeItem(TOKEN_KEY);active&&setState({status:'anonymous',user:null,error:''})});return()=>{active=false}},[]);
  const value=useMemo(()=>({user:state.user,async login(login,password){setState(s=>({...s,status:'loading',error:''}));try{const data=await api('/api/v1/admin/auth/login',{method:'POST',body:JSON.stringify({login,password})});sessionStorage.setItem(TOKEN_KEY,data.token);setState({status:'ready',user:data.user,error:''});}catch(error){setState({status:'anonymous',user:null,error:error.message||'Не удалось войти.'});}},async logout(){try{await api('/api/v1/admin/auth/logout',{method:'POST'})}finally{sessionStorage.removeItem(TOKEN_KEY);setState({status:'anonymous',user:null,error:''})}}}),[state.user]);
  if(state.status==='loading')return <div className="admin-auth-screen"><div className="admin-auth-card"><strong>Soft ICE</strong><p>Проверяем административную сессию…</p></div></div>;
  if(state.status!=='ready')return <LoginForm error={state.error} onLogin={value.login}/>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LoginForm({error,onLogin}){
  const[login,setLogin]=useState('');const[password,setPassword]=useState('');const[submitting,setSubmitting]=useState(false);
  async function submit(e){e.preventDefault();setSubmitting(true);try{await onLogin(login,password)}finally{setSubmitting(false)}}
  return <div className="admin-auth-screen"><form className="admin-auth-card" onSubmit={submit} autoComplete="on"><div className="admin-auth-brand"><span>SI</span><div><strong>Soft ICE</strong><small>Защищённый вход в консоль администратора</small></div></div><h1>Вход владельца платформы</h1><p>Все входы и административные действия регистрируются в журнале аудита.</p><label>Логин<input name="username" autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} required autoFocus/></label><label>Пароль<input name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="admin-auth-error" role="alert">{error}</div>}<button type="submit" disabled={submitting}>{submitting?'Входим…':'Войти'}</button></form></div>
}
