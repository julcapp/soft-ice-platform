from pathlib import Path
import hashlib,subprocess
p=Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend/src/modules/inventory/PostgresInventoryReservationService.js')
old=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='029f0383a464bcfd3259b049c9b335ad6797b376b6abd4ca3a35acc34f09b691','Source changed'
anchor='  async finish(reservationId, target, request = {}, context = {}) {'
assert old.count(anchor)==1
Path('/home/julcapp/inventory-reservation-before-key.js').write_text(old)
p.write_text(old.replace(anchor,anchor+'\n    context = { ...context, idempotencyKey: context.idempotencyKey || request.idempotencyKey };'))
subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['sudo','systemctl','restart','softice-display-backend-8800.service'],check=True)
subprocess.run(['systemctl','is-active','softice-display-backend-8800.service'],check=True)
print('Published reservation command-key fix')
