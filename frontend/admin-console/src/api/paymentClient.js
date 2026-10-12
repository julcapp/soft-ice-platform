[Reading 51 lines from start (total: 51 lines, 0 remaining)]

const base='/api/v1/admin/payments';

const adminHeaders={
  'X-Admin-Role':'PLATFORM_OWNER',
  'X-Admin-Subject':'payments-console',
};

async function request(url, options={}){
  const { headers: extraHeaders={}, ...rest } = options;
  const response=await fetch(url,{
    ...rest,
    headers:{
      Accept:'application/json',
      ...adminHeaders,
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...extraHeaders,
    },
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload?.error?.message||'Ошибка платёжного сервиса.');
    error.status=response.status;
    error.code=payload?.error?.code||'PAYMENT_REQUEST_FAILED';
    throw error;
  }
  return payload.data;
}

export async function listPayments(filters={}){
  const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
  return request(`${base}?${query}`);
}

export function getPayment(paymentId){
  return request(`${base}/${encodeURIComponent(paymentId)}`);
}

export function createPaymentRefund(paymentId,{amount,reason},{idempotencyKey}={}){
  return request(`${base}/${encodeURIComponent(paymentId)}/refunds`,{
    method:'POST',
    headers:{...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
    body:JSON.stringify({amount,reason}),
  });
}

export function refreshPaymentRefund(refundId){
  return request(`${base}/refunds/${encodeURIComponent(refundId)}/refresh`,{
    method:'POST',
    body:'{}',
  });
}

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]