#!/usr/bin/env python3
import datetime,os,pathlib,shutil
web=pathlib.Path('/var/www/admin.utimoshi.ru')
source=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/frontend/admin-console/src/styles.css')
css='''/* softice-sidebar-scroll-v2 */
.sidebar{height:100vh;height:100dvh;overflow:hidden;display:flex;flex-direction:column}
.sidebar .brand,.sidebar .readonly-mark{flex-shrink:0}
.sidebar nav{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;align-content:start;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#86aaa5 #193b39;padding-right:4px;touch-action:pan-y}
.sidebar nav::-webkit-scrollbar{width:8px}
.sidebar nav::-webkit-scrollbar-thumb{background:#86aaa5;border-radius:6px}
'''
if os.geteuid()!=0:raise SystemExit('Запустите в root-терминале.')
backup=pathlib.Path('/var/backups/soft-ice/sidebar-scroll-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700)
shutil.copy2(web/'index.html',backup/'index.html');shutil.copy2(source,backup/'styles.css')
try:
 (web/'sidebar-scroll-v2.css').write_text(css)
 text=source.read_text()
 if 'softice-sidebar-scroll-v2' not in text:source.write_text(text+'\n'+css)
 html=(web/'index.html').read_text();link='<link rel="stylesheet" href="/sidebar-scroll-v2.css?v=2">'
 if link not in html:
  if '</head>' not in html:raise RuntimeError('В index.html нет закрывающего head.')
  (web/'index.next.html').write_text(html.replace('</head>',link+'\n</head>',1));(web/'index.next.html').replace(web/'index.html')
 print('PASS: прокрутка левого меню восстановлена; исправление добавлено в исходники.')
except Exception:
 shutil.copy2(backup/'index.html',web/'index.html');shutil.copy2(backup/'styles.css',source);raise
