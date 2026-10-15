import React from 'react';
import {createRoot} from 'react-dom/client';
import {CustomerBenefitsPage} from './CustomerBenefits';
import {NavigationSaveProvider} from './NavigationSave';
import {AdminAuthGate} from './AdminAuthGate';
let host=null,root=null;
window.softIceCustomerBenefitsRef=(element)=>{
 if(element===host)return;
 if(!element){const previous=root;root=null;host=null;queueMicrotask(()=>previous?.unmount());return;}
 host=element;root=createRoot(element);
 const page=<NavigationSaveProvider priority><CustomerBenefitsPage/></NavigationSaveProvider>;
 root.render(sessionStorage.getItem('access_token')?page:<AdminAuthGate>{page}</AdminAuthGate>);
};
