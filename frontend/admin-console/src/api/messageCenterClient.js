const headers={ 'X-Admin-Role':'PLATFORM_OWNER','X-Admin-Subject':'message-center-console' };

async function request(path=''){
  const response=await fetch('/api/v1/admin/message-center'+path,{headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload?.error?.message||'Не удалось загрузить Центр сообщений.');
    error.status=response.status;
    throw error;
  }
  return payload.data;
}

export function listMessages(filters={}){
  const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
  return request(query.toString()?'?'+query.toString():'');
}

export function getMessage(id){
  return request('/'+encodeURIComponent(id));
}
