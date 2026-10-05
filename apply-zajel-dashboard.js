'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=__dirname,changes=new Map();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function once(text,anchor,insert){const i=text.indexOf(anchor);if(i<0||text.indexOf(anchor,i+1)>=0)throw Error('النسخة الحالية مختلفة. أرسل ملف التشغيل لتكييف التعديل؛ لم يتم تعديل ملفاتك.');return text.slice(0,i)+insert+text.slice(i);}
try{
 for(const f of ['zajelDashboard.js','zajelShared.js']){const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(r.status!==0)throw Error('ارفع جميع ملفات تحديث الداشبورد. '+r.stderr);}
 let code=read('server.js');
 if(!code.includes('// ZOMBI-ZAJEL-DASHBOARD-20261005')){
 const hook="// ZOMBI-ZAJEL-DASHBOARD-20261005\n  require('./zajelDashboard').mount(app,{store,requireLogin,requireGuildAccess,checkCsrf,csrf,layout,botFetch});\n  ";
 code=once(code,"app.get('/health',",hook);changes.set('server.js',code);}
 const ui=read('dashboard.js');if(!ui.includes('// ZOMBI-ZAJEL-NAV-20261005'))changes.set('dashboard.js',ui+'\n'+read('zajel-nav.js')+'\n');

 for(const [name,code] of changes){const r=cp.spawnSync(process.execPath,['--check'],{input:code,encoding:'utf8'});if(r.status!==0)throw Error('فشل فحص '+name+': '+r.stderr);}
 if(!changes.size){console.log('✅ زاجل مثبت بالفعل.');process.exit(0);}
 const backup=path.join(root,'zajel-backup-'+Date.now());fs.mkdirSync(backup,{recursive:true});
 for(const [name] of changes){fs.mkdirSync(path.dirname(path.join(backup,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(backup,name));}
 try{for(const [name,code] of changes){const target=path.join(root,name);fs.writeFileSync(target+'.zajel-tmp',code);fs.renameSync(target+'.zajel-tmp',target);}}
 catch(e){for(const [name] of changes)fs.copyFileSync(path.join(backup,name),path.join(root,name));throw e;}
 console.log('✅ تم تثبيت زاجل. أعد تشغيل الخدمة الآن. النسخة الاحتياطية: '+path.basename(backup));
}catch(e){console.error('❌ '+e.message);process.exitCode=1;}
