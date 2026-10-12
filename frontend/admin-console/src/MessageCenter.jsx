import React,{useEffect,useState}from'react';
import{EmptyState,ErrorState,Skeleton,StatusBadge}from'./components';
import{getMessage,listMessages}from'./api/messageCenterClient';

const fmt=value=>value?new Date(value).toLocaleString('ru-RU'):'—';

export function MessageCenterPage(){
  const[state,setState]=useState({status:'loading',items:[],total:0});
  const[filters,setFilters]=useState({});
  const[selected,setSelected]=useState(null);

  const load=()=>listMessages(filters)
    .then(data=>setState({status:'ready',items:data.items||[],total:data.total||0}))
    .catch(error=>setState({status:error.status===403?'forbidden':'error',items:[],total:0}));

  useEffect(()=>{setState(s=>({...s,status:'loading'}));load();},[JSON.stringify(filters)]);

  const field=key=>({value:filters[key]||'',onChange:e=>setFilters({...filters,[key]:e.target.value})});

  async function openMessage(id){
    try{setSelected(await getMessage(id));}catch{setSelected(null);}
  }

  if(state.status==='loading')return <Skeleton/>;
  if(state.status!=='ready')return <ErrorState kind={state.status==='forbidden'?'denied':undefined}/>;

  return <div className="message-center-page">
    <section className="card event-filters">
      <label>Поиск<input {...field('query')} placeholder="MSG-123, получатель, тема"/></label>
      <label>Канал<select {...field('channel')}><option value="">Все</option><option>SYSTEM</option><option>MINI_APP</option><option>TELEGRAM</option><option>MAX</option><option>VK</option><option>EMAIL</option></select></label>
      <label>Статус<select {...field('status')}><option value="">Все</option><option>AVAILABLE</option><option>SENT</option><option>DELIVERED</option><option>READ</option><option>FAILED</option></select></label>
      <label>С<input type="date" {...field('from')}/></label>
      <label>По<input type="date" {...field('to')}/></label>
    </section>

    <section className="card" style={{marginBottom:12}}>
      <strong>Сообщений: {state.total}</strong>
    </section>

    {state.items.length?<div className="table-scroll card"><table>
      <thead><tr><th>№</th><th>Дата</th><th>Получатель</th><th>Тема</th><th>Источник</th><th>Каналы / статус</th></tr></thead>
      <tbody>{state.items.map(row=><tr key={row.id} onClick={()=>openMessage(row.id)} style={{cursor:'pointer'}}>
        <td>{row.number}</td>
        <td>{fmt(row.createdAt)}</td>
        <td>{row.recipientName||row.recipientId||'—'}</td>
        <td>{row.subject||'—'}</td>
        <td>{row.source||'—'}</td>
        <td>{(row.deliveries||[]).map(d=><span key={d.id} style={{marginRight:8}}>{d.channel}: <strong>{d.status}</strong></span>)}</td>
      </tr>)}</tbody>
    </table></div>:<EmptyState title="Сообщений пока нет"/>}

    {selected&&<section className="card" style={{marginTop:16}}>
      <button type="button" className="text-button" onClick={()=>setSelected(null)}>← Назад к списку сообщений</button>
      <h2 style={{marginTop:12}}>{selected.number} · {selected.subject||'Без темы'}</h2>
      <p><strong>Получатель:</strong> {selected.recipientName||selected.recipientId||'—'}</p>
      <p><strong>Источник:</strong> {selected.source||'—'} · <strong>Создано:</strong> {fmt(selected.createdAt)}</p>
      <p><strong>Текст:</strong> {selected.body||'—'}</p>
      <h3>Доставка</h3>
      {(selected.deliveries||[]).map(d=><div key={d.id} className="card" style={{marginTop:8}}>
        <strong>{d.channel}</strong> · <StatusBadge status={d.status}/><br/>
        <small>Обновлено: {fmt(d.updatedAt)} · Provider ID: {d.providerMessageId||'—'}</small>
      </div>)}
    </section>}
  </div>;
}
