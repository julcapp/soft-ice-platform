import React,{useEffect,useState} from 'react';
import {getOrganizations} from './api/organizationClient';
import {adminAuthHeaders} from './api/adminAuth';
const normalize=v=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
const safeDate=value=>value?new Date(value).toLocaleString('ru-RU'):'—';
export function VerificationCenter(){
 const [orgs,setOrgs]=useState([]),[organizationId,setOrganizationId]=useState('');
 const [events,setEvents]=useState([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const [channel,setChannel]=useState('ALL');
 const base='/api/v1/admin/verification/organizations/'+encodeURIComponent(organizationId)+'/verification-events';
 const request=async(url,method='GET')=>{
  const res=await fetch(url,{method,headers:adminAuthHeaders()});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(res.status===403?'Нет доступа к организации':data.error||'Сервис событий недоступен');
  return data;
 };
 useEffect(()=>{const control=new AbortController();getOrganizations({signal:control.signal}).then(v=>setOrgs(normalize(v))).catch(()=>setStatus('Организации недоступны'));return()=>control.abort()},[]);
 const refresh=async()=>{if(!organizationId)return;setBusy(true);try{
  const data=await request(base);setEvents(data.events||[]);setStatus('Журнал обновлён.');
 }catch(e){setStatus(e.message)}finally{setBusy(false)}};
 useEffect(()=>{setEvents([]);if(organizationId)refresh()},[organizationId]);
 const revoke=async event=>{if(!event.revocable||busy)return;
  if(!window.confirm('Отозвать этот запрос подтверждения? Пользователь не сможет использовать отправленный код.'))return;
  setBusy(true);try{
   await request(base+'/'+encodeURIComponent(event.id)+'/revoke','POST');
   const data=await request(base);setEvents(data.events||[]);setStatus('Запрос отозван, действие записано в журнал.');
  }catch(e){setStatus(e.message)}finally{setBusy(false)}};
 const visible=events.filter(e=>channel==='ALL'||e.channel===channel);
 return <main className="organization-workspace"><section className="card">
 <h2>Центр кодов и подтверждений</h2>
 <p>Единый журнал запросов входа и подтверждения личности. Данные собираются из уже подключённых серверных источников. Сам код доступа, его хеш и получатель в открытом виде не отображаются.</p>
 <label>Организация <select aria-label="Организация для событий" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}><option value="">Выберите организацию</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.shortName||o.fullName||o.id}</option>)}</select></label>
 <label style={{marginLeft:12}}>Канал <select aria-label="Фильтр канала" value={channel} onChange={e=>setChannel(e.target.value)}><option value="ALL">Все каналы</option><option value="MAX">MAX</option><option value="TELEGRAM">Telegram</option><option value="EMAIL">Электронная почта</option><option value="SMS">SMS</option><option value="UNKNOWN">Не определён</option></select></label>
 <button style={{marginLeft:12}} disabled={busy||!organizationId} onClick={refresh}>Обновить журнал</button>
 {status&&<p role="status">{status}</p>}
 <table><thead><tr><th>Дата</th><th>Канал</th><th>Назначение</th><th>Статус</th><th>Точка / терминал</th><th>Действие</th></tr></thead><tbody>
 {visible.map(e=><tr key={e.id+'-'+e.kind}><td>{safeDate(e.createdAt)}</td><td>{e.channel}</td><td>{e.kind}</td><td>{e.status}</td><td>{[e.pointId,e.terminalId].filter(Boolean).join(' / ')||'—'}</td><td>{e.revocable?<button disabled={busy} onClick={()=>revoke(e)}>Отозвать</button>:'—'}</td></tr>)}
 </tbody></table>
 {!visible.length&&<p>Записей нет или источник пока не подключён.</p>}
 <p>Повторная отправка требует нового серверного запроса с ограничением частоты. Просмотр действующего OTP администратором запрещён.</p>
 </section></main>;
}
