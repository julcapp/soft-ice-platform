import pathlib, hashlib, shutil, subprocess, datetime, os, sys

BASE = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
PAYLOAD = pathlib.Path('/home/julcapp/telegram-contact-payload')
EXPECTED = {
    'bot_core/TelegramRenderer.js': '3178aaf89e38947bcb408388ed336fd6a91cf829c4d24e905b30846253fa9ab5',
    'bot_core/TelegramAdapter.js': 'e8f236f6f0f9300e5a02a863e72aaf12ca4b2e353b5ecee8b9ed96ec42485bde',
    'bot_core/BotOnboardingService.js': 'd962193ef27c0e836d1331e16b7ed419b6bb33830d21952333213daa48189da0',
    'customer/CustomerService.js': '03cd5b23c282d7dfd66625e2e76ee8b20da483903140e990d8f708f7fe07613a',
    'customer/CustomerRuntime.js': 'e6eb37322593e6f18722d54ceea6dc38b47bfaac8b2dba3914b626be267d4e2e',
    'bot_core/BotRuntime.js': 'b3498f2964b3b563d294b9deed2c836b6a210cac2a8c247077d822240c2be753',
}

def main():
    replacements = {}
    for relative, digest in EXPECTED.items():
        target = BASE / 'src/modules' / relative
        current = target.read_bytes()
        if hashlib.sha256(current).hexdigest() != digest:
            raise RuntimeError('Исходный файл изменён: ' + relative)
        if relative.endswith('/BotRuntime.js'):
            text = current.decode()
            old = '    if (inbound.contact && this.terminalChannelChallengeService) {'
            new = "    if (channel === 'telegram' && inbound.contact && this.onboardingService?.verifyTelegramContact) {\n      view = await this.onboardingService.verifyTelegramContact({ channel, externalUserId: inbound.externalUserId, contact: inbound.contact, profile: inbound.profile, metadata: inbound.metadata });\n    } else if (inbound.contact && this.terminalChannelChallengeService) {"
            if text.count(old) != 1 or text.count('renderer.renderView(view);') != 1:
                raise RuntimeError('Структура BotRuntime изменилась')
            data = text.replace(old, new).replace('renderer.renderView(view);', 'renderer.renderView(view, { chatType: inbound.metadata?.chatType });').encode()
        else:
            data = (PAYLOAD / pathlib.Path(relative).name).read_bytes()
        replacements[target] = data
    if '--apply' not in sys.argv:
        print('PASS: исходные файлы совпадают. Для установки используйте --apply от root.')
        return
    if os.geteuid() != 0:
        raise RuntimeError('Установка требует root')
    backup = pathlib.Path('/var/backups/soft-ice/telegram-contact-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True, mode=0o700)
    for target in replacements:
        shutil.copy2(target, backup / target.name)
    try:
        for target, data in replacements.items():
            target.write_bytes(data)
            subprocess.run(['node', '--check', str(target)], check=True)
        subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'], check=True)
        subprocess.run(['curl', '-q', '--fail', '--silent', '--retry', '10', '--retry-connrefused', '--retry-delay', '1', '--max-time', '3', 'http://127.0.0.1:8800/health'], check=True)
    except Exception:
        for target in replacements:
            shutil.copy2(backup / target.name, target)
        subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'])
        raise
    print('\nPASS: запрос собственного контакта установлен. Резервная копия:', backup)

try:
    main()
except Exception as error:
    print('STOP:', str(error))
    sys.exit(1)
