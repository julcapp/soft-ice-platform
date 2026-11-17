import React,{useEffect,useState} from 'react';
import {TimoPosPointEditor} from './TimoPosPointEditor';
import {getOrganizations,getOrganizationMembers} from './api/organizationClient';
import {adminAuthHeaders} from './api/adminAuth';

const toArray=v=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:Array.isArray(v?.data)?v.data:[];
const safeId=id=>encodeURIComponent(String(id||''));
async function request(path,{signal,method='GET',body}={}){
 const res=await fetch('/api/v1/admin/timopos'+path,{method,signal,headers:{...adminAuthHeaders(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(res.status===404?'API управления TimoPOS ещё не подключён на сервере.':res.status===403?'Недостаточно прав администратора.':'Не удалось выполнить операцию.'),{status:res.status});
 return res.json();
}
export function TimoPosWorkstationsPage(){
 const [organizations,setOrganizations]=useState([]);
 const [organizationId,setOrganizationId]=useState('');
 const [state,setState]=useState({loading:false,points:[],members:[],terminals:[],assignments:[],error:''});
 const [selectedPoint,setSelectedPoint]=useState('');
 const [sellerId,setSellerId]=useState('');
 const [terminalId,setTerminalId]=useState('POS-001');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{const controller=new AbortController();getOrganizations({signal:controller.signal}).then(list=>setOrganizations(toArray(list))).catch(()=>setState(s=>({...s,error:'Не удалось получить список организаций или недостаточно прав.'})));return()=>controller.abort()},[]);
 useEffect(()=>{if(!organizationId)return;const controller=new AbortController();setState(s=>({...s,loading:true,error:''}));Promise.all([
  request('/organizations/'+safeId(organizationId)+'/points',{signal:controller.signal}),
  getOrganizationMembers(organizationId,{signal:controller.signal}),
 ]).then(([data,members])=>{setState({loading:false,points:data.points||[],terminals:data.terminals||[],assignments:data.assignments||[],members:toArray(members),error:''});setSelectedPoint('');setSellerId('')}).catch(e=>{if(e.name!=='AbortError')setState(s=>({...s,loading:false,error:e.message}))});return()=>controller.abort()},[organizationId]);
 const refresh=async()=>{const d=await request('/organizations/'+safeId(organizationId)+'/points');setState(s=>({...s,points:d.points||[],terminals:d.terminals||[],assignments:d.assignments||[]}));};
 const registerTerminal=async()=>{if(!organizationId||!selectedPoint||!terminalId.trim())return;setBusy(true);try{
 await request('/organizations/'+safeId(organizationId)+'/points/'+safeId(selectedPoint)+'/terminals',{method:'POST',body:{terminalId:terminalId.trim()}});
 await refresh();
 }catch(e){setState(s=>({...s,error:e.message}))}finally{setBusy(false)}};
 const assign=async active=>{if(!organizationId||!selectedPoint||!sellerId)return;setBusy(true);try{
  await request('/organizations/'+safeId(organizationId)+'/points/'+safeId(selectedPoint)+'/sellers/'+safeId(sellerId),{method:'PUT',body:{active}});
  await refresh();
 }catch(e){setState(s=>({...s,error:e.message}))}finally{setBusy(false)}};
 return <main className="organization-workspace">
 <section className="card"><h2>TimoPOS · Точки и продавцы</h2><p>Здесь назначаются продавцы на конкретные торговые точки. Вход через MAX дополнительно требует подтверждённой привязки MAX и активной учётной записи.</p>
 <label htmlFor="pos-org">Организация</label>{' '}
 <select id="pos-org" aria-label="Организация" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}><option value="">Выберите организацию</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.shortName||o.fullName||o.id}</option>)}</select>
 {state.loading&&<p>Загрузка…</p>}
 {state.error&&<p role="alert">{state.error}</p>}
 {organizationId&&!state.loading&&!state.error&&<><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:16}}>
  <label>Торговая точка<br/><select aria-label="Торговая точка" value={selectedPoint} onChange={e=>setSelectedPoint(e.target.value)}><option value="">Выберите точку</option>{state.points.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label>
  <label>Продавец<br/><select aria-label="Продавец" value={sellerId} onChange={e=>setSellerId(e.target.value)}><option value="">Выберите сотрудника</option>{state.members.map(m=><option key={m.id} value={m.id}>{m.fullName||m.id}</option>)}</select></label>
 </div><div style={{display:'flex',gap:10,marginTop:15}}>
  <button disabled={busy||!selectedPoint||!sellerId} onClick={()=>assign(true)}>Назначить продавца</button>
  <button disabled={busy||!selectedPoint||!sellerId} onClick={()=>assign(false)}>Отозвать назначение</button>
 </div>
 <div style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap',marginTop:16}}><label>Идентификатор терминала<br/><input aria-label="Идентификатор терминала" value={terminalId} onChange={e=>setTerminalId(e.target.value)} maxLength={64}/></label><button disabled={busy||!selectedPoint||!terminalId.trim()} onClick={registerTerminal}>Зарегистрировать терминал</button></div>
 <p>Активных назначений: {state.assignments.filter(a=>a.active).length}. Терминалов: {state.terminals.length}.</p>
 <table><thead><tr><th>Точка</th><th>Терминал</th><th>Назначения продавцов</th></tr></thead><tbody>{state.points.map(p=><tr key={p.id}><td>{p.name}</td><td>{state.terminals.filter(t=>t.pointId===p.id).map(t=>t.terminalId).join(', ')||'Не зарегистрирован'}</td><td>{state.assignments.filter(a=>a.pointId===p.id&&a.active).map(a=>state.members.find(m=>m.id===a.sellerId)?.fullName||a.sellerId).join(', ')||'Не назначены'}</td></tr>)}</tbody></table>
 </>}
 </section>{organizationId&&<TimoPosPointEditor organizationId={organizationId} onUpdated={refresh} points={state.points} selectedPointId={selectedPoint}/>}
 <section className="card"><h3>Проверки перед допуском к кассе</h3><p>Активная организация → действующая роль OPERATOR → назначение на точку → зарегистрированный терминал → проверенный MAX → код входа → открытая смена.</p><p>Сама кнопка назначения не создаёт MAX-привязку и не разрешает платежи.</p></section>
 </main>;
}
