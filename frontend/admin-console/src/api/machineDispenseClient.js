const base='/api/v1/admin/machine-dispenses';

const adminHeaders={
  'X-Admin-Role':'PLATFORM_OWNER',
  'X-Admin-Subject':'machine-dispenses-console',
};

async function request(url,options={}){
  const {headers:extraHeaders={},...rest}=options;
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
    const error=new Error(payload?.error?.message||'Не удалось загрузить выдачи аппаратов.');
    error.status=response.status;
    error.code=payload?.error?.code||'MACHINE_DISPENSE_REQUEST_FAILED';
    throw error;
  }
  return payload.data;
}

export async function listMachineDispenses(filters={}){
  const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
  return request(base+'?'+query);
}

export async function classifyMachineRecovery(attempt,{organizationId,reason}){
  return request(base+'/'+encodeURIComponent(attempt)+'/recover',{
    method:'POST',
    headers:{...(organizationId?{'X-Organization-Id':organizationId}:{})},
    body:JSON.stringify({organizationId,reason}),
  });
}
