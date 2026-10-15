"""Install only mobile service modules and additive migrations; preserve live composition."""
import pathlib, os, sys, hashlib, subprocess, shutil, datetime, re, urllib.parse, urllib.request, urllib.error, time, uuid, tempfile
LIVE=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
CANDIDATE=pathlib.Path(__file__).resolve().parent.parent
SERVICE='softice-display-backend-8800.service'
EXPECTED={'src/main.js':'edadf4d72a6cea7c772a20b90cea57b9ef4586024e8bd6c25e7b61b6e3492b47','src/modules/operator_workspace/ServiceVisitService.js':'2b238dfeee9dc0de813b0a35dba5f3a0e50cc85811daef189685dceadf0dbc50'}
NEW=['src/modules/operator_workspace/ServiceDeviceBinding.js','src/modules/operator_workspace/ServiceMobileSession.js','src/api/v1/mobileServiceRoutes.js']
MIGRATIONS=['20261006000200_service_device_binding','20261006000300_mobile_service_sessions']
DROPIN=pathlib.Path('/etc/systemd/system/'+SERVICE+'.d/70-mobile-service.conf')
IMPORTS="const { ServiceDeviceBinding } = require('./modules/operator_workspace/ServiceDeviceBinding');\nconst { ServiceMobileSession } = require('./modules/operator_workspace/ServiceMobileSession');\nconst { createMobileServiceRouter } = require('./api/v1/mobileServiceRoutes');\n"
BLOCK="    if (serviceVisitService && process.env.SERVICE_MOBILE_ENABLED === 'true') {\n      const prisma = getPrismaClient();\n      const mobileSessions = new ServiceMobileSession({ prisma, adminAuthService, deviceBinding: new ServiceDeviceBinding({ prisma }) });\n      app.use('/api/v1/mobile-service', createMobileServiceRouter({ mobileSessions, serviceVisitService }));\n      const devices = new ServiceDeviceBinding({ prisma });\n      app.post('/api/v1/admin/service-devices/:memberId', require('./platform/http/apiResponse').asyncHandler(async (req, res) => require('./platform/http/apiResponse').sendData(res, req, await devices.register(req.params.memberId, req.body, req.securityContext), 201)));\n      app.post('/api/v1/admin/service-devices/:bindingId/revoke', require('./platform/http/apiResponse').asyncHandler(async (req, res) => require('./platform/http/apiResponse').sendData(res, req, await devices.revoke(req.params.bindingId, req.body?.reason, req.securityContext))));\n    }\n"

def run(args,env=None,data=None):
    r=subprocess.run(args,input=data,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
    if r.returncode: raise RuntimeError('Не выполнена команда '+args[0]+'; секреты не выводятся.')
    return r.stdout

def status(path,method='GET'):
    req=urllib.request.Request('http://127.0.0.1:8800'+path,data=b'{}' if method=='POST' else None,method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=3) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()

def main():
    for name,digest in EXPECTED.items():
        if hashlib.sha256((LIVE/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('Рабочий файл изменился: '+name)
    for name in NEW:
        if (LIVE/name).exists():raise RuntimeError('Файл уже установлен: '+name)
    if DROPIN.exists():raise RuntimeError('Настройка мобильного входа уже существует.')
    source=(LIVE/'src/main.js').read_text()
    anchor='    const serviceAccountAccess ='
    if source.count(anchor)!=1:raise RuntimeError('Неоднозначная точка подключения.')
    source=IMPORTS+source.replace(anchor,BLOCK+anchor,1)
    with tempfile.NamedTemporaryFile(suffix='.js') as f:
        f.write(source.encode());f.flush();run(['node','--check',f.name])
    for name in NEW+['src/modules/operator_workspace/ServiceVisitService.js']:run(['node','--check',str(CANDIDATE/name)])
    migrations=[]
    for name in MIGRATIONS:
        relative='prisma/migrations/'+name+'/migration.sql'
        if (LIVE/relative).exists():raise RuntimeError('Миграция уже установлена: '+name)
        data=(CANDIDATE/relative).read_bytes()
        tracking='INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,applied_steps_count) VALUES (\'%s\',\'%s\',NOW(),\'%s\',1);' % (uuid.uuid4(),hashlib.sha256(data).hexdigest(),name)
        migrations.append((relative,data+tracking.encode()))
    if '--apply' not in sys.argv:
        print('PASS: файлы, точки подключения и синтаксис проверены. База и служба не изменены.');return
    if os.geteuid()!=0:raise RuntimeError('Запустите sudo с --apply.')
    envtext=pathlib.Path('/etc/soft-ice-platform-v036.env').read_text()
    match=re.search(r'^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$',envtext,re.M)
    if not match:raise RuntimeError('Не найден DATABASE_URL.')
    url=urllib.parse.urlparse(match.group(1).strip().strip('"\''))
    env=os.environ.copy();env.update(PGHOST=url.hostname,PGPORT=str(url.port or 5432),PGDATABASE=url.path.lstrip('/'),PGUSER=urllib.parse.unquote(url.username),PGPASSWORD=urllib.parse.unquote(url.password))
    query='SELECT count(*) FROM information_schema.tables WHERE table_name IN (\'ServiceDeviceBinding\',\'ServiceMobileSession\',\'ServiceDeviceProofChallenge\');'
    if run(['psql','-Atc',query],env).decode().strip()!='0':raise RuntimeError('Мобильные таблицы уже существуют. Нужна сверка.')
    backup=pathlib.Path('/var/backups/soft-ice/mobile-service-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700)
    with (backup/'database.dump').open('wb') as f:
        r=subprocess.run(['docker','exec','-e','PGPASSWORD','utimoshi_postgres','pg_dump','--host=127.0.0.1','--username='+env['PGUSER'],'--dbname='+env['PGDATABASE'],'--format=custom'],env=env,stdout=f,stderr=subprocess.PIPE,timeout=120)
    if r.returncode or not (backup/'database.dump').stat().st_size:raise RuntimeError('Резервная копия БД не создана.')
    run(['docker','exec','-i','utimoshi_postgres','pg_restore','--list'],data=(backup/'database.dump').read_bytes())
    for name in EXPECTED:
        target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(LIVE/name,target)
    changed=False
    try:
        run(['psql','-v','ON_ERROR_STOP=1','--single-transaction'],env,data=b'\n'.join(data for _,data in migrations))
        changed=True
        for name in NEW+['src/modules/operator_workspace/ServiceVisitService.js']+[r for r,_ in migrations]:
            target=LIVE/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(CANDIDATE/name,target)
        (LIVE/'src/main.js').write_text(source)
        DROPIN.parent.mkdir(parents=True,exist_ok=True);DROPIN.write_text('[Service]\nEnvironment=SERVICE_MOBILE_ENABLED=true\n')
        run(['systemctl','daemon-reload']);run(['systemctl','restart',SERVICE])
        for _ in range(30):
            try:
                if status('/health')[0]==200:break
            except Exception:pass
            time.sleep(.5)
        else:raise RuntimeError('Health не прошёл проверку.')
        code,body=status('/api/v1/mobile-service/login','POST')
        if code!=401 or b'ADMIN_INVALID_CREDENTIALS' not in body:raise RuntimeError('Мобильный вход не прошёл проверку.')
        if status('/api/v1/mobile-service/workspace')[0]!=401:raise RuntimeError('Мобильный доступ не защищён.')
        code,body=status('/api/v1/admin/auth/login','POST')
        if code!=401 or b'ADMIN_INVALID_CREDENTIALS' not in body:raise RuntimeError('Администраторский вход не прошёл проверку.')
        print('PASS: мобильный вход, привязка смартфона и выбор роли установлены. Резервная копия:',backup)
    except Exception:
        if changed:
            for name in EXPECTED:shutil.copy2(backup/name,LIVE/name)
            for name in NEW:(LIVE/name).unlink(missing_ok=True)
            DROPIN.unlink(missing_ok=True);run(['systemctl','daemon-reload']);run(['systemctl','restart',SERVICE])
            print('Файлы и настройка возвращены. Добавленные таблицы сохранены; данные не удаляются.')
        raise
if __name__=='__main__':
    try:main()
    except Exception as e:print('Установка остановлена:',str(e));sys.exit(1)
