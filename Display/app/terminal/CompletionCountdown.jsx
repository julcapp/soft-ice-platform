import React,{useEffect,useRef,useState} from 'react';
export function CompletionCountdown({onComplete,seconds=30}){
 const callback=useRef(onComplete);callback.current=onComplete;
 const [left,setLeft]=useState(seconds);
 useEffect(()=>{
  const deadline=Date.now()+seconds*1000;let finished=false;
  const tick=()=>{const value=Math.max(0,Math.ceil((deadline-Date.now())/1000));setLeft(value);if(!value&&!finished){finished=true;callback.current?.();}};
  tick();const timer=window.setInterval(tick,250);return ()=>window.clearInterval(timer);
 },[seconds]);
 const urgent=left<=5;
 return <p className={`display-completion-countdown${urgent?' is-urgent':''}`} role="timer" aria-live="polite">Возврат на главный экран через <span className="display-completion-seconds" key={left}>{left}</span> сек.</p>;
}
