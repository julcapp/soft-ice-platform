import pathlib, hashlib, os, datetime, shutil
web = pathlib.Path('/var/www/admin.utimoshi.ru')
dist = pathlib.Path(__file__).resolve().parents[2] / 'frontend/admin-console/dist'
EXPECTED = {'index.html': '0cf3db3953f8ad56a8d8f115d14597b7a7ec6188168a61e16f2007e183938bd0', 'assets/index-CdX2nDmH.js': '950d8935d94ea92f1207eb7d42371aaad8fd5e17d968c6d918decba0d430870a', 'assets/index-DAJhoPU9.css': '618c3af0e359374067a9464c14e8b7b337e7ad4a615fc11f4fd5bf1bfe46e87b'}
OLD = '3307b21bafcbb72d786510badc820c82f83d4d31c31180933c44d21038cf2233'
if os.geteuid() != 0: raise SystemExit('Запустите в root-терминале.')
for name, digest in EXPECTED.items():
    if hashlib.sha256((dist / name).read_bytes()).hexdigest() != digest:
        raise SystemExit('Сборка отличается от проверенной: ' + name)
current = hashlib.sha256((web / 'index.html').read_bytes()).hexdigest()
if current == EXPECTED['index.html']:
    print('PASS: главное меню уже установлено.')
    raise SystemExit(0)
if current != OLD: raise SystemExit('Панель на сервере изменилась; нужна повторная сверка.')
backup = pathlib.Path('/var/backups/soft-ice/admin-main-menu-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
shutil.copytree(web, backup / 'web')
try:
    shutil.copytree(dist / 'assets', web / 'assets', dirs_exist_ok=True)
    shutil.copy2(dist / 'index.html', web / 'index.next.html')
    (web / 'index.next.html').replace(web / 'index.html')
    print('PASS: главное меню и сохранение перед переходом установлены. Резервная копия:', backup)
except Exception:
    shutil.copytree(backup / 'web', web, dirs_exist_ok=True)
    raise
