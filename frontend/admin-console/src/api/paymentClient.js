const base='/api/v1/admin/payments';
export async function listPayments(filters={}){const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));const response=await fetch(`${base}?${query}`,{headers:{Accept:'application/json'}});if(!response.ok)throw Object.assign(new Error('Не удалось загрузить платежи.'),{status:response.status});return(await response.json()).data;}
