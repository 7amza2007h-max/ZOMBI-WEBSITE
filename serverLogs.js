'use strict';
const { AuditLogEvent } = require('discord.js');
const store = require('./sharedStore');
const installed = new WeakSet();
const queues = new Map();
const clip = (v, n=1000) => String(v ?? 'غير متاح').slice(0,n);
const who = u => u ? `${u.tag || u.username || u.id} (${u.id})` : 'غير معروف';
const json = v => { try { return JSON.stringify(v, (k,x) => typeof x === 'bigint' ? String(x) : x); } catch { return String(v); } };
// All sends for a guild are ordered; failures never interrupt gameplay.
async function write(guild, title, details, category='actions', channelId=null) {
  if (!guild) return;
  try {
    const cfg=await store.getConfig(guild.id);
    if (cfg.moderation?.logActions===false || cfg.logging?.[category]===false) return;
    const perType={members:'logs-members',messages:'logs-messages',voice:'logs-voice',tickets:'logs-tickets',events:'logs-events',commands:'logs-bot',games:'logs-bot'};
    const customLogs=await store.data(guild.id,'your-server-log-channels.json',{}).catch(()=>({}));
    let targetKey=({members:'members',messages:'messages',voice:'voice',tickets:'tickets',events:'events',commands:'bot',games:'bot'})[category]||null;
    let targetName=perType[category]||null;
    if(category==='audit'){
      const lower=String(title||'').toLowerCase();
      targetKey=/رتب|role/i.test(lower)?'roles':/روم|قناة|channel/i.test(lower)?'channels':/عقوب|حظر|طرد|timeout|ban|kick/i.test(lower)?'moderation':'bot';
      targetName=`logs-${targetKey}`;
    }
    let targetId=targetKey?customLogs[targetKey]:null;
    if(targetId&&!guild.channels.cache.has(String(targetId))){const fetched=await guild.channels.fetch(String(targetId)).catch(()=>null);if(!fetched)targetId=null;}
    if(!targetId&&targetName){const candidate=guild.channels.cache.find(ch=>ch.name===targetName&&ch.isTextBased?.());if(candidate)targetId=candidate.id;}
    targetId=targetId||cfg.channels?.logs;
    if(!targetId || (channelId && channelId===targetId))return;
    let state=queues.get(guild.id);
    if (!state) { state={tail:Promise.resolve(),pending:0,dropped:0}; queues.set(guild.id,state); }
    if (state.pending>=500) { state.dropped++; return; }
    state.pending++;
    const timestamp=new Date().toISOString();
    state.tail=state.tail.then(async()=>{
      const ch=guild.channels.cache.get(targetId)||await guild.channels.fetch(targetId);
      if (!ch?.isTextBased?.()) throw new Error('Log channel unavailable');
      const skipped=state.dropped; state.dropped=0;
      const embed={title:clip(title,256),description:clip(details,3800)+(skipped?`\n⚠️ لم تُسجّل ${skipped} أحداث بسبب ازدحام الطابور.`:''),color:0x8b5cf6,timestamp,footer:{text:'ZOMBI • SERVER LOG'}};
      await ch.send({allowedMentions:{parse:[]},embeds:[embed]});
      const ownerLogId=customLogs.owner;
      if(ownerLogId&&String(ownerLogId)!==String(targetId)&&['audit','tickets','events'].includes(category)){
        const ownerCh=guild.channels.cache.get(String(ownerLogId))||await guild.channels.fetch(String(ownerLogId)).catch(()=>null);
        if(ownerCh?.isTextBased?.())await ownerCh.send({allowedMentions:{parse:[]},embeds:[{...embed,title:clip(`👑 ${title}`,256),footer:{text:'ZOMBI • OWNER SUMMARY'}}]});
      }
    }).catch(e=>console.error('[ZOMBI logs]',guild.id,e.code||e.message)).finally(()=>{state.pending--;if(!state.pending)queues.delete(guild.id);});
  } catch(e) { console.error('[ZOMBI logs config]',guild.id,e.code||e.message); }
}
const labels={1:'تعديل السيرفر',10:'إنشاء روم',11:'تعديل روم',12:'حذف روم',13:'إضافة صلاحيات روم',14:'تعديل صلاحيات روم / فتح أو قفل',15:'حذف صلاحيات روم',20:'طرد عضو',21:'تنظيف الأعضاء',22:'حظر عضو',23:'إلغاء حظر',24:'تعديل عضو / تايم أوت',25:'تعديل رتب عضو',26:'نقل عضو صوتيًا',27:'فصل عضو من الفويس',28:'إضافة بوت',30:'إنشاء رتبة',31:'تعديل رتبة',32:'حذف رتبة',40:'إنشاء دعوة',41:'تعديل دعوة',42:'حذف دعوة',72:'حذف رسائل بواسطة مشرف',73:'حذف رسائل جماعي',74:'تثبيت رسالة',75:'إلغاء تثبيت رسالة',110:'إنشاء ثريد',111:'تعديل ثريد',112:'حذف ثريد'};
function install(client) {
  if(installed.has(client))return; installed.add(client);
  const on=(event,fn)=>client.on(event,(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>console.error('[ZOMBI logs event]',event,e.code||e.message)));
  on('guildAuditLogEntryCreate',(entry,guild)=>write(guild,'🛡️ '+(labels[entry.action]||AuditLogEvent[entry.action]||`إجراء ${entry.action}`),[
    `المنفّذ: ${who(entry.executor)||entry.executorId}`,
    `المستهدف: ${entry.targetId||entry.target?.id||'غير متاح'}`,
    `السبب: ${clip(entry.reason||'لم يُذكر سبب',400)}`,
    `تفاصيل إضافية: ${clip(json(entry.extra),600)}`,
    ...(entry.changes||[]).slice(0,15).map(c=>`${c.key}: ${clip(json(c.old),140)} ← ${clip(json(c.new),140)}`),
    `رقم سجل ديسكورد: ${entry.id}`,
    ...([72,73].includes(entry.action)?['هذا سجل إجراء إداري مستقل؛ لا يحدد بالضرورة رسالة محذوفة بعينها.']:[])
  ].join('\n'),'audit'));
  on('messageDelete',m=>write(m.guild,'🗑️ حذف رسالة',`كاتب الرسالة: ${who(m.author)}\nالروم: <#${m.channelId}>\nرقم الرسالة: ${m.id}\nالمحتوى: ${clip(m.content||'غير متاح في ذاكرة البوت',1800)}\nالمرفقات: ${clip([...m.attachments?.values?.()||[]].map(a=>a.name).join(', ')||'غير متاحة',500)}\nمن حذفها: غير مؤكد؛ راجع سجل الإجراءات الإدارية إن وُجد.`,'messages',m.channelId));
  on('messageDeleteBulk',(messages,ch)=>write(ch.guild,'🗑️ حذف رسائل جماعي',`الروم: <#${ch.id}>\nالعدد: ${messages.size}\nأرقام الرسائل: ${clip([...messages.keys()].join(', '),1800)}`,'messages',ch.id));
  on('messageUpdate',(a,b)=>{if(a.content===b.content)return;return write(b.guild,'✏️ تعديل رسالة',`العضو: ${who(b.author||a.author)}\nالروم: <#${b.channelId}>\nالرسالة: ${b.id}\nقبل: ${clip(a.content||'غير متاح',1400)}\nبعد: ${clip(b.content||'غير متاح',1400)}`,'messages',b.channelId);});
  on('channelCreate',ch=>{if(!ch.guild)return;const details=`القناة: ${ch.name} (${ch.id})\nالنوع: ${ch.type}\nالتصنيف: ${ch.parent?.name||'بدون تصنيف'}`;write(ch.guild,'➕ إنشاء قناة',details,'audit');if(/ticket|تذكرة|طلب-شراء|شكوى/i.test(ch.name||''))write(ch.guild,'🎫 إنشاء قناة تذكرة/طلب',details,'tickets');});
  on('channelDelete',ch=>{if(!ch.guild)return;const details=`القناة المحذوفة: ${ch.name} (${ch.id})\nالتصنيف السابق: ${ch.parent?.name||'غير معروف'}`;write(ch.guild,'➖ حذف قناة',details,'audit');if(/ticket|تذكرة|طلب-شراء|شكوى/i.test(ch.name||''))write(ch.guild,'🎫 حذف قناة تذكرة/طلب',details,'tickets');});
  on('channelUpdate',(a,b)=>{if(a.name===b.name&&a.parentId===b.parentId&&a.type===b.type)return;write(b.guild,'✏️ تعديل قناة',`القناة: ${b.name} (${b.id})\nالاسم السابق: ${a.name}\nالتصنيف السابق: ${a.parent?.name||'بدون'}\nالتصنيف الجديد: ${b.parent?.name||'بدون'}`,'audit');});
  on('roleCreate',r=>write(r.guild,'➕ إنشاء رتبة',`الرتبة: ${r.name} (${r.id})`,'audit'));
  on('roleDelete',r=>write(r.guild,'➖ حذف رتبة',`الرتبة المحذوفة: ${r.name} (${r.id})`,'audit'));
  on('roleUpdate',(a,b)=>{if(a.name===b.name&&a.color===b.color&&a.permissions.bitfield===b.permissions.bitfield)return;write(b.guild,'✏️ تعديل رتبة',`الرتبة: ${b.name} (${b.id})\nالاسم السابق: ${a.name}\nالاسم الجديد: ${b.name}`,'audit');});
  on('guildScheduledEventCreate',e=>write(e.guild,'🎉 إنشاء فعالية',`الفعالية: ${e.name} (${e.id})\nالوقت: ${e.scheduledStartAt?.toISOString()||'غير محدد'}`,'events'));
  on('guildScheduledEventUpdate',(a,b)=>write(b.guild,'🎉 تعديل فعالية',`الفعالية: ${b.name} (${b.id})\nالاسم السابق: ${a.name}\nالاسم الحالي: ${b.name}\nوقت البداية: ${b.scheduledStartAt?.toISOString()||'غير محدد'}`,'events'));
  on('guildScheduledEventDelete',e=>write(e.guild,'🎉 حذف فعالية',`الفعالية: ${e.name} (${e.id})`,'events'));
  on('guildMemberAdd',m=>write(m.guild,'📥 انضمام عضو',who(m.user),'members'));
  on('guildMemberRemove',m=>write(m.guild,'📤 مغادرة عضو',`${who(m.user)}\nقد تكون مغادرة أو إجراء إداري؛ راجع سجل الإدارة.`,'members'));
  on('guildMemberUpdate',(a,b)=>{const changes=[];if(a.nickname!==b.nickname)changes.push(`الاسم: ${a.nickname||a.user.username} ← ${b.nickname||b.user.username}`);const added=b.roles.cache.filter(r=>!a.roles.cache.has(r.id)),removed=a.roles.cache.filter(r=>!b.roles.cache.has(r.id));if(added.size)changes.push('رتب مضافة: '+added.map(r=>`${r.name} (${r.id})`).join(', '));if(removed.size)changes.push('رتب محذوفة: '+removed.map(r=>`${r.name} (${r.id})`).join(', '));if(a.communicationDisabledUntilTimestamp!==b.communicationDisabledUntilTimestamp)changes.push('تايم أوت حتى: '+(b.communicationDisabledUntil?.toISOString()||'أُلغي'));if(changes.length)return write(b.guild,'👤 تحديث عضو',who(b.user)+'\n'+changes.join('\n'),'members');});
  on('voiceStateUpdate',(a,b)=>{const changes=[];if(a.channelId!==b.channelId)changes.push(`الروم السابق: ${a.channelId?'<#'+a.channelId+'>':'خارج الفويس'}\nالروم الجديد: ${b.channelId?'<#'+b.channelId+'>':'خارج الفويس'}`);for(const [key,label] of [['selfMute','كتم شخصي'],['selfDeaf','صمم شخصي'],['serverMute','كتم إداري'],['serverDeaf','صمم إداري'],['streaming','مشاركة الشاشة'],['selfVideo','الكاميرا']])if(a[key]!==b[key])changes.push(`${label}: ${b[key]?'مفعّل':'متوقف'}`);if(changes.length)return write(b.guild,'🔊 حركة الفويس',who(b.member?.user)+'\n'+changes.join('\n'),'voice');});
  on('interactionCreate',i=>{if(!i.guild||!i.isChatInputCommand?.())return;return write(i.guild,'⌨️ استخدام أمر',`العضو: ${who(i.user)}\nالأمر: /${i.commandName}\nالروم: <#${i.channelId}>\nهذا تسجيل استخدام الأمر، وليس تأكيد نجاحه.`,'commands',i.channelId);});
}
function game(i,type,phase='بدء لعبة') {return write(i.guild,'🎮 '+phase,`اللعبة: ${type}\nبواسطة: ${who(i.user||i.author)}\nالروم: <#${i.channel?.id||i.channelId}>`,'games');}
module.exports={install,write,game,drain:async()=>{await Promise.all([...queues.values()].map(s=>s.tail));}};
