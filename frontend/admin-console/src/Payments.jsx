import React,{useEffect,useMemo,useState}from'react';
import{EmptyState,ErrorState,Skeleton,StatusBadge}from'./components';
import{createPaymentRefund,getPayment,listPayments,refreshPaymentRefund}from'./api/paymentClient';
import{getOrganizations}from'./api/organizationClient';

const statuses=['CREATED','PENDING','AUTHORIZED','SUCCEEDED','FAILED','CANCELED','REFUND_PENDING','REFUNDED'];

const statusLabels={
  CREATED:'Создан',
  PENDING:'Ожидает оплаты',
  AUTHORIZED:'Авторизован',
  SUCCEEDED:'Оплачен',
  FAILED:'Ошибка',
  CANCELED:'Отменён',
  REFUND_PENDING:'Возврат выполняется',
  REFUNDED:'Возвращён',
  REQUESTED:'Запрошен',
};

const refundStatusLabels={
  NONE:'Нет возврата',
  REQUESTED:'Возврат запрошен',
  PENDING:'Возврат выполняется',
  SUCCEEDED:'Возврат выполнен',
  FAILED:'Ошибка возврата',
  CANCELED:'Возврат отменён',
};

const providerLabels={
  YOOKASSA:'ЮKassa',
  SBERBANK:'СберБанк',
  VTB:'ВТБ',
};

const money=(value,currency='RUB')=>value==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency}).format(Number(value));
const dateTime=(value)=>value?new Date(value).toLocaleString('ru-RU'):'—';
const channelLabel=(value)=>({TERMINAL:'Терминал',WEB:'Сайт',MINIAPP:'Mini App'}[value]||value||'—');
const methodLabel=(value)=>({sbp:'СБП',bank_card:'Банковская карта'}[String(value||'').toLowerCase()]||value||'—');
const providerLabel=(value)=>providerLabels[String(value||'').toUpperCase()]||value||'—';
const paymentStatusLabel=(value)=>statusLabels[value]||value||'—';

function refundInfo(payment){
  const succeeded=Number(payment.refundSummary?.succeededAmount||0);
  const available=Number(payment.refundSummary?.availableAmount??payment.amount??0);
  const total=Number(payment.amount||0);
  if(payment.status==='REFUNDED'||succeeded>=total&&total>0){
    return{type:'Полный',status:'SUCCEEDED',amount:succeeded||total};
  }
  if(payment.status==='REFUND_PENDING'||payment.refundSummary?.hasPending){
    return{type:succeeded>0?'Частичный':'Полный',status:'PENDING',amount:succeeded};
  }
  if(succeeded>0){
    return{type:succeeded<total?'Частичный':'Полный',status:'SUCCEEDED',amount:succeeded};
  }
  return{type:'—',status:'NONE',amount:0,available};
}

export function PaymentsPage({
  client=listPayments,
  detailClient=getPayment,
  refundClient=createPaymentRefund,
  refreshRefundClient=refreshPaymentRefund,
  organizationsClient=getOrganizations,
}){
  const[state,setState]=useState({status:'loading',items:[]});
  const[filters,setFilters]=useState({});
  const[organizations,setOrganizations]=useState([]);
  const[selected,setSelected]=useState(null);
  const[selectedId,setSelectedId]=useState(null);
  const[refund,setRefund]=useState({amount:'',reason:'',confirmed:false,status:'idle',message:''});

  const reload=()=>client(filters).then(items=>setState({status:'ready',items})).catch(error=>setState({status:error.status===403?'forbidden':'error',items:[]}));

  useEffect(()=>{
    const controller=new AbortController();
    organizationsClient({signal:controller.signal})
      .then(items=>{
        const list=Array.isArray(items)?items:[];
        setOrganizations(list);
        if(!filters.organizationId&&list.length){
          const preferred=list.find(item=>item.status==='ACTIVE')||list[0];
          setFilters(current=>({...current,organizationId:preferred.id}));
        }
      })
      .catch(()=>setOrganizations([]));
    return()=>controller.abort();
  },[organizationsClient]);

  useEffect(()=>{setState(s=>({...s,status:'loading'}));reload();},[client,JSON.stringify(filters)]);

  const providers=useMemo(()=>Array.from(new Set((state.items||[]).map(item=>item.provider).filter(Boolean))),[state.items]);

  const summary=useMemo(()=>(
    (state.items||[]).reduce((acc,p)=>{
      acc.count+=1;
      if(['SUCCEEDED','REFUND_PENDING','REFUNDED'].includes(p.status))acc.gross+=Number(p.amount||0);
      acc.providerCost+=Number(p.economics?.providerCostTotalRub||0);
      acc.net+=Number(p.economics?.netSettlementRub||0);
      acc.refunded+=Number(p.refundSummary?.succeededAmount||0);
      return acc;
    },{count:0,gross:0,providerCost:0,net:0,refunded:0})
  ),[state.items]);

  async function openPayment(payment,{scroll=false}={}){
    try{
      const detail=await detailClient(payment.id);
      setSelected(detail);
      setSelectedId(payment.id);
      setRefund({amount:String(detail.refundSummary?.availableAmount||''),reason:'',confirmed:false,status:'idle',message:''});
      if(scroll)setTimeout(()=>document.getElementById('payment-refund-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
    }catch(error){
      setRefund({amount:'',reason:'',confirmed:false,status:'error',message:error.message||'Не удалось загрузить карточку платежа.'});
    }
  }

  function toggleRow(payment){
    if(selectedId===payment.id){
      setSelectedId(null);
      setSelected(null);
      setRefund({amount:'',reason:'',confirmed:false,status:'idle',message:''});
      return;
    }
    openPayment(payment);
  }

  async function submitRefund(){
    const amount=Number(refund.amount);
    const available=Number(selected?.refundSummary?.availableAmount||0);
    const originalAmount=Number(selected?.amount||0);
    const fullOriginalRefund=amount===originalAmount&&available===originalAmount;
    if(!selected||!(amount>0)||amount>available||!fullOriginalRefund||refund.reason.trim().length<3||!refund.confirmed)return;
    setRefund(s=>({...s,status:'sending',message:''}));
    try{
      const result=await refundClient(selected.id,{amount,reason:refund.reason.trim()},{idempotencyKey:`admin-refund:${selected.id}:${amount.toFixed(2)}:${Date.now()}`});
      const detail=await detailClient(selected.id);
      setSelected(detail);
      setRefund({
        amount:String(detail.refundSummary?.availableAmount||''),
        reason:'',
        confirmed:false,
        status:'success',
        message:result.status==='SUCCEEDED'?'Возврат подтверждён платёжным провайдером.':'Возврат отправлен платёжному провайдеру.',
      });
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
  const selectedRow=(state.items||[]).find(item=>item.id===selectedId);
  const selectedRefundInfo=selectedRow?refundInfo(selectedRow):null;
  const canRefund=Boolean(selected&&selected.refundSummary?.refundable&&!selected.refundSummary?.hasPending&&Number(selected.refundSummary?.availableAmount)===Number(selected.amount));

  return <div className="payments-page">
    <section className="statistics">
      <div className="stat-card"><span>Платежей</span><strong>{summary.count}</strong></div>
      <div className="stat-card"><span>Оплачено</span><strong>{money(summary.gross)}</strong></div>
      <div className="stat-card"><span>Расходы провайдера</span><strong>{money(summary.providerCost)}</strong></div>
      <div className="stat-card"><span>К зачислению</span><strong>{money(summary.net)}</strong></div>
      <div className="stat-card"><span>Возвращено</span><strong>{money(summary.refunded)}</strong></div>
    </section>

    <section className="card event-filters">
      <label>Организация
        <select {...field('organizationId')}>
          {organizations.map(org=><option key={org.id} value={org.id}>{org.shortName||org.fullName||org.name||org.id}</option>)}
        </select>
      </label>
      <label>Статус
        <select {...field('status')}>
          <option value="">Все</option>
          {statuses.map(s=><option key={s} value={s}>{paymentStatusLabel(s)}</option>)}
        </select>
      </label>
      <label>Платёжный провайдер
        <select {...field('provider')}>
          <option value="">Все</option>
          {providers.map(provider=><option key={provider} value={provider}>{providerLabel(provider)}</option>)}
        </select>
      </label>
      <label>С<input type="datetime-local" {...field('dateFrom')}/></label>
      <label>По<input type="datetime-local" {...field('dateTo')}/></label>
    </section>

    <section className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,marginBottom:12}}>
      <div>
        <strong>{selectedRow?'Выбран один платёж':'Выберите платёж для действия'}</strong>
        {selectedRow?<div style={{marginTop:4}}>{dateTime(selectedRow.succeededAt||selectedRow.createdAt)} · {money(selectedRow.amount,selectedRow.currency)} · {providerLabel(selectedRow.provider)}</div>:null}
      </div>
      <button type="button" disabled={!canRefund} onClick={()=>selected&&openPayment(selected,{scroll:true})}>
        Оформить возврат
      </button>
    </section>

    {state.items.length?<div className="table-scroll card"><table>
      <thead><tr>
        <th>Выбор</th>
        <th>Дата</th>
        <th>Канал</th>
        <th>Покупатель</th>
        <th>Аппарат / точка</th>
        <th>Заказ</th>
        <th>Провайдер</th>
        <th>Статус платежа</th>
        <th>Сумма</th>
        <th>Вид возврата</th>
        <th>Статус возврата</th>
        <th>Сумма возврата</th>
        <th>К зачислению</th>
        <th>Сверка</th>
      </tr></thead>
      <tbody>{state.items.map(p=>{
        const ri=refundInfo(p);
        return <tr key={p.id} className={selectedId===p.id?'selected-row':''}>
          <td>
            <input
              type="checkbox"
              aria-label={`Выбрать платёж ${p.id}`}
              checked={selectedId===p.id}
              onChange={()=>toggleRow(p)}
            />
          </td>
          <td>{dateTime(p.succeededAt||p.createdAt)}</td>
          <td>{channelLabel(p.channel)}</td>
          <td>{p.customerDisplay||p.phoneMasked||p.customerId||'Без идентификации'}</td>
          <td>{p.machineId||'—'}{p.locationId?<><br/><small>{p.locationId}</small></>:null}</td>
          <td><code>{p.orderId}</code><br/><small>{methodLabel(p.paymentMethodType)}</small></td>
          <td>{providerLabel(p.provider)}</td>
          <td><strong>{paymentStatusLabel(p.status)}</strong></td>
          <td>{money(p.amount,p.currency)}</td>
          <td>{ri.type}</td>
          <td>{refundStatusLabels[ri.status]||ri.status}</td>
          <td>{ri.amount>0?money(ri.amount,p.currency):'—'}</td>
          <td>{money(p.economics?.netSettlementRub,p.currency)}</td>
          <td>{p.reconciliationStatus||'—'}</td>
        </tr>;
      })}</tbody>
    </table></div>:<EmptyState title="Платежи не найдены"/>}

    {selected&&<section id="payment-refund-panel" className="card" style={{marginTop:16}}>
      <div className="card-heading">
        <div>
          <h2>Платёж {selected.id}</h2>
          <p style={{margin:'6px 0 0'}}>Заказ {selected.orderId} · {channelLabel(selected.channel)} · {providerLabel(selected.provider)}</p>
        </div>
        <strong>{paymentStatusLabel(selected.status)}</strong>
      </div>

      <div className="statistics">
        <div className="stat-card"><span>Сумма</span><strong>{money(selected.amount,selected.currency)}</strong></div>
        <div className="stat-card"><span>Комиссия провайдера</span><strong>{money(selected.economics?.providerCommissionRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>НДС с комиссии</span><strong>{money(selected.economics?.providerCommissionVatRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>Всего расходов</span><strong>{money(selected.economics?.providerCostTotalRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>К зачислению</span><strong>{money(selected.economics?.netSettlementRub,selected.currency)}</strong></div>
        <div className="stat-card"><span>Доступно к возврату</span><strong>{money(selected.refundSummary?.availableAmount,selected.currency)}</strong></div>
      </div>

      <p><strong>Provider reference:</strong> {selected.providerReference||'—'} · <strong>Создан:</strong> {dateTime(selected.createdAt)} · <strong>Оплачен:</strong> {dateTime(selected.succeededAt)}</p>

      <h3>История возвратов</h3>
      {selected.refunds?.length?<div className="table-scroll"><table>
        <thead><tr><th>Дата</th><th>Сумма</th><th>Причина</th><th>Статус</th><th>Провайдер</th><th></th></tr></thead>
        <tbody>{selected.refunds.map(row=><tr key={row.id}>
          <td>{dateTime(row.requestedAt)}</td>
          <td>{money(row.amount,row.currency)}</td>
          <td>{row.reason}</td>
          <td>{refundStatusLabels[row.status]||row.status}</td>
          <td>{row.providerRefundId||'—'}</td>
          <td>{['REQUESTED','PENDING'].includes(row.status)?<button type="button" onClick={()=>refreshRefund(row)}>Обновить статус</button>:null}</td>
        </tr>)}</tbody>
      </table></div>:<p>Возвратов по платежу нет.</p>}

      {canRefund?<div style={{display:'grid',gap:10,maxWidth:520,marginTop:16}}>
        <h3>Оформить возврат</h3>
        <label>Сумма возврата<input type="number" value={selected.amount} readOnly/></label>
        <small>Доступно к возврату: {money(selected.refundSummary.availableAmount,selected.currency)}</small>
        <label>Причина<textarea rows={3} value={refund.reason} onChange={e=>setRefund({...refund,reason:e.target.value,confirmed:false})} placeholder="Укажите причину возврата"/></label>
        <label style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" checked={refund.confirmed} onChange={e=>setRefund({...refund,confirmed:e.target.checked})}/>
          <span>Подтверждаю сумму и причину возврата</span>
        </label>
        <button type="button" disabled={refund.status==='sending'||refund.reason.trim().length<3||!refund.confirmed} onClick={submitRefund}>
          {refund.status==='sending'?'Отправляем возврат…':'Выполнить полный возврат'}
        </button>
      </div>:selected.refundSummary?.hasPending?<p><strong>Новый возврат недоступен:</strong> предыдущий возврат ещё подтверждается.</p>:selected.refundSummary?.refundable?<p><strong>Возврат доступен:</strong> откройте полную карточку операции для разрешённого сценария возврата.</p>:null}

      {refund.message&&<p role="status"><strong>{refund.message}</strong></p>}
    </section>}
  </div>;
}
