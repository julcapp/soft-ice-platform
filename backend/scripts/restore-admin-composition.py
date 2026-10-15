"""Restore service/admin composition without replacing payment or webhook code."""
import pathlib, hashlib, subprocess, tempfile, os, sys, shutil, datetime, time, urllib.request, urllib.error
LIVE = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
EXPECTED = '9362e8b7abdc04647daeaa85f495c3441b7fef2aa375162aa0c1b319cd5432c7'
SERVICE = 'softice-display-backend-8800.service'
IMPORTS = "const { createAdminAuthRouter, createAdminBearerContextMiddleware } = require('./api/v1/adminAuthRoutes');\nconst { AdminAuthService } = require('./platform/security/AdminAuthService');\nconst { AdminSecurityDelivery } = require('./platform/security/AdminSecurityDelivery');\nconst { createServiceWorkspaceRouter } = require('./api/v1/serviceWorkspaceRoutes');\nconst { ServiceVisitService } = require('./modules/operator_workspace/ServiceVisitService');\nconst { LocalPhotoStorageAdapter } = require('./modules/photo_verification/LocalPhotoStorageAdapter');\nconst { ServiceAccountAccess } = require('./modules/operator_workspace/ServiceAccountAccess');\nconst { createServiceAccountRouter } = require('./api/v1/serviceAccountRoutes');\nconst { AuditRepository } = require('./platform/audit/AuditRepository');\n"
SETUP = '  const adminAuthService = options.adminAuthService || dependencies.adminAuthService || (!options.dependencies && new AdminAuthService({\n    prisma: getPrismaClient(), auditRepository: new AuditRepository(getPrismaClient()),\n    securityDelivery: new AdminSecurityDelivery(),\n  }));\n  dependencies.adminAuthService = adminAuthService || null;\n  dependencies.adminAuth = dependencies.adminAuth || { environment: config.environment };\n\n'
BLOCK = "  if (adminAuthService) {\n    app.use('/api/v1/admin/auth', createAdminAuthRouter({ adminAuthService }));\n    app.use('/api/v1', createAdminBearerContextMiddleware(adminAuthService));\n    const serviceVisitService = dependencies.serviceVisitService || (!options.dependencies && new ServiceVisitService({\n      prisma: getPrismaClient(),\n      storage: new LocalPhotoStorageAdapter({ rootDir: process.env.SERVICE_REPORT_UPLOAD_DIR || '/var/lib/soft-ice/media/service-reports' }),\n    }));\n    if (serviceVisitService) app.use('/api/v1/service-workspace', createServiceWorkspaceRouter({ serviceVisitService }));\n    const serviceAccountAccess = dependencies.serviceAccountAccess || (!options.dependencies && new ServiceAccountAccess({ prisma: getPrismaClient() }));\n    if (serviceAccountAccess) app.use('/api/v1/admin/service-access', createServiceAccountRouter({ serviceAccountAccess }));\n  }\n\n"

def once(source, anchor, replacement):
    if source.count(anchor) != 1: raise RuntimeError('Неоднозначная точка подключения: ' + anchor)
    return source.replace(anchor, replacement, 1)

def status(path, method='GET'):
    req = urllib.request.Request('http://127.0.0.1:8800'+path, data=b'{}' if method=='POST' else None, method=method, headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=3) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code,e.read()

def main():
    target=LIVE/'src/main.js'
    original=target.read_bytes()
    if hashlib.sha256(original).hexdigest()!=EXPECTED: raise RuntimeError('Файл запуска изменился. Нужна повторная сверка.')
    source=original.decode()
    source=once(source,"const { createBotWebhookHandlers }",IMPORTS+"const { createBotWebhookHandlers }")
    source=once(source,"const { disconnectDatabase } = require('./common/database');","const { getPrismaClient, disconnectDatabase } = require('./common/database');")
    source=once(source,'  app.use(express.json',SETUP+'  app.use(express.json')
    source=once(source,'  // Equipment Sandbox',BLOCK+'  // Equipment Sandbox')
    import re
    for relative in re.findall(r"require\('([^']+)'\)",IMPORTS):
        if not (LIVE/'src'/ (relative+'.js')).is_file(): raise RuntimeError('Отсутствует зависимость: '+relative)
    with tempfile.NamedTemporaryFile(suffix='.js') as f:
        f.write(source.encode());f.flush()
        subprocess.run(['node','--check',f.name],check=True)
    if '--apply' not in sys.argv:
        print('PASS: точечное подключение входа, сотрудников и фотоотчётов подготовлено; синтаксис проверен. Рабочие файлы не изменены.')
        return
    if os.geteuid()!=0: raise RuntimeError('Для установки запустите sudo с параметром --apply.')
    backup=pathlib.Path('/var/backups/soft-ice/admin-composition-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True,mode=0o700)
    shutil.copy2(target,backup/'main.js')
    try:
        target.write_text(source)
        subprocess.run(['systemctl','restart',SERVICE],check=True)
        for _ in range(30):
            try:
                if status('/health')[0]==200: break
            except Exception: pass
            time.sleep(.5)
        else: raise RuntimeError('Health не прошёл проверку.')
        code,body=status('/api/v1/admin/auth/login','POST')
        if code!=401 or b'ADMIN_INVALID_CREDENTIALS' not in body: raise RuntimeError('Вход не прошёл проверку маршрутизации.')
        code, body = status('/api/v1/admin/service-access')
        if not ((code == 403 and b'SERVICE_ACCOUNT_ACCESS_DENIED' in body) or (code == 401 and b'ADMIN_AUTHENTICATION_REQUIRED' in body)):
            raise RuntimeError('Проверка отказа в доступе к сотрудникам не пройдена.')
        print('PASS: подключение входа и сотрудников восстановлено. Резервная копия:',backup)
    except Exception:
        shutil.copy2(backup/'main.js',target)
        subprocess.run(['systemctl','restart',SERVICE],check=True)
        raise
if __name__=='__main__':
    try: main()
    except Exception as e:
        print('Установка остановлена:',str(e));sys.exit(1)
