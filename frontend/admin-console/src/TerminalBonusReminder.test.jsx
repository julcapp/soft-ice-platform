/** @vitest-environment jsdom */
import React,{act} from '../../miniapp/node_modules/react/index.js';
import {createRoot} from '../../miniapp/node_modules/react-dom/client.js';
import {it,expect,vi,afterEach} from 'vitest';
import {SalesTerminalPage} from '../../miniapp/src/terminal/SalesTerminalPage.jsx';
const fixture=vi.hoisted(()=>({currency:'RUB',machine:{id:'TEST-MACHINE-001'},currentFlavor:{id:'ice',sku:'ice',nameRu:'Мороженое',basePrice:7,currency:'RUB'},sprinkles:[{id:'sprinkle',sku:'sprinkle_confetti',nameRu:'Конфетти',category:'SPRINKLE',basePrice:0,currency:'RUB'}],toppings:[{id:'topping',sku:'topping_strawberry',nameRu:'Клубничный топпинг',category:'TOPPING',basePrice:0,currency:'RUB'}]}));
vi.mock('../../miniapp/src/terminal/MachineCatalogApi.js',()=>({getMachineCatalog:async()=>fixture}));
vi.mock('../../miniapp/src/promotion/usePricingQuote.js',()=>({usePricingQuote:()=>({status:'ready',lockExpired:false,quote:{id:'quote',finalAmount:7,currency:'RUB'}})}));
vi.mock('../../miniapp/src/promotion/PromotionPricePanel.jsx',()=>({PromotionPricePanel:()=>null}));
vi.mock('../../miniapp/src/analytics/trackEvent.js',()=>({trackEvent:()=>{}}));
vi.mock('../../miniapp/src/terminal/DisplayRecognitionApi.js',()=>({recognizeDisplayPhone:async()=>({state:'RETURNING',bonusBalance:0,purchaseToken:'fixture-buyer-token'})}));
vi.mock('../../miniapp/src/terminal/TerminalPaymentScreen.jsx',()=>({TerminalPaymentScreen:({purchaseToken,onBack})=><div data-testid="mock-payment" data-buyer={purchaseToken||''}><button onClick={onBack}>Вернуться к заказу</button></div>}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,node;
afterEach(()=>{if(root)act(()=>root.unmount());node?.remove();sessionStorage.clear();vi.unstubAllGlobals();});
async function click(label){const button=[...node.querySelectorAll('button')].find(b=>b.textContent.trim()===label);expect(button, label).toBeTruthy();await act(async()=>button.click());}
async function openSummary(){
 history.replaceState({},'','/?machineId=TEST-MACHINE-001');sessionStorage.clear();vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>({results:[]})})));
 node=document.createElement('div');document.body.append(node);root=createRoot(node);await act(async()=>root.render(<SalesTerminalPage/>));
 await act(async()=>node.querySelector('[aria-label="Коснитесь экрана, чтобы начать"]').click());
 await click('Собрать мороженое');await click('Далее: топпинг');await click('Продолжить');
}
it('reminds before creating checkout, and explicit refusal is not repeated on return',async()=>{
 await openSummary();await click('Перейти к оплате');
 expect(node.textContent).toContain('Хотите получать бонусы?');expect(sessionStorage.length).toBe(0);expect(node.querySelector('[data-testid="mock-payment"]')).toBeNull();
 await click('Продолжить без бонусов');expect(node.querySelector('[data-testid="mock-payment"]')).not.toBeNull();
 await click('Вернуться к заказу');await click('Перейти к оплате');expect(node.querySelector('[data-testid="mock-payment"]')).not.toBeNull();
});
it('late phone entry preserves composition, returns to review, and passes server-issued token into checkout',async()=>{
 await openSummary();await click('Перейти к оплате');await click('Указать номер телефона');
 for(const digit of '9990000001')await click(digit);await click('Продолжить');await click('Продолжить покупку');
 expect(node.querySelector('.display-summary')).not.toBeNull();expect(node.textContent).toContain('Конфетти');expect(node.textContent).toContain('Клубничный топпинг');
 await click('Перейти к оплате');expect(node.querySelector('[data-testid="mock-payment"]').dataset.buyer).toBe('fixture-buyer-token');
 expect(sessionStorage.getItem('soft_ice_terminal_checkout:TEST-MACHINE-001')).not.toContain('fixture-buyer-token');
});
