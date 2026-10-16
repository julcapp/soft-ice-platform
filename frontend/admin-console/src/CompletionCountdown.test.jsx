/** @vitest-environment jsdom */
import React,{act} from '../../miniapp/node_modules/react/index.js';
import {createRoot} from '../../miniapp/node_modules/react-dom/client.js';
import {it,expect,vi} from 'vitest';
import {CompletionCountdown} from '../../miniapp/src/terminal/CompletionCountdown.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('shows thirty seconds, preserves deadline after callback rerender and completes once',()=>{
 vi.useFakeTimers();const node=document.createElement('div'),root=createRoot(node),first=vi.fn(),latest=vi.fn();
 try{
 act(()=>root.render(<CompletionCountdown onComplete={first}/>));expect(node.textContent).toContain('30');
 act(()=>vi.advanceTimersByTime(10000));expect(node.textContent).toContain('20');
 act(()=>root.render(<CompletionCountdown onComplete={latest}/>));
 act(()=>vi.advanceTimersByTime(20000));expect(latest).toHaveBeenCalledTimes(1);expect(first).not.toHaveBeenCalled();
 act(()=>vi.advanceTimersByTime(10000));expect(latest).toHaveBeenCalledTimes(1);
 }finally{act(()=>root.unmount());vi.useRealTimers();}
});
