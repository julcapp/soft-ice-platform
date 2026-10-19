import React, { useEffect, useState } from 'react';
import { messageCenterClient } from './api/messageCenterClient';
import { EmptyState, Skeleton } from './components';
import './message-center.css';
export const messageStatuses = { QUEUED:'В очереди',SENDING:'Отправляется',SENT:'Отправлено',DELIVERED:'Доставлено',READ:'Прочитано',FAILED:'Ошибка',UNAVAILABLE:'Канал недоступен',BLOCKED:'Заблокировано',ACCEPTED:'Принято сервисом',AVAILABLE:'Доступно в личном кабинете',UNKNOWN:'Статус не подтверждён' };
const types = { CUSTOMER:'Покупатель',TEAM:'Сотрудник проекта',ADMIN:'Администратор',CHANNEL:'Аудитория канала',PARTICIPANT:'Участник проекта' };
const sources = { CLUB_TEST_TOPUP:'Тестовое пополнение клуба', CRM:'CRM / служебные сообщения',BOT:'Ответ бота',GIFT:'Подарки',SECURITY:'Безопасность',PROMOTION:'Акции',INBOX:'Личный кабинет' };
const roles = { SERVICE_SPECIALIST:'Техник',MACHINE_RESPONSIBLE:'Мастер',OWNER:'Владелец организации',ADMINISTRATOR:'Администратор организации' };
const time = value => value ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Tomsk'}).format(new Date(value)) : '—';
function Status({ value }) { return <span className={`message-status message-status-${value?.toLowerCase()}`}>{messageStatuses[value] || 'Статус не подтверждён'}</span>; }
export function MessageCenterPage({ route = 'message-center', client = messageCenterClient }) {
  const id = route.slice('message-center/'.length);
  return route.startsWith('message-center/') ? <MessageCard key={id} id={decodeURIComponent(id)} client={client}/> : <MessageList client={client}/>;
}
export function MessageList({ client }) {
  const [state,setState] = useState({status:'loading'}), [query,setQuery] = useState('');
  const [filters,setFilters] = useState({query:'',channel:'',status:'',from:'',to:'',offset:0,limit:50});
  const [refresh,setRefresh] = useState(0);
  useEffect(()=>{const controller=new AbortController();setState({status:'loading'});client.list(filters,{signal:controller.signal}).then(data=>setState({status:'ready',data})).catch(error=>{if(error.name!=='AbortError')setState({status:'error',error});});return()=>controller.abort();},[filters,refresh,client]);
  const change = (key,value) => setFilters(current=>({...current,[key]:value,offset:0}));
  return <div className="message-center"><section className="card message-filters">
    <form onSubmit={event=>{event.preventDefault();change('query',query);}}><label>Номер, получатель или текст<input aria-label="Поиск сообщений" value={query} onChange={event=>setQuery(event.target.value)} placeholder="MSG-123, имя, текст"/></label><button type="submit">Найти</button></form>
    <label>Канал<select aria-label="Канал сообщения" value={filters.channel} onChange={event=>change('channel',event.target.value)}><option value="">Все каналы</option>{['TELEGRAM','MAX','VK','EMAIL','SMS','MINI_APP','WEB'].map(channel=><option key={channel}>{channel}</option>)}</select></label>
    <label>Статус<select aria-label="Статус сообщения" value={filters.status} onChange={event=>change('status',event.target.value)}><option value="">Все статусы</option>{Object.entries(messageStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>С даты<input type="date" value={filters.from} onChange={event=>change('from',event.target.value)}/></label><label>По дату<input type="date" value={filters.to} onChange={event=>change('to',event.target.value)}/></label><button onClick={()=>setRefresh(v=>v+1)}>Обновить</button>
  </section><p>Время — Томск. «Отправлено» означает принятие каналом. «Доставлено» — отдельное подтверждение доставки.</p>
    {state.status==='loading' && <Skeleton/>}{state.status==='error' && <p className="card" role="alert">{state.error.message}</p>}
    {state.status==='ready' && <section className="card"><div className="card-heading"><h2>Сообщения</h2><span>Найдено: {state.data.total}</span></div>{!state.data.items.length ? <EmptyState title="Сообщений по выбранным условиям нет" message="Новые сообщения появятся здесь при работе подключённых механизмов отправки."/> : <div className="table-scroll"><table><thead><tr><th>Номер / тема</th><th>Получатель</th><th>Каналы и статусы</th><th>Создано</th><th>Время отправки</th></tr></thead><tbody>{state.data.items.map(message=><tr key={message.id}><td><a href={`#message-center/${encodeURIComponent(message.id)}`}>{message.number}</a><div>{message.subject || sources[message.source] || 'Сообщение'}</div></td><td>{message.recipientName}<small>{types[message.recipientType]}{message.recipientRoles?.length ? ` · ${message.recipientRoles.map(role=>roles[role]||role).join(', ')}` : ''}</small></td><td>{message.deliveries.map(delivery=><div key={delivery.id}>{delivery.channel} · <Status value={delivery.status}/></div>)}</td><td>{time(message.createdAt)}</td><td>{message.deliveries.map(delivery=><div key={delivery.id}>{delivery.channel}: {time(delivery.sentAt)}</div>)}</td></tr>)}</tbody></table></div>}<div className="message-pagination"><button disabled={!filters.offset} onClick={()=>setFilters(current=>({...current,offset:Math.max(0,current.offset-50)}))}>Назад</button><span>{state.data.total ? filters.offset+1 : 0}–{Math.min(filters.offset+50,state.data.total)} из {state.data.total}</span><button disabled={filters.offset+50>=state.data.total} onClick={()=>setFilters(current=>({...current,offset:current.offset+50}))}>Далее</button></div></section>}
  </div>;
}
export function MessageCard({ id, client }) {
  const [state,setState]=useState({status:'loading'});
  useEffect(()=>{const controller=new AbortController();client.get(id,{signal:controller.signal}).then(data=>setState({status:'ready',data})).catch(error=>{if(error.name!=='AbortError')setState({status:'error',error});});return()=>controller.abort();},[id,client]);
  if(state.status==='loading')return <Skeleton/>;
  if(state.status==='error')return <p role="alert" className="card">{state.error.message}</p>;
  const message=state.data;
  return <div className="message-center"><a href="#message-center">← К списку сообщений</a><section className="card"><h2>{message.number} · {message.subject || 'Сообщение'}</h2><dl><dt>Получатель</dt><dd>{message.recipientName} · {types[message.recipientType]}</dd><dt>Отправитель</dt><dd>{message.sender}</dd><dt>Источник</dt><dd>{sources[message.source] || 'Сервер'}</dd><dt>Создано</dt><dd>{time(message.createdAt)}</dd>{message.correlationId && <><dt>Связанная операция</dt><dd>{message.correlationId}</dd></>}</dl><h3>Текст сообщения</h3><div className="message-body">{message.body ?? 'Текст этого исторического сообщения ранее не сохранялся.'}</div>{message.redacted && <p>Код подтверждения скрыт и не сохраняется в журнале.</p>}</section>
    <section className="card"><h2>Доставка по каналам</h2>{message.deliveries.map(delivery=><article className="message-delivery" key={delivery.id}><h3>{delivery.channel} · <Status value={delivery.status}/></h3>{delivery.recipientAddress && <p>Адрес получателя: {delivery.recipientAddress}</p>}<p>Отправлено: {time(delivery.sentAt)} · Доставлено: {time(delivery.deliveredAt)} · Прочитано: {time(delivery.readAt)}</p><p>Последнее обновление: {time(delivery.updatedAt)}</p>{delivery.providerMessageId && <p>Идентификатор канала: {delivery.providerMessageId}</p>}{(delivery.failureCode || delivery.failureMessage) && <p role="status">Причина: {delivery.failureMessage || delivery.failureCode}</p>}<h4>История фиксации статусов</h4><ol>{message.history.filter(entry=>entry.deliveryId===delivery.id).map(entry=><li key={entry.id}>{time(entry.occurredAt)} · <Status value={entry.status}/>{entry.failureCode && ` · ${entry.failureCode}`}</li>)}</ol></article>)}</section>
  </div>;
}
