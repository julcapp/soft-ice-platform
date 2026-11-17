'use strict';
(function(root){
  function createTapGate({threshold=3,windowMs=1250,clock=()=>Date.now()}={}) {
    let count=0,last=0;
    return Object.freeze({
      tap(){const now=clock();if(now-last>windowMs||now<last)count=0;last=now;count++;if(count>=threshold){count=0;last=0;return true;}return false;},
      reset(){count=0;last=0;},
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createTapGate};
  if(!root.document)return;
  const doc=root.document;
  const trigger=doc.getElementById('service-terminal');
  const panel=doc.getElementById('service-overlay');
  const close=doc.getElementById('service-close');
  if(!trigger||!panel||!close)return;
  const gate=createTapGate();
  let timer;
  function hide(){panel.hidden=true;gate.reset();root.clearTimeout(timer);trigger.focus();}
  function open(){panel.hidden=false;close.focus();root.clearTimeout(timer);timer=root.setTimeout(hide,120000);}
  trigger.addEventListener('click',()=>{if(gate.tap())open();});
  close.addEventListener('click',hide);
  panel.addEventListener('click',event=>{if(event.target===panel)hide();});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)hide();});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)gate.reset();});
})(typeof window!=='undefined'?window:globalThis);
