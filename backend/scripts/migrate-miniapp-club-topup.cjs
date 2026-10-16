'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
for(const line of fs.readFileSync('/etc/softice/display-backend.env','utf8').split(/\r?\n/))if(line.startsWith('DATABASE_URL='))process.env.DATABASE_URL=line.slice(13).trim().replace(/^(['"])(.*)\1$/,'$2');
const {PrismaClient}=require(process.cwd()+'/node_modules/@prisma/client');const db=new PrismaClient();
const name='20261016100000_miniapp_club_topup',sql=fs.readFileSync(process.cwd()+'/prisma/migrations/'+name+'/migration.sql','utf8'),checksum=crypto.createHash('sha256').update(sql).digest('hex');
(async()=>{await db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',name);
 const prior=await tx.$queryRawUnsafe('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',name);
 if(prior.length){if(prior[0].checksum!==checksum||!prior[0].finished_at)throw Error('MIGRATION_DRIFT');return;}
 for(const part of sql.split(';').filter(s=>s.trim()))await tx.$executeRawUnsafe(part);
 await tx.$executeRawUnsafe('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,CURRENT_TIMESTAMP,$3,CURRENT_TIMESTAMP,1)',crypto.randomUUID(),checksum,name);
 });console.log('CLUB_TOPUP_MIGRATION_OK',checksum);
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
