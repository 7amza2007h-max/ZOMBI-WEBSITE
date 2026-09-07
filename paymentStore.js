'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const BASE_DATA=process.env.ZOMBI_LOCAL_DATA_DIR?path.resolve(process.env.ZOMBI_LOCAL_DATA_DIR):path.join(__dirname,path.basename(__dirname)==='public'?'..':'.','data');
const LOCAL_FILE=path.join(BASE_DATA,'payment-requests.json');
let pool=null,readyPromise=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const text=(v='',max=500)=>String(v??'').trim().slice(0,max);
function dbEnabled(){return Boolean(String(process.env.DATABASE_URL||'').trim());}
function ensureDir(d){fs.mkdirSync(d,{recursive:true});}
function readLocal(){try{return JSON.parse(fs.readFileSync(LOCAL_FILE,'utf8'));}catch{return[];}}
function writeLocal(value){ensureDir(path.dirname(LOCAL_FILE));const tmp=`${LOCAL_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');try{fs.renameSync(tmp,LOCAL_FILE);}catch{fs.writeFileSync(LOCAL_FILE,JSON.stringify(value,null,2),'utf8');try{fs.unlinkSync(tmp);}catch{}}}
function normalizeStatus(v){return ['pending','processing','approved','rejected'].includes(String(v))?String(v):'pending';}
function rowToItem(row,includeProof=false){if(!row)return null;const item={id:String(row.id),userId:String(row.user_id||''),username:String(row.username||''),guildId:String(row.guild_id||''),guildName:String(row.guild_name||''),plan:String(row.plan||'premium'),amount:Number(row.amount||0),currency:String(row.currency||'JOD'),days:Number(row.days||30),payerPhone:String(row.payer_phone||''),transactionRef:String(row.transaction_ref||''),proofMime:String(row.proof_mime||''),proofHash:String(row.proof_hash||''),status:normalizeStatus(row.status),createdAt:Number(row.created_at||0),reviewedAt:Number(row.reviewed_at||0),reviewedBy:String(row.reviewed_by||''),reviewNote:String(row.review_note||'')};if(includeProof)item.proofData=String(row.proof_data||'');return item;}
function localItem(raw,includeProof=false){const item={id:String(raw.id),userId:String(raw.userId||''),username:String(raw.username||''),guildId:String(raw.guildId||''),guildName:String(raw.guildName||''),plan:String(raw.plan||'premium'),amount:Number(raw.amount||0),currency:String(raw.currency||'JOD'),days:Number(raw.days||30),payerPhone:String(raw.payerPhone||''),transactionRef:String(raw.transactionRef||''),proofMime:String(raw.proofMime||''),proofHash:String(raw.proofHash||''),status:normalizeStatus(raw.status),createdAt:Number(raw.createdAt||0),reviewedAt:Number(raw.reviewedAt||0),reviewedBy:String(raw.reviewedBy||''),reviewNote:String(raw.reviewNote||'')};if(includeProof)item.proofData=String(raw.proofData||'');return item;}
async function ensureDb(){
  if(!dbEnabled())return null;
  if(pool){if(readyPromise)await readyPromise;return pool;}
  const {Pool}=require('pg');
  const rawUrl=String(process.env.DATABASE_URL).trim();
  const sslDisabled=String(process.env.DATABASE_SSL||'').toLowerCase()==='false';
  const url=sslDisabled?rawUrl:rawUrl.replace(/([?&])sslmode=(?:prefer|require|verify-ca)(?=(&|$))/i,'$1sslmode=verify-full');
  const options={connectionString:url,max:3};
  if(sslDisabled)options.ssl=false;else if(!/[?&]sslmode=/i.test(url))options.ssl={rejectUnauthorized:true};
  pool=new Pool(options);
  readyPromise=(async()=>{
    await pool.query(`CREATE TABLE IF NOT EXISTS zombi_payment_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      guild_id TEXT NOT NULL,
      guild_name TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL,
      amount NUMERIC(12,3) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'JOD',
      days INTEGER NOT NULL DEFAULT 30,
      payer_phone TEXT NOT NULL DEFAULT '',
      transaction_ref TEXT NOT NULL DEFAULT '',
      proof_mime TEXT NOT NULL,
      proof_hash TEXT NOT NULL,
      proof_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL,
      reviewed_at BIGINT NOT NULL DEFAULT 0,
      reviewed_by TEXT NOT NULL DEFAULT '',
      review_note TEXT NOT NULL DEFAULT ''
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS zombi_payment_status_idx ON zombi_payment_requests(status,created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS zombi_payment_user_idx ON zombi_payment_requests(user_id,created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS zombi_payment_guild_idx ON zombi_payment_requests(guild_id,created_at DESC)`);
  })();
  await readyPromise;return pool;
}
async function create(input={}){
  const item={id:`pay_${crypto.randomUUID()}`,userId:text(input.userId,30),username:text(input.username,120),guildId:text(input.guildId,30),guildName:text(input.guildName,160),plan:['premium','premium_plus'].includes(input.plan)?input.plan:'premium',amount:Math.max(0,Math.round(Number(input.amount||0)*1000)/1000),currency:'JOD',days:Math.max(1,Math.min(3650,Math.round(Number(input.days)||30))),payerPhone:text(input.payerPhone,30),transactionRef:text(input.transactionRef,100),proofMime:text(input.proofMime,50),proofHash:text(input.proofHash,128),proofData:String(input.proofData||''),status:'pending',createdAt:Date.now(),reviewedAt:0,reviewedBy:'',reviewNote:''};
  if(!item.userId||!item.guildId||!item.proofData||!item.proofHash)throw new Error('بيانات طلب الدفع غير مكتملة.');
  if(dbEnabled()){
    const p=await ensureDb();
    if(item.transactionRef){const d=await p.query(`SELECT id FROM zombi_payment_requests WHERE lower(transaction_ref)=lower($1) AND transaction_ref<>'' AND status IN ('pending','processing','approved') LIMIT 1`,[item.transactionRef]);if(d.rowCount)throw new Error('رقم العملية مستخدم في طلب دفع سابق.');}
    const h=await p.query(`SELECT id FROM zombi_payment_requests WHERE proof_hash=$1 AND status IN ('pending','processing','approved') LIMIT 1`,[item.proofHash]);if(h.rowCount)throw new Error('صورة إثبات الدفع مستخدمة في طلب سابق.');
    const pending=await p.query(`SELECT id FROM zombi_payment_requests WHERE user_id=$1 AND guild_id=$2 AND status IN ('pending','processing') LIMIT 1`,[item.userId,item.guildId]);if(pending.rowCount)throw new Error('لديك طلب دفع قيد المراجعة لهذا السيرفر بالفعل.');
    await p.query(`INSERT INTO zombi_payment_requests(id,user_id,username,guild_id,guild_name,plan,amount,currency,days,payer_phone,transaction_ref,proof_mime,proof_hash,proof_data,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',$15)`,[item.id,item.userId,item.username,item.guildId,item.guildName,item.plan,item.amount,item.currency,item.days,item.payerPhone,item.transactionRef,item.proofMime,item.proofHash,item.proofData,item.createdAt]);
    return clone(item);
  }
  const list=readLocal();
  if(item.transactionRef&&list.some(x=>String(x.transactionRef||'').toLowerCase()===item.transactionRef.toLowerCase()&&['pending','processing','approved'].includes(x.status)))throw new Error('رقم العملية مستخدم في طلب دفع سابق.');
  if(list.some(x=>x.proofHash===item.proofHash&&['pending','processing','approved'].includes(x.status)))throw new Error('صورة إثبات الدفع مستخدمة في طلب سابق.');
  if(list.some(x=>x.userId===item.userId&&x.guildId===item.guildId&&['pending','processing'].includes(x.status)))throw new Error('لديك طلب دفع قيد المراجعة لهذا السيرفر بالفعل.');
  list.push(item);writeLocal(list);return clone(item);
}
async function list(options={}){
  const limit=Math.max(1,Math.min(250,Math.round(Number(options.limit)||100))),userId=text(options.userId,30),status=options.status?normalizeStatus(options.status):'';
  if(dbEnabled()){
    const p=await ensureDb(),where=[],args=[];if(userId){args.push(userId);where.push(`user_id=$${args.length}`);}if(status){args.push(status);where.push(`status=$${args.length}`);}args.push(limit);
    const r=await p.query(`SELECT id,user_id,username,guild_id,guild_name,plan,amount,currency,days,payer_phone,transaction_ref,proof_mime,proof_hash,status,created_at,reviewed_at,reviewed_by,review_note FROM zombi_payment_requests ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY created_at DESC LIMIT $${args.length}`,args);return r.rows.map(x=>rowToItem(x,false));
  }
  return readLocal().filter(x=>(!userId||x.userId===userId)&&(!status||x.status===status)).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,limit).map(x=>localItem(x,false));
}
async function get(id,includeProof=true){
  id=text(id,100);if(!id)return null;
  if(dbEnabled()){const p=await ensureDb(),r=await p.query(`SELECT * FROM zombi_payment_requests WHERE id=$1 LIMIT 1`,[id]);return rowToItem(r.rows[0],includeProof);}
  const item=readLocal().find(x=>x.id===id);return item?localItem(item,includeProof):null;
}
async function claim(id,reviewerId){
  id=text(id,100);reviewerId=text(reviewerId,30);const now=Date.now();
  if(dbEnabled()){const p=await ensureDb(),r=await p.query(`UPDATE zombi_payment_requests SET status='processing',reviewed_by=$2,reviewed_at=$3 WHERE id=$1 AND status='pending' RETURNING *`,[id,reviewerId,now]);return rowToItem(r.rows[0],true);}
  const list=readLocal(),idx=list.findIndex(x=>x.id===id&&x.status==='pending');if(idx<0)return null;list[idx].status='processing';list[idx].reviewedBy=reviewerId;list[idx].reviewedAt=now;writeLocal(list);return localItem(list[idx],true);
}
async function finalize(id,status,reviewerId,note=''){
  id=text(id,100);reviewerId=text(reviewerId,30);status=['approved','rejected'].includes(status)?status:'rejected';note=text(note,1000);const now=Date.now();
  if(dbEnabled()){const p=await ensureDb(),r=await p.query(`UPDATE zombi_payment_requests SET status=$2,reviewed_by=$3,reviewed_at=$4,review_note=$5 WHERE id=$1 AND status='processing' RETURNING *`,[id,status,reviewerId,now,note]);return rowToItem(r.rows[0],false);}
  const list=readLocal(),idx=list.findIndex(x=>x.id===id&&x.status==='processing');if(idx<0)return null;Object.assign(list[idx],{status,reviewedBy:reviewerId,reviewedAt:now,reviewNote:note});writeLocal(list);return localItem(list[idx],false);
}
async function release(id){
  id=text(id,100);if(dbEnabled()){const p=await ensureDb();await p.query(`UPDATE zombi_payment_requests SET status='pending',reviewed_by='',reviewed_at=0 WHERE id=$1 AND status='processing'`,[id]);return;}
  const list=readLocal(),idx=list.findIndex(x=>x.id===id&&x.status==='processing');if(idx>=0){list[idx].status='pending';list[idx].reviewedBy='';list[idx].reviewedAt=0;writeLocal(list);}
}
async function health(){if(!dbEnabled())return{mode:'local-json',ok:true};try{const p=await ensureDb();await p.query('SELECT 1');return{mode:'postgres',ok:true};}catch(e){return{mode:'postgres',ok:false,error:e.message};}}
module.exports={dbEnabled,ensureDb,create,list,get,claim,finalize,release,health};
