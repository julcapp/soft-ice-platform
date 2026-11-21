// Run only on server as the service owner. Never put passwords in argv.
const fs=require('node:fs');
const file=process.env.SUPPLIER_ACCOUNT_FILE||'/home/julcapp/.config/soft-ice/supplier-review.json';
const [action,date]=process.argv.slice(2);const a=JSON.parse(fs.readFileSync(file,'utf8'));
if(action==='extend'){if(!date||!Number.isFinite(Date.parse(date))||Date.parse(date)<=Date.now())throw new Error('Future ISO timestamp required');a.expiresAt=new Date(date).toISOString();a.enabled=true;}
else if(action==='revoke')a.enabled=false;
else if(action!=='status')throw new Error('Use status, extend ISO_TIMESTAMP or revoke');
if(action!=='status'){a.version++;fs.writeFileSync(file+'.tmp',JSON.stringify(a,null,2),{mode:0o600});fs.chownSync(file+'.tmp',process.getuid(),fs.statSync(file).gid);fs.chmodSync(file+'.tmp',0o640);fs.renameSync(file+'.tmp',file);}
console.log(JSON.stringify({enabled:a.enabled,expiresAt:a.expiresAt}));
