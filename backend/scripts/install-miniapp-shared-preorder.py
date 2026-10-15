"""Guarded installer. Run --check as julcapp; --apply needs root for Mini App restart."""
import argparse
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import json
import time
import hmac
import hashlib
import grp
from urllib.parse import urlencode

def is_expected_test_bot(bot):
    return bot.get('id') == 572898079 and str(bot.get('username', '')).lower() == 'exgorod_bot'

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
bundle = Path(__file__).resolve().parents[2]
target = Path('/home/julcapp/soft-ice-worktrees/display-product-v1')
legacy = Path('/home/julcapp/soft-ice-platform/releases/v0.35.1/work_v0.35.1')
new = [
 'backend/src/modules/order/MiniAppPreorderService.js',
 'backend/src/modules/payment/PreorderFulfillmentPolicy.js',
 'backend/src/api/v1/miniAppTestPreorderRoutes.js',
]
candidates = {target / name: (bundle / name).read_text() for name in new}
for name in ['preorder-test.html', 'preorder-test.js', 'shared_preorder_proxy.py']:
    candidates[legacy / name] = (bundle / 'legacy/soft-ice-miniapp-v0.35.1' / name).read_text()

def replace_once(path, old, new):
    source = candidates.get(path, path.read_text())
    if source.count(old) != 1:
        raise SystemExit('STOP: unexpected source at ' + str(path))
    candidates[path] = source.replace(old, new, 1)

replace_once(target / 'backend/src/api/v1/index.js',
 "  router.use('/auth', createAuthRouter(runtimeDependencies));",
 "  router.use('/miniapp-test-preorders', require('./miniAppTestPreorderRoutes').createMiniAppTestPreorderRouter(runtimeDependencies));\n  router.use('/auth', createAuthRouter(runtimeDependencies));")
replace_once(target / 'backend/src/modules/payment/PaymentService.js',
 '    if (this.machineDispense) await this.machineDispense.createAuthorizedFromPaidFlow(tx,paidFlow,payment,context);',
 "    const pickupPolicy = require('./PreorderFulfillmentPolicy');\n    if (pickupPolicy.isPickupPreorder(flow)) {\n      await tx.order.update({ where: { id: payment.orderId }, data: { expiresAt: pickupPolicy.pickupExpiry(flow, now) } });\n      await tx.saleFlow.update({ where: { flowId: flow.flowId }, data: { expiresAt: pickupPolicy.pickupExpiry(flow, now), recoveryStatus: 'NONE' } });\n    } else if (this.machineDispense) await this.machineDispense.createAuthorizedFromPaidFlow(tx,paidFlow,payment,context);")
replace_once(legacy / 'server.py', 'from urllib.request import Request, urlopen',
 'from urllib.request import Request, urlopen\nfrom shared_preorder_proxy import request_preorder')
replace_once(legacy / 'server.py', 'PUBLIC_GET_ROUTES = {',
 'PUBLIC_GET_ROUTES = {\n    "/preorder-test.html",\n    "/preorder-test.js",')
replace_once(legacy / 'server.py', '            if route not in PUBLIC_POST_ROUTES:',
 '            if route not in PUBLIC_POST_ROUTES and not route.startswith("/api/tma/shared-preorder/"):')
replace_once(legacy / 'server.py', '            if route == "/api/tma/auth":',
 '            if route.startswith("/api/tma/shared-preorder/"):\n                result = request_preorder(route.removeprefix("/api/tma/shared-preorder/"), payload)\n            elif route == "/api/tma/auth":')

for path in candidates:
    if path.name in ['MiniAppPreorderService.js', 'PreorderFulfillmentPolicy.js', 'miniAppTestPreorderRoutes.js',
                     'preorder-test.html', 'preorder-test.js', 'shared_preorder_proxy.py'] and path.exists():
        raise SystemExit('STOP: target already exists: ' + str(path))
with tempfile.TemporaryDirectory() as directory:
    for index, (path, source) in enumerate(candidates.items()):
        if path.suffix == '.py':
            compile(source, str(path), 'exec')
        elif path.suffix == '.js':
            temporary = Path(directory) / f'{index}.js'
            temporary.write_text(source)
            subprocess.run(['node', '--check', str(temporary)], check=True)
print('CHECK_OK: candidate sources valid; no deployment yet')
if not args.apply:
    raise SystemExit(0)
if os.geteuid() != 0:
    raise SystemExit('Root required to restart soft-ice-miniapp.service')

backup = Path('/var/backups/soft-ice') / ('shared-preorder-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
originals = {}
menus = []
auth_path = Path('/etc/softice/miniapp-test-auth.env')
auth_stat = auth_path.stat()
runtime_gid = grp.getgrnam('softice-runtime').gr_gid

def auth_settings():
    values = {}
    for line in Path('/etc/softice/miniapp-test-auth.env').read_text().splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            if key in ['TELEGRAM_TEST_BOT_TOKEN', 'TELEGRAM_TEST_ALLOWED_USER_IDS']:
                values[key] = value.strip().strip('\"\'')
    return values

def telegram(token, method, payload):
    try:
        request = urllib.request.Request('https://api.telegram.org/bot' + token + '/' + method,
            data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        if not result.get('ok'):
            raise RuntimeError('TEST_MENU_CONFIGURATION_FAILED')
        return result['result']
    except Exception:
        raise RuntimeError('TEST_MENU_CONFIGURATION_FAILED') from None
for index, path in enumerate(candidates):
    originals[path] = path.read_bytes() if path.exists() else None
    if path.exists():
        shutil.copy2(path, backup / str(index))
(backup / 'paths.txt').write_text('\n'.join(str(x) for x in candidates))
try:
    # The backend runs as softice, not root. Grant only its runtime group access
    # to the existing TEST-only key file; restore its metadata on rollback.
    os.chown(auth_path, auth_stat.st_uid, runtime_gid)
    auth_path.chmod(0o640)
    for path, source in candidates.items():
        path.write_text(source)
        if originals[path] is None:
            parent = path.parent.stat()
            os.chown(path, parent.st_uid, parent.st_gid)
            path.chmod(0o640)
    readable = [str(path) for path in candidates if str(path).startswith(str(target))] + [str(auth_path)]
    subprocess.run(['runuser', '-u', 'softice', '--', 'node', '-e',
        "const fs=require('fs');for(const p of process.argv.slice(1))fs.accessSync(p,fs.constants.R_OK);", *readable], check=True)
    for service in ['softice-display-backend-8800.service', 'soft-ice-miniapp.service']:
        subprocess.run(['systemctl', 'restart', service], check=True)
    for url in ['http://127.0.0.1:8800/health', 'http://127.0.0.1:8780/preorder-test.html']:
        subprocess.run(['curl', '--fail', '--silent', '--retry', '8', '--retry-connrefused', '--retry-delay', '1', url], check=True, stdout=subprocess.DEVNULL)
    settings = auth_settings()
    token = settings['TELEGRAM_TEST_BOT_TOKEN']
    ids = [int(x) for x in settings['TELEGRAM_TEST_ALLOWED_USER_IDS'].split(',') if x.strip()]
    if not ids or not is_expected_test_bot(telegram(token, 'getMe', {})):
        raise RuntimeError('EXPECTED_TEST_BOT_NOT_CONFIRMED')
    fields = {'auth_date': str(int(time.time())), 'user': json.dumps({'id': ids[0]}, separators=(',', ':'))}
    secret = hmac.new(b'WebAppData', token.encode(), hashlib.sha256).digest()
    check = '\n'.join(key + '=' + fields[key] for key in sorted(fields))
    fields['hash'] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    request = urllib.request.Request('http://127.0.0.1:8780/api/tma/shared-preorder/catalog',
        data=json.dumps({'init_data': urlencode(fields)}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        catalog = json.load(response)['data']
    if catalog['machine']['id'] != 'TEST-MACHINE-001':
        raise RuntimeError('TEST_CATALOG_SCOPE_MISMATCH')
    for chat_id in ids:
        previous = telegram(token, 'getChatMenuButton', {'chat_id': chat_id})
        menus.append((chat_id, previous))
        telegram(token, 'setChatMenuButton', {'chat_id': chat_id, 'menu_button': {'type': 'web_app',
            'text': 'Предзаказ', 'web_app': {'url': 'https://miniapp.utimoshi.ru/preorder-test.html'}}})
    print('APPLIED: TEST-only preorder; primary Mini App unchanged. Backup:', backup)
except Exception:
    os.chown(auth_path, auth_stat.st_uid, auth_stat.st_gid)
    auth_path.chmod(auth_stat.st_mode & 0o777)
    for chat_id, menu in menus:
        try:
            telegram(token, 'setChatMenuButton', {'chat_id': chat_id, 'menu_button': menu})
        except Exception:
            print('TEST_MENU_ROLLBACK_REQUIRES_CHECK')
    for path, data in originals.items():
        if data is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(data)
    for service in ['softice-display-backend-8800.service', 'soft-ice-miniapp.service']:
        subprocess.run(['systemctl', 'restart', service], check=False)
    raise
