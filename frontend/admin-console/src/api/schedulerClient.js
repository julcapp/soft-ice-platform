const headers={ 'X-Admin-Role':'PLATFORM_OWNER','X-Admin-Subject':'scheduler-console' };

async function request(path=''){
  const response=await fetch('/api/v1/admin/scheduler'+path,{headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload?.error?.message||'Не удалось загрузить Планировщик.');
    error.status=response.status;
    throw error;
  }
  return payload.data;
}

export function listSchedulerTasks(){ return request(''); }
export function getSchedulerTask(id){ return request('/'+encodeURIComponent(id)); }

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]