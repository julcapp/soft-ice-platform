import React,{useEffect,useState} from 'react';
import {adminAuthHeaders} from './api/adminAuth';

const DAYS=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const newSchedule=()=>({mode:'24_7',timeZone:'Asia/Tomsk',days:{}});
function fromSchedule(value){
 const s=value&&typeof value==='object'?value:newSchedule();
 return {mode:s.mode==='SCHEDULED'?'SCHEDULED':'24_7',timeZone:s.timeZone||'Asia/Tomsk',
  windows:DAYS.map((_,i)=>({enabled:s.mode==='24_7'||!!s.days?.[i]?.length,
   from:s.days?.[i]?.[0]?.from||'09:00',to:s.days?.[i]?.[0]?.to||'18:00'}))};
}
function toSchedule(s){
 if(s.mode==='24_7')return {mode:'24_7',timeZone:s.timeZone,days:{}};
 return {mode:'SCHEDULED',timeZone:s.timeZone,
   days:Object.fromEntries(s.windows.map((x,i)=>[String(i),x.enabled?[{from:x.from,to:x.to}]:[]]))};
}
function ScheduleEditor({value,onChange}){
 const schedule=value;
 return <div style={{border:'1px solid #ded6e7',borderRadius:10,padding:12,margin:'12px 0'}}>
 <label>Режим работы <select aria-label="Режим работы" value={schedule.mode} onChange={e=>onChange({...schedule,mode:e.target.value})}>
 <option value="24_7">Круглосуточно · 24/7</option><option value="SCHEDULED">По расписанию</option>
 </select></label>
 <label style={{marginLeft:12}}>Часовой пояс <input aria-label="Часовой пояс" value={schedule.timeZone}
 onChange={e=>onChange({...schedule,timeZone:e.target.value})} placeholder="Asia/Tomsk"/></label>
 {schedule.mode==='SCHEDULED'&&<div style={{marginTop:12}}>
 {DAYS.map((day,index)=><div key={day} style={{display:'flex',alignItems:'center',gap:9,padding:'5px 0'}}>
 <label style={{minWidth:55}}><input type="checkbox" aria-label={day+' работает'} checked={schedule.windows[index].enabled}
 onChange={e=>onChange({...schedule,windows:schedule.windows.map((v,i)=>i===index?{...v,enabled:e.target.checked}:v)})}/> {day}</label>
 <input type="time" aria-label={day+' начало'} disabled={!schedule.windows[index].enabled} value={schedule.windows[index].from}
 onChange={e=>onChange({...schedule,windows:schedule.windows.map((v,i)=>i===index?{...v,from:e.target.value}:v)})}/>
 <input type="time" aria-label={day+' конец'} disabled={!schedule.windows[index].enabled} value={schedule.windows[index].to}
 onChange={e=>onChange({...schedule,windows:schedule.windows.map((v,i)=>i===index?{...v,to:e.target.value}:v)})}/>
 </div>)}
 <small>Если смена пересекает полночь, её следует разделить на два дня. Для нескольких интервалов потребуется расширенный редактор.</small>
 </div>}
 </div>;
}
export function TimoPosPointEditor({organizationId,onUpdated,points=[],selectedPointId=''}){
 const [title,setTitle]=useState('');const [address,setAddress]=useState('');
 const [schedule,setSchedule]=useState(()=>fromSchedule(newSchedule()));
 const [edit,setEdit]=useState(null);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const [seller,setSeller]=useState({fullName:'',phone:''});
 const [pointId,setPointId]=useState('');
 useEffect(()=>{const item=points.find(p=>p.id===selectedPointId);setEdit(item?{...item,schedule:fromSchedule(item.openingHours)}:null);setPointId(selectedPointId||'')},[selectedPointId,points]);
 const call=async(path,method,body)=>{
  const res=await fetch('/api/v1/admin/timopos/organizations/'+encodeURIComponent(organizationId)+path,{
   method,headers:{...adminAuthHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Ошибка записи в серверную базу');
  return data;
 };
 const run=async(callback,success)=>{setBusy(true);setNotice('Сохранение…');try{await callback();setNotice(success);await onUpdated()}catch(e){setNotice('Ошибка: '+e.message)}finally{setBusy(false)}};
 const selected=edit;
 return <section className="card">
 <h3>Операторы · управление точками продаж</h3>
 <p>Изначально создаются пять точек №001–005 с режимом 24/7. Повторная инициализация не создаёт дубликатов.</p>
 <button disabled={busy||!organizationId} onClick={()=>run(()=>call('/points/initialize','POST'), 'Стартовые точки проверены и созданы при необходимости.')}>Создать стартовые пять точек</button>
 <div style={{display:'grid',gap:10,marginTop:18}}>
 <h3>Создать новую точку</h3>
 <label>Название <input aria-label="Название новой точки" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Точка продаж №006"/></label>
 <label>Адрес <input aria-label="Адрес новой точки" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Заполнить после определения адреса"/></label>
 <ScheduleEditor value={schedule} onChange={setSchedule}/>
 <button disabled={busy||title.trim().length<3} onClick={()=>run(()=>call('/points','POST',{name:title.trim(),address:address.trim()||'Адрес не указан',openingHours:toSchedule(schedule)}),'Точка добавлена.')}>Добавить точку</button>
 </div>
 <div style={{marginTop:20}}>
 <h3>Редактировать существующую точку</h3>
 <p>Выберите точку в списке выше — здесь можно изменить название, адрес и режим работы.</p>
 {selected&&<><p><strong>{selected.name}</strong></p>
 <label>Название <input aria-label="Название редактируемой точки" value={selected.name} onChange={e=>setEdit({...selected,name:e.target.value})}/></label>
 <label>Адрес <input aria-label="Адрес редактируемой точки" value={selected.address||''} onChange={e=>setEdit({...selected,address:e.target.value})}/></label>
 <ScheduleEditor value={selected.schedule} onChange={v=>setEdit({...selected,schedule:v})}/>
 <button disabled={busy} onClick={()=>run(()=>call('/points/'+encodeURIComponent(selected.id),'PATCH',{
  name:selected.name,address:selected.address||'Адрес не указан',openingHours:toSchedule(selected.schedule)
 }),'Настройки точки сохранены.')}>Сохранить изменения точки</button>
 </>}
 </div>
 <div style={{marginTop:20}}>
 <h3>Создать продавца и назначить на точку</h3>
 <p>ФИО и телефон вводятся в защищённой админпанели. Подтверждение номера в MAX проводится отдельно.</p>
 <label>ФИО <input aria-label="ФИО нового продавца" autoComplete="off" value={seller.fullName} onChange={e=>setSeller({...seller,fullName:e.target.value})}/></label>
 <label>Телефон <input aria-label="Телефон нового продавца" type="tel" autoComplete="off" value={seller.phone} onChange={e=>setSeller({...seller,phone:e.target.value})}/></label>
 <label>Точка назначения <select aria-label="Точка назначения продавца" value={pointId} onChange={e=>setPointId(e.target.value)}><option value="">Выберите точку</option>{points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <button disabled={busy||!pointId||seller.fullName.length<5||seller.phone.length<11} onClick={()=>run(async()=>{
  await call('/points/'+encodeURIComponent(pointId)+'/sellers','POST',seller);
  setSeller({fullName:'',phone:''});
 },'Продавец создан и назначен, теперь требуется подтверждение MAX.')}>Зарегистрировать продавца</button>
 </div>
 {notice&&<p role="status">{notice}</p>}
 </section>;
}
export {fromSchedule,toSchedule};
