const headers={'X-Admin-Role':'PLATFORM_OWNER','X-Admin-Subject':'outbox-console'};
async function request(path,options={}){const response=await fetch(`/api/v1/admin/outbox${path}`,{...options,headers:{'Content-Type':'application/json',...headers,...options.headers}});if(!response.ok){const error=new Error('Не удалось загрузить Transactional Outbox.');error.status=response.status;throw error;}return(await response.json()).data;}
const query=(filters={})=>{const p=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!==undefined));return p.size?`?${p}`:'';};
export const listOutbox=(filters={},options={})=>request(`/${query(filters)}`,options);
export const retryOutboxEvent=(eventId)=>request(`/${eventId}/retry`,{method:'POST'});
