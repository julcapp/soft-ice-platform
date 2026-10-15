import hashlib,base64,subprocess,datetime,os
from pathlib import Path
root=Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend/src/modules/bot_core')
patches=[('TelegramRenderer.js', '05356040deb21297cbde07b62ae6056b7c8322e273077deb787299a215f6a2f6', [('constructor({ features = {} } = {})', 'constructor({ features = {}, miniAppEntryPolicy = action => action } = {})'), ('    super();', '    super();\n    this.miniAppEntryPolicy = miniAppEntryPolicy;'), ('renderView(view, { chatType = null } = {})', 'renderView(view, { chatType = null, externalUserId = null } = {})'), ('    const base = super.renderView(view);', '    const base = super.renderView(view);\n    base.actions = base.actions.map(action => this.miniAppEntryPolicy(action, { chatType, externalUserId }));')]), ('BotRuntime.js', '1338e60a88db739006b0906c9db4b38196739c1093a86add9d2c4c1cbed8e208', [('renderer.renderView(view, { chatType: inbound.metadata?.chatType })', 'renderer.renderView(view, { chatType: inbound.metadata?.chatType, externalUserId: inbound.externalUserId })')]), ('createBotRuntimeComposition.js', '7b28d612bf16f20c68616130f63a1fc7efbaedd50c978a631b08f3251f2c9412', [("const { TelegramRenderer } = require('./TelegramRenderer');", "const { TelegramRenderer } = require('./TelegramRenderer');\nconst { createTestMiniAppEntryPolicy } = require('./TestMiniAppEntryPolicy');"), ('new TelegramRenderer({ features: clients.telegram?.features })', 'new TelegramRenderer({ features: clients.telegram?.features, miniAppEntryPolicy: createTestMiniAppEntryPolicy({ token: clients.telegram?.token, env }) })')])]
policy='Y29uc3QgZnMgPSByZXF1aXJlKCdub2RlOmZzJyk7CgpmdW5jdGlvbiBjcmVhdGVUZXN0TWluaUFwcEVudHJ5UG9saWN5KHsgdG9rZW4sIGVudiA9IHByb2Nlc3MuZW52LCByZWFkQ29uZmlnID0gcmVhZFRlc3RDb25maWcgfSA9IHt9KSB7CiAgcmV0dXJuIChhY3Rpb24sIHsgY2hhdFR5cGUsIGV4dGVybmFsVXNlcklkIH0gPSB7fSkgPT4gewogICAgaWYgKGVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nIHx8IGNoYXRUeXBlICE9PSAncHJpdmF0ZScgfHwgIWV4dGVybmFsVXNlcklkIHx8IGFjdGlvbi50eXBlICE9PSAnb3Blbl9taW5pX2FwcCcpIHJldHVybiBhY3Rpb247CiAgICBsZXQgY29uZmlnOwogICAgdHJ5IHsgY29uZmlnID0gcmVhZENvbmZpZygpOyB9IGNhdGNoIHsgcmV0dXJuIGFjdGlvbjsgfQogICAgaWYgKCF0b2tlbiB8fCB0b2tlbiAhPT0gY29uZmlnLnRva2VuIHx8ICF0b2tlbi5zdGFydHNXaXRoKCc1NzI4OTgwNzk6JykgfHwgIWNvbmZpZy5hbGxvd2VkVXNlcklkcy5oYXMoU3RyaW5nKGV4dGVybmFsVXNlcklkKSkpIHJldHVybiBhY3Rpb247CiAgICBsZXQgcHJldmlvdXM7CiAgICB0cnkgeyBwcmV2aW91cyA9IG5ldyBVUkwoYWN0aW9uLnVybCk7IH0gY2F0Y2ggeyByZXR1cm4gYWN0aW9uOyB9CiAgICBpZiAocHJldmlvdXMucHJvdG9jb2wgIT09ICdodHRwczonIHx8ICFbJ2FwcC51dGltb3NoaS5ydScsICdtaW5pYXBwLnV0aW1vc2hpLnJ1J10uaW5jbHVkZXMocHJldmlvdXMuaG9zdG5hbWUpKSByZXR1cm4gYWN0aW9uOwogICAgLy8gUm91dGUgdGhlIFRFU1QgYnV5ZXIgdG8gdGhlIHNoYXJlZCBzZXJ2ZXItYmFja2VkIGFjY291bnQsIHByZXNlcnZpbmcgY29udGV4dC4KICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoJ2h0dHBzOi8vbWluaWFwcC51dGltb3NoaS5ydS9wcmVvcmRlci10ZXN0Lmh0bWwnKTsKICAgIHVybC5zZWFyY2ggPSBwcmV2aW91cy5zZWFyY2g7CiAgICByZXR1cm4geyAuLi5hY3Rpb24sIHVybDogdXJsLmhyZWYgfTsKICB9Owp9CgpmdW5jdGlvbiByZWFkVGVzdENvbmZpZygpIHsKICBjb25zdCB2YWx1ZXMgPSB7fTsKICBmb3IgKGNvbnN0IGxpbmUgb2YgZnMucmVhZEZpbGVTeW5jKCcvZXRjL3NvZnRpY2UvbWluaWFwcC10ZXN0LWF1dGguZW52JywgJ3V0ZjgnKS5zcGxpdCgvXHI/XG4vKSkgewogICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eKFRFTEVHUkFNX1RFU1RfQk9UX1RPS0VOfFRFTEVHUkFNX1RFU1RfQUxMT1dFRF9VU0VSX0lEUyk9KC4qKSQvKTsKICAgIGlmIChtYXRjaCkgdmFsdWVzW21hdGNoWzFdXSA9IG1hdGNoWzJdLnRyaW0oKS5yZXBsYWNlKC9eKFsnIl0pKC4qKVwxJC8sICckMicpOwogIH0KICByZXR1cm4geyB0b2tlbjogdmFsdWVzLlRFTEVHUkFNX1RFU1RfQk9UX1RPS0VOLAogICAgYWxsb3dlZFVzZXJJZHM6IG5ldyBTZXQoU3RyaW5nKHZhbHVlcy5URUxFR1JBTV9URVNUX0FMTE9XRURfVVNFUl9JRFMgfHwgJycpLnNwbGl0KCcsJykubWFwKHggPT4geC50cmltKCkpLmZpbHRlcihCb29sZWFuKSkgfTsKfQoKbW9kdWxlLmV4cG9ydHMgPSB7IGNyZWF0ZVRlc3RNaW5pQXBwRW50cnlQb2xpY3kgfTsK'
prepared=[]
new=root/'TestMiniAppEntryPolicy.js'
if new.exists():raise SystemExit('STOP: policy already exists')
for name,digest,replacements in patches:
 target=root/name
 original=target.read_bytes()
 if hashlib.sha256(original).hexdigest()!=digest:raise SystemExit('STOP: source changed: '+name)
 content=original.decode()
 for before,after in replacements:
  if content.count(before)!=1:raise SystemExit('STOP: unexpected source: '+name)
  content=content.replace(before,after)
 prepared.append((target,original,content.encode()))
backup=Path('/home/julcapp/softice-deploy-backups')/('test-entry-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700)
for target,original,_ in prepared:(backup/target.name).write_bytes(original)
try:
 new.write_bytes(base64.b64decode(policy))
 os.chown(new,-1,(root/'TelegramRenderer.js').stat().st_gid)
 new.chmod(0o640)
 for target,_,content in prepared:target.write_bytes(content)
 for target in [new]+[x[0] for x in prepared]:subprocess.run(['node','--check',str(target)],check=True)
 subprocess.run(['sudo','-n','/usr/bin/systemctl','restart','softice-display-backend-8800.service'],check=True)
 subprocess.run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],check=True)
 print('APPLIED: TEST-only shared Mini App entry')
except Exception:
 for target,original,_ in prepared:target.write_bytes(original)
 new.unlink(missing_ok=True)
 subprocess.run(['sudo','-n','/usr/bin/systemctl','restart','softice-display-backend-8800.service'],check=False)
 raise
