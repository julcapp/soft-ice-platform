import React,{useEffect,useMemo,useState}from'react';
import{EmptyState,ErrorState,Skeleton,StatusBadge}from'./components';
import{createPaymentRefund,getPayment,listPayments,refreshPaymentRefund}from'./api/paymentClient';

const statuses=['CREATED','PENDING','AUTHORIZED','SUCCEEDED','FAILED','CANCELED','REFUND_PENDING','REFUNDED'];
const money=(value,currency='RUB')=>value==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency}).format(Number(value));
const dateTime=(value)=>value?new Date(value).toLocaleString('ru-RU'):'—';
const channelLabel=(value)=>({TERMINAL:'Аппарат',WEB:'Сайт',MINIAPP:'Mini App'}[value]||value||'—');
const methodLabel=(value)=>({sbp:'СБП',bank_card:'Банковская карта'}[String(value||'').toLowerCase()]||value||'—');

export function PaymentsPage({
  client=listPayments,
  detailClient=getPayment,
  refundClient=createPaymentRefund,
  refreshRefundClient=refreshPaymentRefund,
}){
  const[state,setState]=useState({status:'loading',items:[]});
  const[filters,setFilters]=useState({});
  const[selected,setSelected]=useState(null);
  const[refund,setRefund]=useState({amount:'',reason:'',status:'idle',message:''});

  const reload=()=>client(filters).then(items=>setState({status:'ready',items})).catch(error=>setState({status:error.status===403?'forbidden':'error',items:[]}));
  useEffect(()=>{setState(s=>({...s,status:'loading'}));reload();},[client,JSON.stringify(filters)]);

  const summary=useMemo(()=>{
    const rows=state.items||[];
    return rows.reduce((acc,p)=>{
      acc.count+=1;
      if(p.status==='SUCCEEDED'||p.status==='REFUND_PENDING'||p.status==='REFUNDED')acc.gross+=Number(p.amount||0);
      acc.providerCost+=Number(p.economics?.providerCostTotalRub||0);
      acc.net+=Number(p.economics?.netSettlementRub||0);
      acc.refunded+=Number(p.refundSummary?.succeededAmount||0);
      return acc;
    },{count:0,gross:0,providerCost:0,net:0,refunded:0});
  },[state.items]);

  async function openPayment(payment){
    try{
      const detail=await detailClient(payment.id);
      setSelected(detail);
      setRefund({amount:String(detail.refundSummary?.availableAmount||''),reason:'',status:'idle',message:''});
    }catch(error){
      setRefund({amount:'',reason:'',status:'error',message:error.message||'Не удалось загрузить платёж.'});
    }
  }

  async function submitRefund(){
    const amount=Number(refund.amount);
    const available=Number(selected?.refundSummary?.availableAmount||0);
    if(!selected||!(amount>0)||amount>available||refund.reason.trim().length<3)return;
    setRefund(s=>({...s,status:'sending',message:''}));
    try{
      const result=await refundClient(selected.id,{amount,reason:refund.reason.trim()},{idempotencyKey:`admin-refund:${selected.id}:${amount.toFixed(2)}:${Date.now()}`});
      const detail=await detailClient(selected.id);
      setSelected(detail);
      setRefund({amount:String(detail.refundSummary?.availableAmount||''),reason:'',status:'success',message:result.status==='SUCCEEDED'?'Возврат подтверждён ЮKassa.':'Возврат создан и проверяется.'});
      await reload();
    }catch(error){
      setRefund(s=>({...s,status:'error',message:error.message||'Возврат не выполнен.'}));
    }
  }

  async function refreshRefund(row){
    try{
      await refreshRefundClient(row.id);
      const detail=await detailClient(selected.id);
      setSelected(detail);
      await reload();
    }catch(error){
      setRefund(s=>({...s,status:'error',message:error.message||'Не удалось обновить статус возврата.'}));
    }
  }

  if(state.status==='loading')return <Skeleton/>;
  if(state.status!=='ready')return <ErrorState kind={state.status==='forbidden'?'denied':undefined}/>;
  const field=k=>({value:filters[k]||'',onChange:e=>setFilters({...filters,[k]:e.target.value})});

  return <div className="payments-page">
    <section className="statistics">
      <div className="stat-card"><span>Операций</span><strong>{summary.count}</strong></div>
      <div className="stat-card"><span>Принято</span><strong>{money(summary.gross)}</strong></div>
      <div className="stat-card"><span>Расходы ЮKassa</span><strong>{money(summary.providerCost)}</strong></div>
      <div className="stat-card"><span>К зачислению</span><strong>{money(summary.net)}</strong></div>
      <div className="stat-card"><span>Возвращено</span><strong>{money(summary.refunded)}</strong></div>
    </section>

    <section className="card event-filters">
      <label>Организация<input {...field('organizationId')}/></label>
      <label>Статус<select {...field('status')}><option value="">Все</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Провайдер<input {...field('provider')}/></label>
      <label>С<input type="datetime-local" {...field('dateFrom')}/></label>
      <label>По<input type="datetime-local" {...field('dateTo')}/></label>
    </section>

    {state.items.length?<div className="table-scroll card"><table>
      <thead><tr>{['Дата','Канал','Покупатель','Аппарат / точка','Заказ','Статус','Сумма','Комиссия + НДС','К зачислению','Возвращено','Доступно','Действие'].map(x=><th key={x}>{x}</th>)}</tr></thead>
      <tbody>{state.items.map(p=><tr key={p.id}>
        <td>{dateTime(p.succeededAt||p.createdAt)}</td>
        <td>{channelLabel(p.channel)}</td>
        <td>{p.customerDisplay||p.phoneMasked||p.customerId||'Без идентификации'}</td>
        <td>{p.machineId||'—'}{p.locationId?<><br/><small>{p.locationId}</small></>:null}</td>
        <td><code>{p.orderId}</code><br/><small>{methodLabel(p.paymentMethodType)}</small></td>
        <td><StatusBadge status={p.status}/><br/><small>{p.reconciliationStatus}</small></td>
        <td>{money(p.amount,p.currency)}</td>
        <td>{money(p.economics?.providerCostTotalRub,p.currency)}{p.economics?.final?<><br/><small>по реестру</small></>:<><br/><small>предварительно</small></>}</td>
        <td>{money(p.economics?.netSettlementRub,p.currency)}</td>
        <td>{money(p.refundSummary?.succeededAmount,p.currency)}</td>
        <td>{money(p.refundSummary?.availableAmount,p.currency)}</td>
        <td><button type="button" onClick={()=>openPayment(p)}>Открыть</button></td>
      </tr>)}</tbody>
    </table></div>:<EmptyState title="Платежи не найдены"/>}

    {selected&&<section className="card" style={{marginTop:16}}>
      <div className="card-heading"><div><h2>Платёж {selected.id}</h2><p style={{margin:'6px 0 0'}}>Заказ {selected.orderId} · {channelLabel(selected.channel)} · {selected.provider}</p></div><StatusBadge status={selected.status}/></div>
      <div className="statistics">
        <div className="stat-card"><span>Сумма</span><strong>{money(selected.amount,selected.currency)}</strong></div>
        <div className="stat-card"><span>Комиссия ЮKassa</span><strong>{money(selected.economics?.providerCommissionRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>НДС на комиссию</span><strong>{money(selected.economics?.providerCommissionVatRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>Всего расходов</span><strong>{money(selected.economics?.providerCostTotalRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>К зачислению</span><strong>{money(selected.economics?.netSettlementRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>Доступно вернуть</span><strong>{money(selected.refundSummary?.availableAmount,selected.currency)}</strong></div>
      </div>
      <p><strong>Provider reference:</strong> {selected.providerReference||'—'} · <strong>Создан:</strong> {dateTime(selected.createdAt)} · <strong>Оплачен:</strong> {dateTime(selected.succeededAt)}</p>

      <h3>Возвраты</h3>
      {selected.refunds?.length?<div className="table-scroll"><table><thead><tr><th>Дата</th><th>Сумма</th><th>Причина</th><th>Статус</th><th>ЮKassa</th><th></th></tr></thead><tbody>{selected.refunds.map(row=><tr key={row.id}>
        <td>{dateTime(row.requestedAt)}</td><td>{money(row.amount,row.currency)}</td><td>{row.reason}</td><td><StatusBadge status={row.status}/></td><td>{row.providerRefundId||'—'}</td>
        <td>{['REQUESTED','PENDING'].includes(row.status)?<button type="button" onClick={()=>refreshRefund(row)}>Проверить статус</button>:null}</td>
      </tr>)}</tbody></table></div>:<p>Возвратов по платежу нет.</p>}

      {selected.refundSummary?.refundable&&!selected.refundSummary?.hasPending?<div style={{display:'grid',gap:10,maxWidth:520,marginTop:16}}>
        <h3>Оформить возврат</h3>
        <label>Сумма возврата<input type="number" min="1" step="0.01" max={selected.refundSummary.availableAmount} value={refund.amount} onChange={e=>setRefund({...refund,amount:e.target.value})}/></label>
        <small>Максимально доступно: {money(selected.refundSummary.availableAmount,selected.currency)}</small>
        <label>Причина<textarea rows={3} value={refund.reason} onChange={e=>setRefund({...refund,reason:e.target.value})} placeholder="Укажите причину возврата"/></label>
        <button type="button" disabled={refund.status==='sending'||!(Number(refund.amount)>0)||Number(refund.amount)>Number(selected.refundSummary.availableAmount)||refund.reason.trim().length<3} onClick={submitRefund}>{refund.status==='sending'?'Отправляем в ЮKassa…':'Произвести возврат'}</button>
      </div>:selected.refundSummary?.hasPending?<p><strong>Новый возврат недоступен:</strong> предыдущий возврат ещё проверяется.</p>:null}
      {refund.message&&<p role="status"><strong>{refund.message}</strong></p>}
    </section>}
  </div>;
}
