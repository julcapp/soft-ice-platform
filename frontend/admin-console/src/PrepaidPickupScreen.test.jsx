/** @vitest-environment jsdom */
import React,{act} from '../../miniapp/node_modules/react/index.js';
import {createRoot} from '../../miniapp/node_modules/react-dom/client.js';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const {redeem,poll}=vi.hoisted(()=>({redeem:vi.fn(),poll:vi.fn()}));
vi.mock('../../miniapp/src/terminal/PrepaidPickupApi.js',()=>({redeemPrepaidOrder:(...args)=>redeem(...args),getPrepaidPickupStatus:(...args)=>poll(...args)}));
vi.mock('../../miniapp/src/terminal/PickupCameraReader.jsx',()=>({PickupCameraReader:({onRead,disabled})=><button data-camera disabled={disabled} onClick={()=>{onRead('UTP1:12345678-1234-1234-1234-123456789abc:123456');onRead('UTP1:12345678-1234-1234-1234-123456789abc:123456');}}>Сканировать</button>}));
import {PrepaidPickupScreen} from '../../miniapp/src/terminal/PrepaidPickupScreen.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host,back;
beforeEach(()=>{vi.useFakeTimers();back=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host);redeem.mockReset();poll.mockReset();});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
it('uses exactly one request after QR; polling continues over equal intermediate statuses',async()=>{
 redeem.mockResolvedValue({dispense_attempt_id:'attempt',dispense_status:'AUTHORIZED'});poll.mockResolvedValueOnce({status:'AUTHORIZED'}).mockResolvedValueOnce({status:'AUTHORIZED'}).mockResolvedValue({status:'DISPENSED'});
 act(()=>root.render(<PrepaidPickupScreen machineId="TEST-MACHINE-001" onBack={back}/>));await act(async()=>host.querySelector('[data-camera]').click());expect(redeem).toHaveBeenCalledTimes(1);expect(redeem.mock.calls[0][1].qrPayload).toContain('UTP1:');await act(async()=>vi.advanceTimersByTimeAsync(4200));expect(poll).toHaveBeenCalledTimes(3);expect(host.textContent).toContain('Ваше мороженое готово');expect(back).not.toHaveBeenCalled();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(back).toHaveBeenCalledTimes(1);
});
it('manual keypad submits six digits; idle timer returns after 30 seconds and resets on activity',async()=>{
 act(()=>root.render(<PrepaidPickupScreen machineId="TEST-MACHINE-001" onBack={back}/>));act(()=>vi.advanceTimersByTime(20000));expect(host.textContent).toContain('Возврат через 10 с');act(()=>host.querySelector('section').dispatchEvent(new Event('pointerdown',{bubbles:true})));act(()=>vi.advanceTimersByTime(20000));expect(back).not.toHaveBeenCalled();
 for(const digit of ['1','2','3','4','5','6'])act(()=>[...host.querySelectorAll('.pickup-keys button')].find(b=>b.textContent===digit).click());expect(host.querySelector('#pickup-code').value).toBe('123456');redeem.mockResolvedValue({dispense_attempt_id:'attempt',dispense_status:'DISPENSED'});await act(async()=>host.querySelector('.pickup-submit').click());expect(redeem.mock.calls[0][1]).toEqual({code:'123456'});
});
it('does not hang forever on a timed out redemption or silently retry it',async()=>{
 redeem.mockImplementation((machine,data,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})))));
 act(()=>root.render(<PrepaidPickupScreen machineId="TEST-MACHINE-001" onBack={back}/>));act(()=>host.querySelector('[data-camera]').click());await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(host.textContent).toContain('Результат запроса пока неизвестен');expect(host.querySelector('[data-camera]').disabled).toBe(true);expect(redeem).toHaveBeenCalledTimes(1);expect(back).not.toHaveBeenCalled();
});
it('returns on idle and aborts a request when leaving',async()=>{
 act(()=>root.render(<PrepaidPickupScreen machineId="TEST-MACHINE-001" onBack={back}/>));act(()=>vi.advanceTimersByTime(30000));expect(back).toHaveBeenCalledTimes(1);redeem.mockReturnValue(new Promise(()=>{}));act(()=>host.querySelector('[data-camera]').click());const signal=redeem.mock.calls[0][2].signal;act(()=>root.render(null));expect(signal.aborted).toBe(true);
});
