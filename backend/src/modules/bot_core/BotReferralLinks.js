'use strict';
function createBotReferralLinks({telegramUsername=null,maxUsername=null}={}) {
  const username=value=>typeof value==='string' && /^[A-Za-z0-9_]{3,64}$/.test(value.replace(/^@/,'')) ? value.replace(/^@/,'') : null;
  const names={telegram:username(telegramUsername),max:username(maxUsername)};
  return (payload,channel)=>{
    if (!names[channel] || !/^[A-Za-z0-9_-]{1,64}$/.test(payload)) return null;
    const url=new URL(`https://${channel==='telegram'?'t.me':'max.ru'}/${names[channel]}`);
    url.searchParams.set('start',payload);return url.href;
  };
}
module.exports={createBotReferralLinks};
