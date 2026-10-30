// Dispatch only reviewed GET paths into the existing admin readers.
// No admin token is created, returned, or accepted from this workspace.
const READ_PREFIXES = new Set(['events','machines','equipment','outbox','customers','dashboard','customer-benefits','promotions','machine-twins','machine-runtime','platform-events','inventory','maintenance','operator-workspace','crm','customer-360','external-channels','machine-connectivity','machine-settings','video-surveillance','event-center','gift-transfers','transactional-outbox','photo-verification','private-channel','catalog','payments','machine-dispenses','message-center','scheduler','users','organizations','customer-profiles','payment-profiles','operations','notifications']);
function readProxy(req,res,next){
  if(req.supplierAccount?.scope!=='ALL_ADMIN_READONLY') return res.status(403).json({error:{code:'SUPPLIER_SCOPE_DENIED'}});
  if(req.method!=='GET')return res.status(403).json({error:{code:'SUPPLIER_READ_ONLY',message:'Supplier access is read-only.'}});
  const pathname=req.url.split('?')[0];
  if(/%|\\|\.\.|\/\//.test(pathname))return res.sendStatus(403);
  const parts=pathname.split('/').filter(Boolean);
  const allowed=(parts[0]==='admin'&&READ_PREFIXES.has(parts[1]))||['organizations','operator-workspace'].includes(parts[0]);
  if(!allowed)return res.status(403).json({error:{code:'SUPPLIER_PATH_DENIED'}});
  // Existing readers use PLATFORM_OWNER to select the platform-wide tenant scope.
  // This virtual per-request context exists ONLY beyond the GET allowlist above.
  req.securityContext={subject_type:'administrator',subject_id:'supplier-review-chahine',roles:['PLATFORM_OWNER','ADMIN','OBSERVER'],auth_method:'supplier_review_readonly',readOnly:true};
  delete req.headers.authorization;
  delete req.headers['x-admin-permissions'];
  req.url='/api/v1'+req.url;req.baseUrl='';
  // Do not propagate the original URL to a new browser context or issue tokens.
  req.app.handle(req,res,next);
}
module.exports={readProxy,READ_PREFIXES};
