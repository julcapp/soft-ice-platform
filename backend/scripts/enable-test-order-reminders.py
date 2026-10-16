"""Enable encrypted recipient bindings for TEST reminders; never prints the key."""
import os,pathlib,secrets,base64,subprocess,datetime,shutil
if os.geteuid()!=0:raise SystemExit('Run with sudo on 78.140.15.84')
p=pathlib.Path('/etc/softice/display-backend.env');text=p.read_text()
if not any(line.startswith('BOT_RECIPIENT_ENCRYPTION_KEY=') for line in text.splitlines()):
 backup=pathlib.Path('/root/softice-config-backups');backup.mkdir(exist_ok=True,mode=0o700)
 target=backup/('display-backend-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.env')
 shutil.copyfile(p,target);target.chmod(0o600)
 key=base64.b64encode(secrets.token_bytes(32)).decode()
 p.write_text(text.rstrip()+'\nBOT_RECIPIENT_ENCRYPTION_KEY='+key+'\n')
 print('Encrypted recipient binding key configured; existing settings preserved.')
else:
 print('Existing key preserved.')
subprocess.run(['systemctl','restart','softice-display-backend-8800.service'],check=True)
subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],check=True)
print('\nTEST reminder configuration ready. Send a new /start to record a verified private channel.')

