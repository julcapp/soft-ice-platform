import pathlib,subprocess,shutil,datetime
root=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend/src/modules/payment')
p=root/'TerminalCheckoutService.js';s=p.read_text()
a='    return {\n      paymentId: payment.id,'
b="    if (payment.status === 'REFUNDED') fulfillmentState = 'ATTENTION_REQUIRED';\n"+a
if s.count(a)!=1:raise SystemExit('STOP: исходник изменился.')
backup=pathlib.Path('/home/julcapp/softice-deploy-backups/refunded-fulfillment-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700);shutil.copy2(p,backup/'TerminalCheckoutService.js')
try:
 p.write_text(s.replace(a,b,1));subprocess.run(['node','--check',str(p)],check=True)
 subprocess.run(['sudo','-n','/usr/bin/systemctl','restart','softice-display-backend-8800.service'],check=True)
 subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],check=True,stdout=subprocess.DEVNULL)
 print('PASS: возврат исключает ожидание выдачи.')
except Exception:
 shutil.copy2(backup/'TerminalCheckoutService.js',p);subprocess.run(['sudo','-n','/usr/bin/systemctl','restart','softice-display-backend-8800.service'],check=True);raise
