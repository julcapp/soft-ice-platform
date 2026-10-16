"""Narrow repair; supply official SDK downloaded with TLS verification. No DB writes."""
import pathlib,hashlib,shutil,datetime,sys,subprocess,json
root=pathlib.Path(sys.argv[1])
sdk=pathlib.Path(sys.argv[2])
expected='124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908'
assert hashlib.sha256(sdk.read_bytes()).hexdigest()==expected,'Official SDK checksum mismatch'
patch=json.loads("{\"old\":\"    const response = await fetch(`/api/tma/shared-preorder/${path}`, { method: 'POST',\\n      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, init_data: tg.initData }) });\\n    const payload = await response.json();\\n    if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Сервис временно недоступен.');\\n    return payload.data;\\n  }\",\"new\":\"    const controller = new AbortController();\\n    const timer = setTimeout(() => controller.abort(), 15000);\\n    try {\\n      const response = await fetch(`/api/tma/shared-preorder/${path}`, { method: 'POST', signal: controller.signal,\\n        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, init_data: tg.initData }) });\\n      const payload = await response.json();\\n      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Сервис временно недоступен.');\\n      return payload.data;\\n    } catch (error) {\\n      if (error.name === 'AbortError') throw new Error('Сервер отвечает дольше обычного. Повторите проверку. Если вы уже оплатили заказ, повторно платить не нужно.');\\n      throw error;\\n    } finally { clearTimeout(timer); }\\n  }\"}")
changes={}
p=root/'preorder-test.js'; text=p.read_text()
assert text.count(patch['old'])==1,'JS drift: inspect before patch'
changes[p]=text.replace(patch['old'],patch['new'],1)
p=root/'preorder-test.html'; text=p.read_text()
assert text.count('<script src="https://telegram.org/js/telegram-web-app.js"></script>')==1,'HTML drift'
text=text.replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>','<script defer src="/telegram-web-app-59.js"></script>')
text=text.replace('<main id="shared-preorder" class="app-shell"></main>','<main id="shared-preorder" class="app-shell"><p role="status">Загружаем приложение…</p></main>')
assert text.count('<script src="/preorder-test.js"></script>')==1
changes[p]=text.replace('<script src="/preorder-test.js"></script>','<script defer src="/preorder-test.js?v=startup-20261016"></script>')
p=root/'server.py'; text=p.read_text()
assert text.count('PUBLIC_GET_ROUTES = {')==1 and '"/telegram-web-app-59.js"' not in text,'Server drift'
changes[p]=text.replace('PUBLIC_GET_ROUTES = {','PUBLIC_GET_ROUTES = {\n    "/telegram-web-app-59.js",',1)
compile(changes[p],str(p),'exec')
backup=root.parent/('miniapp-startup-backup-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir()
for p in changes: shutil.copy2(p,backup/p.name)
dest=root/'telegram-web-app-59.js'
assert not dest.exists(),'SDK destination already exists'
try:
 shutil.copyfile(sdk,dest); dest.chmod(0o644)
 for p,text in changes.items(): p.write_text(text)
 subprocess.run(['sudo','-n','systemctl','restart','soft-ice-miniapp.service'],check=True)
 subprocess.run(['systemctl','is-active','soft-ice-miniapp.service'],check=True)
except Exception:
 for p in changes: shutil.copyfile(backup/p.name,p)
 subprocess.run(['sudo','-n','systemctl','restart','soft-ice-miniapp.service'])
 raise
print('REPAIRED',str(backup))
for p in list(changes)+[dest]:print(p.name,hashlib.sha256(p.read_bytes()).hexdigest())

