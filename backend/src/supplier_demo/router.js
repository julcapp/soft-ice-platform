'use strict';
const express=require('express');
const path=require('node:path');
const CSP="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; sandbox allow-scripts";
function createSupplierDemoRouter({rootDir=path.resolve(__dirname,'../../public/supplier-demo')}={}){
 const router=express.Router();
 // This router has no database, provider, payment or machine dependencies.
 router.use((req,res,next)=>{
  res.set({'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=(), payment=(), geolocation=(), usb=(), serial=()'});
  if(!['GET','HEAD'].includes(req.method))return deny(res);
  if(req.path==='/'&&!req.originalUrl.split('?')[0].endsWith('/'))return res.redirect(308,req.baseUrl+'/');
  next();
 });
 // Strict allowlist: there are no API action handlers and no SPA API fallback.
 router.use((req,res,next)=>{
  if(req.path==='/'||req.path==='/index.html'||/^\/assets\/[a-zA-Z0-9_-]+\.(?:js|css|png|jpg)$/.test(req.path))return next();
  return deny(res);
 });
 router.use(express.static(rootDir,{index:'index.html',dotfiles:'deny',redirect:false,fallthrough:true}));
 router.use((req,res)=>res.status(404).json({error:{code:'DEMO_FILE_NOT_FOUND',message:'Файл демонстрации не найден.'}}));
 return router;
}
function deny(res){return res.status(403).json({error:{code:'SUPPLIER_DEMO_READ_ONLY',message:'Демонстрационный режим: платежи, выдача и операции записи запрещены.'}});}
module.exports={createSupplierDemoRouter,CSP};
