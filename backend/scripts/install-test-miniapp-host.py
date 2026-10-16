"""Publish the TEST-only Mini App entry on existing bot-test host. Run as root."""
import pathlib,subprocess,datetime,urllib.request,urllib.error,hashlib,json,os

def additions():
    routes=[('/miniapp/','http://127.0.0.1:8780/preorder-test.html'),
            ('/preorder-test.js','http://127.0.0.1:8780/preorder-test.js'),
            ('/telegram-web-app-59.js','http://127.0.0.1:8780/telegram-web-app-59.js'),
            ('/tma.css','http://127.0.0.1:8780/tma.css')]
    text='    # TEST Mini App: one shared UI, no general API proxy.\n'
    text+='    location = /miniapp { return 308 /miniapp/; }\n'
    for path,target in routes:
        text+=f'''    location = {path} {{
        limit_except GET {{ deny all; }}
        proxy_pass {target};
        proxy_set_header Host miniapp.utimoshi.ru;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 20s;
        add_header Cache-Control "no-store" always;
    }}
'''
    text+='''    location ^~ /api/tma/shared-preorder/ {
        limit_except POST { deny all; }
        client_max_body_size 16k;
        proxy_pass http://127.0.0.1:8800/api/v1/miniapp-test-preorders/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 20s;
        add_header Cache-Control "no-store" always;
    }
'''
    return text

def check(url,expected,body=None):
    req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'} if body is not None else {})
    try:
        with urllib.request.urlopen(req,timeout=15) as r: code=r.status; data=r.read()
    except urllib.error.HTTPError as e: code=e.code;data=e.read()
    if code not in expected: raise RuntimeError(f'HTTP check failed: {url}: {code}')
    print('CHECK',url,code)
    return data

def main():
    if os.geteuid()!=0: raise SystemExit('Run with sudo: nginx configuration requires root.')
    config=pathlib.Path('/etc/nginx/sites-available/bot-test.utimoshi.ru')
    policy=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend/src/modules/bot_core/TestMiniAppEntryPolicy.js')
    old_config=config.read_bytes();old_policy=policy.read_bytes()
    anchor='    location / {\n        return 404;\n    }'
    cfg=old_config.decode();src=old_policy.decode()
    old_url='https://miniapp.utimoshi.ru/preorder-test.html';new_url='https://bot-test.utimoshi.ru/miniapp/'
    if cfg.count(anchor)!=1 or 'TEST Mini App:' in cfg or src.count(old_url)!=1:
        raise SystemExit('STOP: source drift or already installed; inspect before proceeding.')
    # Validate dependencies before any mutation.
    check('http://127.0.0.1:8780/preorder-test.html',[200])
    sdk=check('http://127.0.0.1:8780/telegram-web-app-59.js',[200])
    if hashlib.sha256(sdk).hexdigest()!='124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908':
        raise SystemExit('STOP: SDK checksum mismatch')
    backup=pathlib.Path('/home/julcapp/softice-deploy-backups')/('test-miniapp-host-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir(parents=True,mode=0o700)
    (backup/'nginx.conf').write_bytes(old_config);(backup/'TestMiniAppEntryPolicy.js').write_bytes(old_policy)
    try:
        config.write_text(cfg.replace(anchor,additions()+anchor,1))
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
        base='https://bot-test.utimoshi.ru'
        check(base+'/miniapp/',[200])
        published=check(base+'/telegram-web-app-59.js',[200])
        if published!=sdk:raise RuntimeError('Published SDK differs')
        check(base+'/api/tma/shared-preorder/catalog',[400,401],b'{"init_data":"invalid"}')
        check(base+'/api/v1/admin/users',[404])
        check(base+'/tma.html',[404])
        policy.write_text(src.replace(old_url,new_url,1))
        subprocess.run(['node','--check',str(policy)],check=True)
        subprocess.run(['systemctl','restart','softice-display-backend-8800.service'],check=True)
        subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],check=True)
        print('\nINSTALLED',new_url,'BACKUP',backup)
        print('Shared database remains; no payments, orders or customer records were changed by installer.')
    except Exception:
        config.write_bytes(old_config);policy.write_bytes(old_policy)
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'])
        subprocess.run(['systemctl','restart','softice-display-backend-8800.service'])
        raise

if __name__=='__main__':main()

