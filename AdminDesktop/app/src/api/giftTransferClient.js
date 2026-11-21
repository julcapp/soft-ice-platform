import { adminAuthHeaders } from './adminAuth';
async function read(path){const response=await fetch(`/api/v1/admin/gift-transfers${path}`,{headers:adminAuthHeaders()});const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить подарки');return body.data?.map?.(x=>x.attributes||x)||body.data?.attributes||body.data}
export async function getGiftTransfers(){const [transfers,statistics]=await Promise.all([read(''),read('/statistics')]);return{transfers,statistics}}
