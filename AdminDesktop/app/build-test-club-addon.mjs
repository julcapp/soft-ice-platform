import {build} from 'esbuild';
await build({entryPoints:['src/TestClubAdminAddon.jsx'],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},outfile:process.argv[2]||'dist-test-club/test-club-admin.js'});
