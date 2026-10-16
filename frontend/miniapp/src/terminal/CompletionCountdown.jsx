import React,{useEffect,useRef,useState} from 'react';
export function CompletionCountdown({onComplete,seconds=30}){
 const callback=useRef(onComplete);callback.current=onComplete;
 const [left,setLeft]=useState(seconds);
 useEffect(()=>{
  const deadline=Date.now()+seconds*1000;let finished=false;
  const tick=()=>{const value=Math.max(0,Math.ceil((deadline-Date.now())/1000));setLeft(value);if(!value&&!finished){finished=true;callback.current?.();}};
  tick();const timer=window.setInterval(tick,250);return ()=>window.clearInterval(timer);
 },[seconds]);
 return <p className="display-completion-countdown" role="timer" style={{fontSize:'clamp(18px,2vw,28px)',fontWeight:700,color:'#008d7c',textAlign:'center',margin:'12px 0',lineHeight:1.4}}>Возврат на главный экран через <b>{left}</b> сек.</p>;
}
