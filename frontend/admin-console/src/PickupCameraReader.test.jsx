/** @vitest-environment jsdom */
import React,{act} from '../../miniapp/node_modules/react/index.js';
import {createRoot} from '../../miniapp/node_modules/react-dom/client.js';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const {detect}=vi.hoisted(()=>({detect:vi.fn()}));
vi.mock('../../miniapp/src/terminal/PickupQrDetector.js',()=>({PickupQrDetector:class{detect(...args){return detect(...args);}},isPickupQr:value=>/^UTP1:.*:\d{6}$/.test(value||'')}));
import {PickupCameraReader} from '../../miniapp/src/terminal/PickupCameraReader.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root,stop,getUserMedia;
beforeEach(()=>{vi.useFakeTimers();stop=vi.fn();getUserMedia=vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});Object.defineProperty(window.HTMLMediaElement.prototype,'play',{configurable:true,value:vi.fn().mockResolvedValue()});host=document.createElement('div');document.body.append(host);root=createRoot(host);detect.mockReset();});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
const flush=async()=>act(async()=>{await Promise.resolve();});
it('starts without native BarcodeDetector, reads once and closes every camera track',async()=>{
 const read=vi.fn();detect.mockResolvedValue([{rawValue:'UTP1:12345678-1234-1234-1234-123456789abc:123456'}]);
 act(()=>root.render(<PickupCameraReader onRead={read}/>));await act(async()=>host.querySelector('button').click());await flush();
 expect(getUserMedia).toHaveBeenCalledTimes(1);await act(async()=>vi.advanceTimersByTimeAsync(300));
 expect(read).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalledTimes(1);await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(read).toHaveBeenCalledTimes(1);
});
it('ignores unrelated QR and releases permission result received after leaving',async()=>{
 const read=vi.fn();detect.mockResolvedValue([{rawValue:'https://example.com'}]);act(()=>root.render(<PickupCameraReader onRead={read}/>));await act(async()=>host.querySelector('button').click());await act(async()=>vi.advanceTimersByTimeAsync(300));expect(read).not.toHaveBeenCalled();expect(host.textContent).toContain('Это не QR-код получения');
 act(()=>root.render(<PickupCameraReader onRead={read} disabled/>));expect(stop).toHaveBeenCalledTimes(1);
 let resolve;getUserMedia.mockImplementation(()=>new Promise(done=>{resolve=done;}));act(()=>root.render(<PickupCameraReader onRead={read}/>));act(()=>host.querySelector('button').click());act(()=>root.render(null));await act(async()=>resolve({getTracks:()=>[{stop}]}));expect(stop).toHaveBeenCalledTimes(2);expect(read).not.toHaveBeenCalled();
});
it('shows a useful permission error and allows another attempt',async()=>{
 getUserMedia.mockRejectedValue(Object.assign(Error('denied'),{name:'NotAllowedError'}));act(()=>root.render(<PickupCameraReader onRead={()=>{}}/>));await act(async()=>host.querySelector('button').click());expect(host.textContent).toContain('Разрешите камеру');expect(host.querySelector('button').disabled).toBe(false);
});
