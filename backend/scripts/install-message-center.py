import pathlib,hashlib,os,re,subprocess,urllib.parse,urllib.request,urllib.error,datetime,shutil,sys,time,uuid,tempfile
CANDIDATE=pathlib.Path(__file__).resolve().parents[1]
LIVE=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
WEB=pathlib.Path('/var/www/admin.utimoshi.ru')
DIST=CANDIDATE.parent/'frontend/admin-console/dist'
ENVFILE=pathlib.Path('/etc/softice/display-backend.env')
SERVICE='softice-display-backend-8800.service'
MIGRATION='prisma/migrations/20261008000100_message_center/migration.sql'
EXPECTED={'src/modules/crm/CrmDirectMessageSender.js': '38fdfbfd84c92fdc075984bdced33f92f0c28b08c88e1de408b6c1d8a16ff48c', 'src/modules/bot_core/BotTransportSender.js': 'b6148712cb752f145d639600f5cbda118f41c6922a63b2a8f2c51f504e947a33', 'src/modules/gift_transfer/NotificationOrchestrator.js': 'c70ac63ba28d7393b2808e8f78baee1614b879bf4af61b1741c75faa36ce6565', 'src/modules/promotion_engine/PromotionChannelWebhookDispatcher.js': '99a8565d0de8889887b3c8df682d2af3532291fd9b65b7b9f2c5f9f96354b344', 'src/platform/security/AdminSecurityDelivery.js': 'caa3d4da2b76422199a2e6818f5c17821c677ce7993067d61295ddd7b7653f74'}
STAGE={'src/modules/crm/CrmDirectMessageSender.js': '45c81187cb524e6a78ddb14fdaa554120bceafac0f339a9d15dc685576fdce55', 'src/modules/bot_core/BotTransportSender.js': '3a24fb47e5fe360c3fcffc8c451062601d3c1a3d4ce072cc4c5ee6f9aafb25b3', 'src/modules/gift_transfer/NotificationOrchestrator.js': '5067027ee2e1bbb9ee85f16944e2fdd7358015b20f8370deb3bfe4bd54543e79', 'src/modules/promotion_engine/PromotionChannelWebhookDispatcher.js': 'fad3b9f2ed386f0a0ddf999be3bc2dbbcf4493ffc8c9e6b56b9fb38da96e22a7', 'src/platform/security/AdminSecurityDelivery.js': 'ac93c2510bea59120dba240c31a4baab8b6f3f5fffb59c6653110d5c653fa0ca', 'src/modules/message_center/MessageJournal.js': 'c691c4040ec6efe0eb14033865d580281b7c15585db29f0164b340fc8d3a6d48', 'src/modules/message_center/MessageCenterService.js': '31e8423e0feb4df4a6baf0616910d4a947441f0706f16330e0655012a8a099e3', 'src/api/v1/messageCenterRoutes.js': 'a027d9bed5415a11f2e46b303318425ed3af9a9a706d1e5e8553c6d4454ce961', 'prisma/migrations/20261008000100_message_center/migration.sql': '9dfd2bca30aa46ecb09ab566908ec4f3f44f67217800db52dd10167f122efa90'}
WEBFILES={'index.html': '9c645316c98fd045c981571b4d281c31b07feab2d20465d5418db791fb5acf1f', 'assets/index-CM30WvMZ.js': 'be7aa945af416a6b582426623a6e9215fa138337e41afa9b5b4188448affb2c4', 'assets/index-BL_ooTvR.css': '952777e0473eab0d8bc92a768b0534ca9df5ca02f2a303cf6f115d1949799aef'}
MAIN_HASH='9a1cb2afa63ea3498fd7bdda539e00097deb0b1605bde5a7988d0287541daacd'
OLD_INDEX='0cf3db3953f8ad56a8d8f115d14597b7a7ec6188168a61e16f2007e183938bd0'
BLOCK="    if (process.env.MESSAGE_CENTER_ENABLED === 'true') {\n      const { MessageCenterService } = require('./modules/message_center/MessageCenterService');\n      const { createMessageCenterRouter } = require('./api/v1/messageCenterRoutes');\n      app.use('/api/v1/admin/messages', createMessageCenterRouter({ service: new MessageCenterService({ prisma: getPrismaClient() }) }));\n    }\n"
ANCHOR="    app.use('/api/v1', createAdminBearerContextMiddleware(adminAuthService));\n"

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run(args,env=None,data=None):
    result=subprocess.run(args,input=data,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
    if result.returncode:raise RuntimeError('Не выполнена команда '+args[0]+'. Секреты не выводятся.')
    return result.stdout

def status(path,method='GET'):
    req=urllib.request.Request('http://127.0.0.1:8800'+path,data=b'{}' if method=='POST' else None,method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=3) as response:return response.status,response.read()
    except urllib.error.HTTPError as error:return error.code,error.read()

def main():
    runtime_envfiles=run(['systemctl','show',SERVICE,'--property=EnvironmentFiles','--value']).decode()
    if str(ENVFILE) not in runtime_envfiles.split():raise RuntimeError('Файл настроек установщика не подключён к рабочему сервису.')
    for name,value in STAGE.items():
        if digest(CANDIDATE/name)!=value:raise RuntimeError('Изменилась проверенная сборка: '+name)
    for name,value in WEBFILES.items():
        if digest(DIST/name)!=value:raise RuntimeError('Изменилась проверенная панель: '+name)
    source=(LIVE/'src/main.js').read_text()
    installed=BLOCK in source
    for name,value in EXPECTED.items():
        expected=STAGE[name] if installed else value
        if digest(LIVE/name)!=expected:raise RuntimeError('Рабочий файл изменился: '+name)
    if installed:
        if digest(WEB/'index.html')!=WEBFILES['index.html']:raise RuntimeError('Backend установлен, панель отличается. Нужна сверка.')
        if status('/health')[0]!=200:raise RuntimeError('Health не прошёл проверку.')
        code,body=status('/api/v1/admin/messages')
        if code!=403 or b'MESSAGE_CENTER_ACCESS_DENIED' not in body:raise RuntimeError('API Центра сообщений не активен или не подтвердил защиту.')
        print('PASS: Центр сообщений уже установлен.');return
    for file in set(STAGE)-set(EXPECTED):
        if (LIVE/file).exists() and digest(LIVE/file)!=STAGE[file]:raise RuntimeError('Новый рабочий файл уже существует с другим содержимым: '+file)
    if digest(LIVE/'src/main.js')!=MAIN_HASH:raise RuntimeError('Рабочий main.js изменился; нужна повторная сверка.')
    if digest(WEB/'index.html')!=OLD_INDEX:raise RuntimeError('Рабочая панель изменилась; нужна повторная сверка.')
    if source.count(ANCHOR)!=1:raise RuntimeError('Неоднозначная точка подключения API.')
    source=source.replace(ANCHOR,ANCHOR+BLOCK,1)
    with tempfile.NamedTemporaryFile(suffix='.js') as handle:
        handle.write(source.encode());handle.flush();run(['node','--check',handle.name])
    for name in STAGE:
        if name.endswith('.js'):run(['node','--check',str(CANDIDATE/name)])
    if '--apply' not in sys.argv:
        print('PASS: совместимость файлов, сборка и синтаксис проверены. Рабочие файлы и БД не изменены.');return
    if os.geteuid()!=0:raise RuntimeError('Запустите установщик в root-терминале с --apply.')
    envtext=ENVFILE.read_text()
    match=re.search(r'^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$',envtext,re.M)
    if not match:raise RuntimeError('Не найден DATABASE_URL.')
    url=urllib.parse.urlparse(match.group(1).strip().strip('"\''))
    env=os.environ.copy();env.update(PGHOST=url.hostname,PGPORT=str(url.port or 5432),PGDATABASE=url.path.lstrip('/'),PGUSER=urllib.parse.unquote(url.username),PGPASSWORD=urllib.parse.unquote(url.password))
    checksum=STAGE[MIGRATION];name='20261008000100_message_center'
    tracked=run(['psql','-Atc',"SELECT checksum FROM \"_prisma_migrations\" WHERE migration_name='20261008000100_message_center' AND finished_at IS NOT NULL"],env).decode().strip()
    if tracked and tracked!=checksum:raise RuntimeError('Миграция уже существует с другим checksum.')
    if not tracked:
        count=run(['psql','-Atc',"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ProjectMessage','ProjectMessageDelivery','ProjectMessageDeliveryHistory')"],env).decode().strip()
        if count!='0':raise RuntimeError('Таблицы Центра сообщений уже существуют без миграции; нужна сверка.')
    backup=pathlib.Path('/var/backups/soft-ice/message-center-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True,mode=0o700)
    with (backup/'database.dump').open('wb') as handle:
        result=subprocess.run(['docker','exec','-e','PGPASSWORD','utimoshi_postgres','pg_dump','--host=127.0.0.1','--username='+env['PGUSER'],'--dbname='+env['PGDATABASE'],'--format=custom'],env=env,stdout=handle,stderr=subprocess.PIPE,timeout=120)
    if result.returncode or not (backup/'database.dump').stat().st_size:raise RuntimeError('Резервная копия БД не создана.')
    run(['docker','exec','-i','utimoshi_postgres','pg_restore','--list'],data=(backup/'database.dump').read_bytes())
    shutil.copytree(WEB,backup/'web');shutil.copy2(ENVFILE,backup/'runtime.env')
    originals=list(EXPECTED)+['src/main.js']
    for file in originals:
        target=backup/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(LIVE/file,target)
    changes=False
    try:
        if not tracked:
            sql=(CANDIDATE/MIGRATION).read_bytes()
            record="INSERT INTO \"_prisma_migrations\" (id,checksum,finished_at,migration_name,applied_steps_count) VALUES ('%s','%s',NOW(),'%s',1);"%(uuid.uuid4(),checksum,name)
            run(['psql','-v','ON_ERROR_STOP=1','--single-transaction'],env,data=sql+record.encode())
        changes=True
        for file in STAGE:
            target=LIVE/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(CANDIDATE/file,target)
        (LIVE/'src/main.js').write_text(source)
        flag=re.compile(r'^\s*(?:export\s+)?MESSAGE_CENTER_ENABLED\s*=.*$',re.M)
        updated=flag.sub('MESSAGE_CENTER_ENABLED=true',envtext) if flag.search(envtext) else envtext.rstrip()+'\nMESSAGE_CENTER_ENABLED=true\n'
        ENVFILE.write_text(updated)
        run(['systemctl','restart',SERVICE])
        for attempt in range(30):
            try:
                if status('/health')[0]==200:break
            except Exception:pass
            time.sleep(.5)
        else:raise RuntimeError('Health не прошёл проверку.')
        code,body=status('/api/v1/admin/messages')
        if code!=403 or b'MESSAGE_CENTER_ACCESS_DENIED' not in body:raise RuntimeError('API сообщений не подтвердил защиту доступа.')
        code,body=status('/api/v1/admin/auth/login','POST')
        if code!=401 or b'ADMIN_INVALID_CREDENTIALS' not in body:raise RuntimeError('Вход администратора не прошёл проверку.')
        shutil.copytree(DIST/'assets',WEB/'assets',dirs_exist_ok=True)
        shutil.copy2(DIST/'index.html',WEB/'index.next.html');(WEB/'index.next.html').replace(WEB/'index.html')
        if digest(WEB/'index.html')!=WEBFILES['index.html']:raise RuntimeError('Проверка панели не прошла.')
        print('PASS: Центр сообщений установлен. Резервная копия:',backup)
    except Exception:
        if changes:
            for file in originals:shutil.copy2(backup/file,LIVE/file)
            shutil.copy2(backup/'runtime.env',ENVFILE)
            shutil.copytree(backup/'web',WEB,dirs_exist_ok=True)
            run(['systemctl','restart',SERVICE])
            print('Рабочие файлы и настройки возвращены. Добавленные таблицы и сообщения сохранены.')
        raise
if __name__=='__main__':
    try:main()
    except Exception as error:print('Установка остановлена:',str(error));sys.exit(1)
