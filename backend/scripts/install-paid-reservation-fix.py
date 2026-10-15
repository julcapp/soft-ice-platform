#!/usr/bin/env python3
import argparse,datetime,os,pathlib,shutil,subprocess,tempfile
ROOT=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
CHANGES={'src/modules/inventory/PostgresInventoryReservationService.js': [("const crypto = require('crypto');", "const { paidReservationProtection } = require('./PaidReservationPolicy');\nconst crypto = require('crypto');"), ("      if (target === 'CONSUMED' && new Date(current.expiresAt) <= this.clock()) throw problem('INVENTORY_RESERVATION_EXPIRED', 409, 'Истёкший резерв нельзя списать.');", "      const expired = new Date(current.expiresAt) <= this.clock();\n      const paidProtection = (target === 'EXPIRED' || (target === 'CONSUMED' && expired))\n        ? await paidReservationProtection(tx, current, target, context) : false;\n      if (target === 'EXPIRED' && paidProtection) return { reservation: current, heldForPaidOrder: true };\n      if (target === 'CONSUMED' && expired && !paidProtection) throw problem('INVENTORY_RESERVATION_EXPIRED', 409, 'Истёкший резерв нельзя списать без подтверждённой выдачи оплаченного заказа.');")], 'src/modules/machine_dispense/MachineDispenseService.js': [("if(!providerState||!['DISPENSED','FAILED','NOT_DISPENSED'].includes(providerState.status))", "if(providerState && ['SENT','ACCEPTED','DISPENSING'].includes(providerState.status))return {attempt,action:'PROVIDER_IN_PROGRESS'};if(!providerState||!['DISPENSED','FAILED','NOT_DISPENSED'].includes(providerState.status))")], 'src/modules/payment/TerminalCheckoutService.js': [('  async present(result, machineId) {', "  async present(result, machineId) {\n    const { classifyTerminalAttempt } = require('./TerminalFulfillmentState');"), ("        if (attempt && ['ACCEPTED', 'DISPENSING'].includes(attempt.status) && (attempt.acceptedAt || attempt.startedAt)) fulfillmentState = 'PREPARING';\n        else if (attempt && ['AUTHORIZED', 'QUEUED', 'DISPATCHING', 'SENT'].includes(attempt.status)) fulfillmentState = 'TRANSMITTING';\n        else if (flow.recoveryStatus === 'NEEDS_RECONCILIATION') fulfillmentState = 'ATTENTION_REQUIRED';", "        fulfillmentState = classifyTerminalAttempt(attempt);\n        if (fulfillmentState === 'WAITING' && flow.recoveryStatus === 'NEEDS_RECONCILIATION') fulfillmentState = 'ATTENTION_REQUIRED';")], 'src/modules/machine_dispense/TestMachineProviderAdapter.js': [('    this.timers = new Set();', '    this.timers = new Set();\n    this.commandFacts = new Map();'), ("    this.schedule(commandId, machineId, 'ACCEPTED'", "    this.commandFacts.set(commandId, 'SENT');\n    this.schedule(commandId, machineId, 'ACCEPTED'"), ("    return { status: 'UNKNOWN' };", "    const fact = this.commandFacts.get(commandId);\n    if (fact) return { status: fact, providerEventId: `test-fact-${commandId}-${fact}` };\n    const proof = await this.machineDispenseService.repository.prisma.machineReconciliation.findFirst({ where: {\n      organizationId: attempt.organizationId, dispenseAttemptId: attempt.id,\n      category: 'LOCAL_DISPENSED_PROVIDER_UNKNOWN',\n      detailsSafe: { path: ['persistenceFailure'], equals: 'INVENTORY_RESERVATION_EXPIRED' },\n    } });\n    if (proof) return { status: 'DISPENSED', providerEventId: `test-recovered-expiry-${commandId}` };\n    return { status: 'UNKNOWN' };"), ('        await this.machineDispenseService.applyPhysicalResult(attempt, status,', '        this.commandFacts.set(commandId, status);\n        await this.machineDispenseService.applyPhysicalResult(attempt, status,')]}
NEWFILES={'src/modules/inventory/PaidReservationPolicy.js': "async function paidReservationProtection(tx, reservation, target, context = {}) {\n  if (reservation.operationType !== 'CUSTOMER_SALE' || !reservation.orderId || !reservation.saleFlowId || !tx.payment?.findFirst) return false;\n  const payment = await tx.payment.findFirst({ where: { organizationId: reservation.organizationId, orderId: reservation.orderId, saleFlowId: reservation.saleFlowId, status: 'SUCCEEDED' }, select: { id: true } });\n  if (!payment) return false;\n  if (target === 'EXPIRED') return true;\n  if (target !== 'CONSUMED' || !context.transactionClient || !tx.machineDispenseAttempt?.findFirst) return false;\n  const prefix = 'machine-consume:';\n  if (!context.idempotencyKey?.startsWith(prefix)) return false;\n  const attempt = await tx.machineDispenseAttempt.findFirst({ where: { organizationId: reservation.organizationId, orderId: reservation.orderId, saleFlowId: reservation.saleFlowId, machineId: reservation.machineId, inventoryReservationId: reservation.reservationId, commandId: context.idempotencyKey.slice(prefix.length), status: 'DISPENSED' }, select: { id: true } });\n  return Boolean(attempt);\n}\nmodule.exports = { paidReservationProtection };\n", 'src/modules/payment/TerminalFulfillmentState.js': "function classifyTerminalAttempt(attempt) {\n  if (!attempt) return 'WAITING';\n  if (['RECONCILIATION_REQUIRED','TIMED_OUT','FAILED','CANCELED','DISPENSED'].includes(attempt.status)) return 'ATTENTION_REQUIRED';\n  if (['ACCEPTED','DISPENSING'].includes(attempt.status) && (attempt.acceptedAt || attempt.startedAt)) return 'PREPARING';\n  if (['AUTHORIZED','QUEUED','DISPATCHING','SENT'].includes(attempt.status)) return 'TRANSMITTING';\n  return 'WAITING';\n}\nmodule.exports = { classifyTerminalAttempt };\n"}

p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');args=p.parse_args()
candidates={}
for name,changes in CHANGES.items():
 text=(ROOT/name).read_text()
 for before,after in changes:
  if text.count(before)!=1:raise SystemExit('STOP: исходники изменились: '+name)
  text=text.replace(before,after,1)
 candidates[name]=text
for name,text in NEWFILES.items():
 if (ROOT/name).exists():raise SystemExit('STOP: вспомогательный модуль уже существует: '+name)
 candidates[name]=text
with tempfile.TemporaryDirectory() as folder:
 for i,(name,text) in enumerate(candidates.items()):
  path=pathlib.Path(folder)/(str(i)+'.js');path.write_text(text);subprocess.run(['node','--check',str(path)],check=True)
print('PASS: совместимость и синтаксис серверных файлов проверены.')
if not args.apply:raise SystemExit(0)
backup=pathlib.Path('/home/julcapp/softice-deploy-backups/paid-reservation-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700)
for name in candidates:
 path=ROOT/name
 if path.exists():
  target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
def restart():subprocess.run(['sudo','-n','/usr/bin/systemctl','restart','softice-display-backend-8800.service'],check=True)
try:
 for name,text in candidates.items():
  path=ROOT/name;path.write_text(text)
  if name in NEWFILES:path.chmod(0o640)
 restart()
 subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],check=True,stdout=subprocess.DEVNULL)
 print('PASS: защита оплаченного резерва и статусы установлены. Резервная копия:',backup)
except Exception:
 for name in candidates:
  saved=backup/name;path=ROOT/name
  if saved.exists():shutil.copy2(saved,path)
  elif path.exists():path.unlink()
 restart();raise
