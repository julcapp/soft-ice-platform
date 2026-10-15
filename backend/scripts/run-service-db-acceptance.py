import json, os, pathlib, secrets, subprocess, tempfile, time

backend = pathlib.Path(__file__).resolve().parent.parent
container = 'softice-service-acceptance-' + secrets.token_hex(5)
password = secrets.token_hex(24)

def run(args, data=None, env=None, timeout_s=120):
    process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    started = time.monotonic()
    payload = data
    while True:
        try:
            output, errors = process.communicate(input=payload, timeout=8)
            break
        except subprocess.TimeoutExpired:
            payload = None
            print('Проверка продолжается…', flush=True)
            if time.monotonic() - started > timeout_s:
                process.kill()
                process.communicate()
                raise RuntimeError('Истекло время выполнения ' + args[0])
    if process.returncode:
        detail = (output + errors).decode(errors='replace').replace(password, '[secret]')[-1000:]
        raise RuntimeError('Команда проверки не выполнена: ' + ' '.join(args[:5]) + '\n' + detail)
    return output

try:
    print('Проверяем источник структуры базы…', flush=True)
    metadata = run(['docker', 'exec', 'utimoshi_postgres', 'sh', '-c', 'printf "%s\n%s\n" "$POSTGRES_USER" "$POSTGRES_DB"']).decode().splitlines()
    user = metadata[0] or 'postgres'
    database = metadata[1] or user
    names = run(['docker', 'exec', 'utimoshi_postgres', 'psql', '-U', user, '-d', 'postgres', '-Atc', 'SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn']).decode().splitlines()
    matches = []
    for name in names:
        print('Проверяем наличие таблиц авторизации…', flush=True)
        found = run(['docker', 'exec', 'utimoshi_postgres', 'psql', '-U', user, '-d', name, '-Atc', '''SELECT to_regclass('public."AdminUser"') IS NOT NULL''']).decode().strip()
        if found == 't':
            owner = run(['docker', 'exec', 'utimoshi_postgres', 'psql', '-U', user, '-d', name, '-Atc', '''SELECT EXISTS(SELECT 1 FROM "AdminUser" WHERE "id"='dc333c0c-389a-46c8-abc4-dc61f30f2c3f'::uuid AND "login"='julcapp')''']).decode().strip()
            if owner == 't':
                matches.append(name)
    if len(matches) != 1:
        raise RuntimeError('Не удалось однозначно определить базу владельца; совпадений: ' + str(len(matches)))
    database = matches[0]
    print('База владельца подтверждена. Копируем только структуру…', flush=True)
    schema = run(['docker', 'exec', 'utimoshi_postgres', 'pg_dump', '-U', user, '-d', database, '--schema-only', '--no-owner', '--no-privileges'])
    with tempfile.TemporaryDirectory(prefix='softice-db-acceptance-') as temp:
        envfile = pathlib.Path(temp) / 'postgres.env'
        envfile.write_text('POSTGRES_PASSWORD=' + password + '\nPOSTGRES_DB=service_acceptance\n')
        envfile.chmod(0o600)
        run(['docker', 'run', '-d', '--name', container, '--env-file', str(envfile), '-p', '127.0.0.1::5432', 'postgres:16'])
        print('Запущен отдельный тестовый контейнер…', flush=True)
        ready = False
        for attempt in range(40):
            if subprocess.run(['docker', 'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'service_acceptance'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                ready = True
                break
            time.sleep(0.5)
        if not ready:
            raise RuntimeError('Тестовая PostgreSQL не запустилась.')
        run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-v', 'ON_ERROR_STOP=1'], data=schema, timeout_s=240)
        print('Структура импортирована. Проверяем миграцию…', flush=True)
        migration = (backend / 'prisma/migrations/20261005000100_service_access_media_v1/migration.sql').read_bytes()
        existing = run(['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-Atc', '''SELECT to_regclass('public."ServiceVisit"') IS NOT NULL''']).decode().strip()
        if existing != 't':
            run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], data=migration)
        contacts = run(['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-Atc', '''SELECT count(*) FROM information_schema.columns WHERE table_name='Organization' AND column_name IN ('directorName','directorPosition')''']).decode().strip()
        if contacts == '0':
            run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], data=(backend / 'prisma/migrations/20261006000100_organization_contacts/migration.sql').read_bytes())
        elif contacts != '2':
            raise RuntimeError('Неполная миграция контактов.')
        for name, table in [('20261006000200_service_device_binding', 'ServiceDeviceBinding'), ('20261006000300_mobile_service_sessions', 'ServiceMobileSession')]:
            exists = run(['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-Atc', 'SELECT to_regclass(\'public."' + table + '"\') IS NOT NULL']).decode().strip()
            if exists != 't':
                run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'service_acceptance', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], data=(backend / 'prisma/migrations' / name / 'migration.sql').read_bytes())
        port = run(['docker', 'port', container, '5432/tcp']).decode().strip().rsplit(':', 1)[1]
        env = os.environ.copy()
        env['DATABASE_URL'] = 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/service_acceptance'
        output = run(['node', str(backend / 'scripts/service-db-acceptance.cjs')], env=env)
        print(output.decode().strip())
        print('Рабочая база использована только для чтения структуры. Тестовые данные созданы в отдельном контейнере.')
except Exception as error:
    print('FAIL:', str(error))
    raise SystemExit(1)
finally:
    subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
