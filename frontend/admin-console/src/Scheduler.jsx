import React,{useEffect,useState}from'react';
import{EmptyState,ErrorState,Skeleton}from'./components';
import{getSchedulerTask,listSchedulerTasks}from'./api/schedulerClient';

const fmt=value=>value?new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Tomsk'}):'—';
const statusLabel=value=>({SUCCESS:'Успешно',FAILED:'Ошибка',PARTIAL_FAILURE:'Частично с ошибками',RUNNING:'Выполняется',NOT_RUN:'Ещё не запускалась'}[value]||value||'—');

export function SchedulerPage(){
  const[state,setState]=useState({status:'loading',items:[],total:0});
  const[selected,setSelected]=useState(null);

  async function load(){
    try{
      const data=await listSchedulerTasks();
      setState({status:'ready',items:data.items||[],total:data.total||0});
    }catch(error){
      setState({status:error.status===403?'forbidden':'error',items:[],total:0});
    }
  }

  useEffect(()=>{load();},[]);

  async function openTask(id){
    try{setSelected(await getSchedulerTask(id));}catch{setSelected(null);}
  }

  if(state.status==='loading')return <Skeleton/>;
  if(state.status!=='ready')return <ErrorState kind={state.status==='forbidden'?'denied':undefined}/>;

  if(selected){
    return <div className="scheduler-page">
      <section className="card scheduler-detail">
        <button type="button" className="text-button" onClick={()=>setSelected(null)}>← Назад к Планировщику</button>
        <div className="scheduler-detail-heading">
          <div>
            <p className="eyebrow">Регулярная операция</p>
            <h2>{selected.name}</h2>
          </div>
          <span className={'scheduler-status '+(selected.lastRunStatus==='SUCCESS'?'is-success':'')}>{statusLabel(selected.lastRunStatus)}</span>
        </div>
        <div className="scheduler-meta">
          <p><strong>Категория:</strong> {selected.category}</p>
          <p><strong>Источник запуска:</strong> {selected.source}</p>
          <p><strong>Unit:</strong> {selected.unit}</p>
          <p><strong>Часовой пояс:</strong> {selected.timezone}</p>
          <p><strong>Расписание:</strong> {selected.scheduleHuman}</p>
          <p><strong>Техническое расписание:</strong> <code>{selected.scheduleTechnical}</code></p>
          <p><strong>Последний запуск:</strong> {fmt(selected.lastRunAt)}</p>
          <p><strong>Следующий запуск:</strong> {fmt(selected.nextRunAt)}</p>
          <p><strong>Хранение:</strong> {selected.retention}</p>
          <p><strong>Режим:</strong> {selected.readOnly?'Только просмотр':'Управляемый'}</p>
        </div>
        <div className="scheduler-description">
          <h3>Что выполняет задача</h3>
          <p>{selected.description}</p>
        </div>
        <h3>Последний результат</h3>
        {selected.lastRunDetails?.length
          ? <div className="scheduler-results">{selected.lastRunDetails.map(row=><div key={row.section} className="card">
              <strong>{row.section}</strong>
              <span>{row.status}</span>
              {row.zip?<small>{row.zip}</small>:null}
            </div>)}</div>
          : <p>История запусков появится после первого выполнения задачи.</p>}
      </section>
    </div>;
  }

  return <div className="scheduler-page">
    <section className="card scheduler-intro">
      <div>
        <strong>Регулярных операций: {state.total}</strong>
        <p>Планировщик показывает, что система запускает автоматически и когда ожидается следующий запуск. Фактические результаты выполнения фиксируются отдельно в Центре событий.</p>
      </div>
      <span>Только просмотр</span>
    </section>

    {state.items.length?<div className="table-scroll card"><table>
      <thead><tr><th>Операция</th><th>Тип</th><th>Периодичность</th><th>Последний запуск</th><th>Результат</th><th>Следующий запуск</th><th>Источник</th><th></th></tr></thead>
      <tbody>{state.items.map(row=><tr key={row.id}>
        <td><strong>{row.name}</strong><br/><small>{row.description}</small></td>
        <td>{row.category}</td>
        <td>{row.scheduleHuman}</td>
        <td>{fmt(row.lastRunAt)}</td>
        <td><span className={'scheduler-status '+(row.lastRunStatus==='SUCCESS'?'is-success':'')}>{statusLabel(row.lastRunStatus)}</span></td>
        <td>{fmt(row.nextRunAt)}</td>
        <td>{row.source}</td>
        <td><button type="button" className="text-button" onClick={()=>openTask(row.id)}>Открыть</button></td>
      </tr>)}</tbody>
    </table></div>:<EmptyState title="Регулярных операций пока нет"/>}
  </div>;
}

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]