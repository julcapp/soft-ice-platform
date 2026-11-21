/* Applies only this additive migration; never runs unrelated pending migrations. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..');
const line=fs.readFileSync('/etc/softice/display-backend.env','utf8').split('\n').find(v=>v.startsWith('DATABASE_URL='));
if(!line)throw Error('DATABASE_URL missing');
process.env.DATABASE_URL=line.slice(13).trim().replace(/^["']|["']$/g,'');
const {PrismaClient}=require(path.join(base,'node_modules/@prisma/client'));
const {CustomerBenefitService}=require(path.join(base,'src/modules/customer_benefits/CustomerBenefitService'));
const prisma=new PrismaClient();
const name='20261015040000_customer_benefit_rules';
const sql=fs.readFileSync(path.join(base,'prisma/migrations',name,'migration.sql'),'utf8');
const checksum=crypto.createHash('sha256').update(sql).digest('hex');
(async()=>{try{
 await prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('customer-benefit-migration'))");
  const applied=await tx.$queryRawUnsafe('SELECT "checksum","finished_at" FROM "_prisma_migrations" WHERE "migration_name"=$1 AND "rolled_back_at" IS NULL',name);
  if(applied.length){if(applied[0].checksum!==checksum||!applied[0].finished_at)throw Error('Migration checksum or state mismatch');return;}
  const exists=await tx.$queryRawUnsafe('SELECT to_regclass(\'"CustomerBenefitPolicyVersion"\') ::text AS name');
  if(exists[0].name)throw Error('Untracked benefits schema exists; stop');
  for(const statement of sql.split(';').map(v=>v.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  await tx.$executeRawUnsafe('INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","started_at","applied_steps_count") VALUES ($1,$2,CURRENT_TIMESTAMP,$3,CURRENT_TIMESTAMP,1)',crypto.randomUUID(),checksum,name);
 });
 const service=new CustomerBenefitService({prisma});
 const version=await service.initialize('julcapp');
 console.log(JSON.stringify({migration:name,version:version.version,status:version.status,liveRules:version.rules.filter(r=>r.mode==='live').length}));
}finally{await prisma.$disconnect();}})().catch(e=>{console.error('BENEFIT_MIGRATION_ERROR',e.code||e.message,e.meta?.message||'');process.exitCode=1;});
