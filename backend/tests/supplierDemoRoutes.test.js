const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSupplierDemoRouter}=require('../src/supplier_demo/router');
test('supplier route serves static preview but rejects every command without falling through',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'supplier-demo-'));await fs.mkdir(path.join(dir,'assets'));await fs.writeFile(path.join(dir,'index.html'),'<h1>Demo</h1>');await fs.writeFile(path.join(dir,'assets/demo-123.js'),'void 0;');
 const app=express();let fallthrough=0;app.use('/api/supplier-demo',createSupplierDemoRouter({rootDir:dir}));app.use((req,res)=>{fallthrough++;res.status(500).end();});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/supplier-demo`;
 try{
  const r=await fetch(url+'/');assert.equal(r.status,200);assert.match(await r.text(),/Demo/);assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(r.headers.get('content-security-policy'),/sandbox allow-scripts(?:;|$)/);assert.doesNotMatch(r.headers.get('content-security-policy'),/allow-same-origin/);
  assert.match(r.headers.get('permissions-policy'),/camera=\(\)/);assert.equal((await fetch(url)).url,url+'/');
  for(const endpoint of ['/','/api/payments','/api/orders','/api/dispense','/v1/machines/TEST-MACHINE-001/prepaid/redeem','/assets/demo-123.js'])for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await fetch(url+endpoint,{method})).status,403);
  for(const endpoint of ['/api/payments','/api/dispense','/.env','/v1/orders'])assert.equal((await fetch(url+endpoint)).status,403);
  assert.equal((await fetch(url+'/assets/demo-123.js')).status,200);assert.equal((await fetch(url+'/assets/missing.js')).status,404);assert.equal(fallthrough,0);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
