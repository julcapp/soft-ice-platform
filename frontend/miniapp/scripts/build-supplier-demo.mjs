import {build} from 'esbuild';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]||path.join(root,'dist-supplier-demo'));
await mkdir(path.join(out,'assets'),{recursive:true});
await build({absWorkingDir:root,entryPoints:['src/supplier-demo/main.jsx'],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(out,'assets/demo.js')});
const names={};for(const ext of ['js','css']){const f=path.join(out,'assets/demo.'+ext);const data=await readFile(f);const name='demo-'+createHash('sha256').update(data).digest('hex').slice(0,12)+'.'+ext;await rename(f,path.join(out,'assets',name));names[ext]=name;}
await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>У Тимоши — демонстрация для поставщика</title><link rel="stylesheet" href="./assets/${names.css}"><script defer src="./assets/${names.js}"></script></head><body><div id="root"></div><noscript>Включите JavaScript для просмотра демонстрации.</noscript></body></html>`);
console.log('Supplier demo built:',out);
