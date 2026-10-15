#!/usr/bin/env python3
import ast,datetime,hashlib,hmac,json,os,pathlib,re,shutil,subprocess,tempfile,time,urllib.request,urllib.parse
SOURCE=pathlib.Path('/home/julcapp/soft-ice-platform/releases/v0.35.1/work_v0.35.1/server.py')
ENV=pathlib.Path('/etc/softice/miniapp-test-auth.env')
DROP=pathlib.Path('/etc/systemd/system/soft-ice-miniapp.service.d/40-test-auth.conf')
SERVICE='soft-ice-miniapp.service'
CHANGES=[('TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()', 'TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()\nTELEGRAM_TEST_BOT_TOKEN = os.environ.get("TELEGRAM_TEST_BOT_TOKEN", "").strip()\nTELEGRAM_TEST_ALLOWED_USER_IDS = frozenset(value.strip() for value in os.environ.get("TELEGRAM_TEST_ALLOWED_USER_IDS", "").split(",") if value.strip())'), ('    if provider == "telegram" and TELEGRAM_BOT_TOKEN:\n        return validate_telegram_init_data(raw, TELEGRAM_BOT_TOKEN), "telegram"\n', '    if provider == "telegram" and (TELEGRAM_BOT_TOKEN or TELEGRAM_TEST_BOT_TOKEN):\n        if TELEGRAM_BOT_TOKEN:\n            try:\n                return validate_telegram_init_data(raw, TELEGRAM_BOT_TOKEN), "telegram"\n            except ValueError as error:\n                if str(error) != "Подпись Telegram недействительна":\n                    raise\n        if TELEGRAM_TEST_BOT_TOKEN and TELEGRAM_TEST_ALLOWED_USER_IDS:\n            user = validate_telegram_init_data(raw, TELEGRAM_TEST_BOT_TOKEN)\n            if str(user["id"]) not in TELEGRAM_TEST_ALLOWED_USER_IDS:\n                raise ValueError("Тестовый вход недоступен этому пользователю")\n            return user, "telegram"\n        raise ValueError("Подпись Telegram недействительна")\n')]

if os.geteuid()!=0:raise SystemExit('Запустите в root-терминале.')
s=SOURCE.read_text()
for before,after in CHANGES:
 if s.count(before)!=1:raise SystemExit('Исходники изменились: необходима повторная сверка.')
 s=s.replace(before,after,1)
compile(s,str(SOURCE),'exec')
text=pathlib.Path('/home/julcapp/soft-ice-bot-test/backend/.env').read_text()
lines=[line.split('=',1)[1].strip().strip('"').strip("'") for line in text.splitlines() if line.startswith('TELEGRAM_TEST_BOT_TOKEN=')]
if len(lines)!=1 or not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]+',lines[0]):raise SystemExit('Тестовый токен отсутствует или имеет неверный формат.')
token=lines[0]
try:
 response=json.load(urllib.request.urlopen(urllib.request.Request('https://api.telegram.org/bot'+token+'/getMe',data=b'{}',headers={'Content-Type':'application/json'}),timeout=15))
except Exception:raise SystemExit('Не удалось проверить тестового бота; изменения не применены.')
if str(response.get('result',{}).get('username','')).lower()!='exgorod_bot':raise SystemExit('Токен не принадлежит @exgorod_bot.')
backup=pathlib.Path('/var/backups/soft-ice/miniapp-test-auth-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700)
paths=[SOURCE,ENV,DROP];existed={str(p):p.exists() for p in paths}
for i,p in enumerate(paths):
 if p.exists():shutil.copy2(p,backup/str(i))
try:
 SOURCE.write_text(s)
 ENV.parent.mkdir(parents=True,exist_ok=True);ENV.write_text('TELEGRAM_TEST_BOT_TOKEN='+token+'\nTELEGRAM_TEST_ALLOWED_USER_IDS=93614095\n');ENV.chmod(0o600)
 DROP.parent.mkdir(parents=True,exist_ok=True);DROP.write_text('[Service]\nEnvironmentFile=/etc/softice/miniapp-test-auth.env\n')
 subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart',SERVICE],check=True)
 subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8780/'],check=True,stdout=subprocess.DEVNULL)
 values={'auth_date':str(int(time.time())),'user':json.dumps({'id':93614095})}
 key=hmac.new(b'WebAppData',token.encode(),hashlib.sha256).digest();values['hash']=hmac.new(key,'\n'.join(f'{k}={values[k]}' for k in sorted(values)).encode(),hashlib.sha256).hexdigest()
 payload={'platform':'telegram','init_data':urllib.parse.urlencode(values)}
 req=urllib.request.Request('http://127.0.0.1:8780/api/tma/auth',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=10) as result:
  if result.status!=200:raise RuntimeError('Test Mini App authentication failed.')
 print('PASS: вход @exgorod_bot подтверждён запросом к Mini App. Основной токен не изменён. Резервная копия:',backup)
except Exception:
 for i,p in enumerate(paths):
  if existed[str(p)]:shutil.copy2(backup/str(i),p)
  elif p.exists():p.unlink()
 subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart',SERVICE],check=True)
 raise SystemExit('Проверка не прошла: изменения отменены; файлы восстановлены.')
