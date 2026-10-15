import {build} from 'esbuild';
await build({entryPoints:['src/CustomerBenefitsStandalone.jsx'],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',define:{'process.env.NODE_ENV':'"production"'},outfile:process.argv[2]||'dist-benefits/customer-benefits.js'});
