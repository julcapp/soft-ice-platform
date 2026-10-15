import datetime, hashlib, os, pathlib, re, shutil, subprocess, time, urllib.parse, urllib.request, urllib.error, uuid
candidate = pathlib.Path(__file__).resolve().parent.parent
live = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
web = pathlib.Path('/var/www/admin.utimoshi.ru')
service = 'softice-display-backend-8800.service'
expected = {'prisma/schema.prisma':'5cb2c80482584c5504f36d280e8b8cd3a35533430f6177cd7fd31cbdb0f84160', 'src/api/v1/organizationRoutes.js':'a0870b79f90f13e8150ac534b68789f5ae2e668ee814ee35e9c8ea5faf259452', 'src/modules/organization/OrganizationService.js':'fb04716e80171b70d4e27eca9edfa705a1a6554837636e86eb0148c1162b2835', 'src/modules/organization/OrganizationRepository.js':'08d42e831f3476ac79bdd8bb518576ee69102fd4b967c545cfb252624b76365b'}
migration_name = '20261006000100_organization_contacts'
new_files = ['src/modules/organization/OrganizationRegistry.js', 'prisma/migrations/' + migration_name + '/migration.sql']
backup = None
changed = False

def run(args, env=None, data=None, cwd=None):
    result = subprocess.run(args, input=data, env=env, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError('Не выполнена команда ' + args[0] + '; секреты не выводятся.')
    return result.stdout

def status(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8800' + path, timeout=3) as response: return response.status
    except urllib.error.HTTPError as error: return error.code

try:
    if os.geteuid() != 0: raise RuntimeError('Запустите через sudo в терминале владельца.')
    for name, digest in expected.items():
        if hashlib.sha256((live / name).read_bytes()).hexdigest() != digest: raise RuntimeError('Рабочий файл изменился: ' + name + '. Требуется повторная сверка.')
    for name in new_files:
        if (live / name).exists(): raise RuntimeError('Новый файл уже существует: ' + name)
    for name in list(expected) + new_files:
        if name.endswith('.js'): run(['node', '--check', str(candidate / name)])
    schema = (live / 'prisma/schema.prisma').read_text()
    pattern = r'(model Organization\s*\{\n)'
    schema, count = re.subn(pattern, r'\1  directorName String?\n  directorPosition String?\n', schema)
    if count != 1: raise RuntimeError('Не удалось определить модель организации.')
    dist = candidate.parent / 'frontend/admin-console/dist'
    if not (dist / 'index.html').is_file(): raise RuntimeError('Панель не собрана.')
    envtext = pathlib.Path('/etc/soft-ice-platform-v036.env').read_text()
    match = re.search(r'^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$', envtext, re.M)
    if not match: raise RuntimeError('Конфигурация базы не найдена.')
    url = urllib.parse.urlparse(match.group(1).strip().strip('"\''))
    env = os.environ.copy()
    env['DATABASE_URL'] = match.group(1).strip().strip('"\'')
    env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGDATABASE=url.path.lstrip('/'), PGUSER=urllib.parse.unquote(url.username), PGPASSWORD=urllib.parse.unquote(url.password))
    backup = pathlib.Path('/var/backups/soft-ice/organization-details-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True, mode=0o700)
    dump = backup / 'database.dump'
    with dump.open('wb') as output:
        result = subprocess.run(['docker', 'exec', '-e', 'PGPASSWORD', 'utimoshi_postgres', 'pg_dump', '--host=127.0.0.1', '--username=' + env['PGUSER'], '--dbname=' + env['PGDATABASE'], '--format=custom'], env=env, stdout=output, stderr=subprocess.PIPE)
    if result.returncode or not dump.stat().st_size: raise RuntimeError('Резервная копия базы не создана.')
    run(['docker', 'exec', '-i', 'utimoshi_postgres', 'pg_restore', '--list'], data=dump.read_bytes())
    shutil.copytree(web, backup / 'admin-web')
    for name in expected:
        dest = backup / 'backend' / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(live / name, dest)
    shutil.copytree(live / 'node_modules/.prisma', backup / 'prisma-client')
    present = run(['psql', '-Atc', '''SELECT count(*) FROM information_schema.columns WHERE table_name='Organization' AND column_name IN ('directorName','directorPosition')'''], env=env).decode().strip()
    if present != '0': raise RuntimeError('Поля руководителя уже существуют; требуется сверка миграции.')
    migration = (candidate / new_files[1]).read_bytes()
    tracking = '''INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ('%s','%s',NOW(),'%s',1);''' % (uuid.uuid4(), hashlib.sha256(migration).hexdigest(), migration_name)
    run(['psql', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], env=env, data=migration + tracking.encode())
    changed = True
    (live / 'prisma/schema.prisma').write_text(schema)
    for name in [name for name in expected if name != 'prisma/schema.prisma'] + new_files:
        target = live / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate / name, target)
    run(['node', 'node_modules/prisma/build/index.js', 'generate'], cwd=live, env=env)
    shutil.copytree(dist, web, dirs_exist_ok=True)
    run(['systemctl', 'restart', service])
    for attempt in range(30):
        try:
            if status('/health') == 200: break
        except Exception: pass
        time.sleep(.5)
    else: raise RuntimeError('Служба не прошла проверку доступности.')
    if status('/api/v1/organizations/lookup/config') not in (401,403): raise RuntimeError('Поиск организаций не закрыт без входа.')
    print('PASS: выбор организаций, реквизиты руководителя и контакты установлены. Резервная копия:', backup)
    print('Обновите панель Ctrl+F5. Автозаполнение работает после настройки DADATA_API_TOKEN в окружении службы.')
except Exception as error:
    print('Установка остановлена:', str(error))
    if changed and backup:
        for name in expected: shutil.copy2(backup / 'backend' / name, live / name)
        for name in new_files: (live / name).unlink(missing_ok=True)
        shutil.rmtree(live / 'node_modules/.prisma', ignore_errors=True)
        shutil.copytree(backup / 'prisma-client', live / 'node_modules/.prisma')
        shutil.copytree(backup / 'admin-web', web, dirs_exist_ok=True)
        subprocess.run(['systemctl', 'restart', service])
        print('Прежние файлы возвращены. Добавленные поля базы сохранены, данные не удаляются.')
    raise SystemExit(1)
