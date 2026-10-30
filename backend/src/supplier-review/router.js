const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const COOKIE = 'supplier_review';
function createSupplierReviewRouter({ accountFile = '/home/julcapp/.config/soft-ice/supplier-review.json', now = () => Date.now() } = {}) {
  const router = express.Router();
  const failures = new Map();
  const account = () => JSON.parse(fs.readFileSync(accountFile, 'utf8'));
  const validAccount = a => a.enabled === true && Number.isFinite(Date.parse(a.expiresAt)) && Date.parse(a.expiresAt) > now();
  const signature = (s, a) => crypto.createHmac('sha256', a.sessionSecret).update(s).digest('hex');
  const equal = (a,b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  router.use((req,res,next) => {
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
    if (req.method !== 'GET' && req.get('origin') !== 'https://admin.utimoshi.ru') return res.sendStatus(403);
    next();
  });
  router.get('/', (_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
  for (const name of ['app.js','style.css','viewer.js','viewer.css','dictionary.json']) router.get('/'+name,(_req,res)=>res.sendFile(path.join(__dirname,name)));
  router.post('/login', express.json({limit:'2kb'}), (req,res) => {
    let a; try { a=account(); } catch { return res.status(503).json({error:'UNAVAILABLE'}); }
    const key=req.ip; const t=now();
    for(const [k,v] of failures) if(v.until<=t) failures.delete(k);
    const f=failures.get(key)||{count:0,until:t+15*60*1000};
    if(f.count>=8) return res.status(429).json({error:'TRY_LATER'});
    const username=typeof req.body?.username==='string'?req.body.username:'';
    const password=typeof req.body?.password==='string'?req.body.password:'';
    const digest=crypto.scryptSync(password.slice(0,256),a.salt,64).toString('hex');
    if(!validAccount(a)||username!==a.username||!equal(digest,a.passwordHash)) {
      f.count++; failures.set(key,f); return res.status(401).json({error:'LOGIN_FAILED'});
    }
    failures.delete(key);
    const payload=Buffer.from(JSON.stringify({version:a.version,exp:Math.min(t+8*60*60*1000,Date.parse(a.expiresAt))})).toString('base64url');
    res.cookie(COOKIE,payload+'.'+signature(payload,a),{httpOnly:true,secure:true,sameSite:'strict',path:'/api/supplier-review',maxAge:8*60*60*1000});
    return res.json({ok:true});
  });
  router.post('/logout',(_req,res)=>{res.clearCookie(COOKIE,{path:'/api/supplier-review',httpOnly:true,secure:true,sameSite:'strict'});res.json({ok:true});});
  router.use((req,res,next)=>{
    try {
      const a=account(); const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
      const token=raw?.slice(COOKIE.length+1)||'';const [p,s]=token.split('.');
      if(!validAccount(a)||!p||!s||!equal(signature(p,a),s)) return res.status(401).json({error:'LOGIN_REQUIRED'});
      const data=JSON.parse(Buffer.from(p,'base64url').toString());
      if(data.version!==a.version||!Number.isFinite(data.exp)||data.exp<=now()) return res.status(401).json({error:'LOGIN_REQUIRED'});
      req.supplierAccount=a;next();
    } catch { return res.status(401).json({error:'LOGIN_REQUIRED'}); }
  });
  router.get('/identity',(req,res)=>{if(req.supplierAccount.scope!=='ALL_ADMIN_READONLY')return res.sendStatus(403);res.json({data:{subject_id:'supplier-review-chahine',displayName:'Chahine CHIHA',roles:['SUPPLIER_VIEWER'],auth_method:'supplier_review_readonly',readOnly:true}});});
  router.get('/full', (req,res) => {
    if(req.supplierAccount.scope!=='ALL_ADMIN_READONLY')return res.sendStatus(403);
    let html=fs.readFileSync('/var/www/admin.utimoshi.ru/index.html','utf8');
    html=html.replace('<head>', '<head><script src="/api/supplier-review/viewer.js"></script><link rel="stylesheet" href="/api/supplier-review/viewer.css">');
    res.type('html').send(html);
  });
  router.use('/read',require('./readProxy').readProxy);
  router.get('/review' ,(req,res)=>res.json({displayName:'Chahine CHIHA',expiresAt:req.supplierAccount.expiresAt,scope:req.supplierAccount.scope||'REFERENCE_ONLY',mode:'REFERENCE_ONLY',model:'JI-ICE-D2-133(21.5SP)',board:'kiayo K518 / RK3288',sdk:'Ice Cream Machine SDK-20260708',screen:'1080 × 1920',method:'TcnVendIF.getInstance().reqShip(slotNo, zhuliao, dingliao, guojiang, zhuQ, dingQ, guoQ, shipMethod, tradeNo)'}));
  router.use((_req,res)=>res.sendStatus(403));
  return router;
}
module.exports={createSupplierReviewRouter};
