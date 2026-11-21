const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');const express=require('express');const {createSupplierReviewRouter}=require('./router');
test('supplier isolation, expiry, tamper rejection and revocation',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supplier-test-'));const file=path.join(dir,'account.json');let clock=Date.now();const a={enabled:true,version:1,username:'engineer test',salt:'test-salt',passwordHash:crypto.scryptSync('test password','test-salt',64).toString('hex'),sessionSecret:crypto.randomBytes(32).toString('hex'),expiresAt:new Date(clock+86400000).toISOString()};fs.writeFileSync(file,JSON.stringify(a));const app=express();app.use('/api/supplier-review',createSupplierReviewRouter({accountFile:file,now:()=>clock}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/supplier-review';const origin='https://admin.utimoshi.ru';try{
 assert.equal((await fetch(base+'/review')).status,401);
 assert.equal((await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 let r=await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:a.username,password:'test password'})});assert.equal(r.status,200);const set=r.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/Secure/);const cookie=set.split(';')[0];
 r=await fetch(base+'/review',{headers:{Cookie:cookie}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.mode,'REFERENCE_ONLY');assert.equal(data.passwordHash,undefined);assert.equal(data.customers,undefined);
 assert.equal((await fetch(base+'/review',{headers:{Cookie:cookie+'x'}})).status,401);
 assert.equal((await fetch(base+'/dispense',{method:'POST',headers:{Origin:origin,Cookie:cookie}})).status,403);
 assert.equal((await fetch(base+'/../v1/admin/crm/customers',{headers:{Cookie:cookie}})).status,404);
 clock+=86400001;assert.equal((await fetch(base+'/review',{headers:{Cookie:cookie}})).status,401);clock-=86400001;
 a.enabled=false;fs.writeFileSync(file,JSON.stringify(a));assert.equal((await fetch(base+'/review',{headers:{Cookie:cookie}})).status,401);
 a.enabled=true;a.version++;fs.writeFileSync(file,JSON.stringify(a));assert.equal((await fetch(base+'/review',{headers:{Cookie:cookie}})).status,401);
 for(let i=0;i<8;i++)assert.equal((await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401);
 assert.equal((await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,429);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}});
