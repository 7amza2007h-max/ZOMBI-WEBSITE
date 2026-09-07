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
    if (!cfg.channels?.logs || cfg.moderation?.logActions===false || cfg.logging?.[category]===false) return;
    if (channelId && channelId===cfg.channels.logs) return;
    let state=queues.get(guild.id);
    if (!state) { state={tail:Promise.resolve(),pending:0,dropped:0}; queues.set(guild.id,state); }
    if (state.pending>=500) { state.dropped++; return; }
    state.pending++;
    const timestamp=new Date().toISOString();
    state.tail=state.tail.then(async()=>{
      const ch=guild.channels.cache.get(cfg.channels.logs)||await guild.channels.fetch(cfg.channels.logs);
      if (!ch?.isTextBased?.()) throw new Error('Log channel unavailable');
      const skipped=state.dropped; state.dropped=0;
      await ch.send({allowedMentions:{parse:[]},embeds:[{title:clip(title,256),description:clip(details,3800)+(skipped?`\n⚠️ لم تُسجّل ${skipped} أحداث بسبب ازدحام الطابور.`:''),color:0x8b5cf6,timestamp,footer:{text:'ZOMBI • SERVER LOG'}}]});
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
  on('guildMemberAdd',m=>write(m.guild,'📥 انضمام عضو',who(m.user),'members'));
  on('guildMemberRemove',m=>write(m.guild,'📤 مغادرة عضو',`${who(m.user)}\nقد تكون مغادرة أو إجراء إداري؛ راجع سجل الإدارة.`,'members'));
  on('guildMemberUpdate',(a,b)=>{const changes=[];if(a.nickname!==b.nickname)changes.push(`الاسم: ${a.nickname||a.user.username} ← ${b.nickname||b.user.username}`);const added=b.roles.cache.filter(r=>!a.roles.cache.has(r.id)),removed=a.roles.cache.filter(r=>!b.roles.cache.has(r.id));if(added.size)changes.push('رتب مضافة: '+added.map(r=>`${r.name} (${r.id})`).join(', '));if(removed.size)changes.push('رتب محذوفة: '+removed.map(r=>`${r.name} (${r.id})`).join(', '));if(a.communicationDisabledUntilTimestamp!==b.communicationDisabledUntilTimestamp)changes.push('تايم أوت حتى: '+(b.communicationDisabledUntil?.toISOString()||'أُلغي'));if(changes.length)return write(b.guild,'👤 تحديث عضو',who(b.user)+'\n'+changes.join('\n'),'members');});
  on('voiceStateUpdate',(a,b)=>{const changes=[];if(a.channelId!==b.channelId)changes.push(`الروم السابق: ${a.channelId?'<#'+a.channelId+'>':'خارج الفويس'}\nالروم الجديد: ${b.channelId?'<#'+b.channelId+'>':'خارج الفويس'}`);for(const [key,label] of [['selfMute','كتم شخصي'],['selfDeaf','صمم شخصي'],['serverMute','كتم إداري'],['serverDeaf','صمم إداري'],['streaming','مشاركة الشاشة'],['selfVideo','الكاميرا']])if(a[key]!==b[key])changes.push(`${label}: ${b[key]?'مفعّل':'متوقف'}`);if(changes.length)return write(b.guild,'🔊 حركة الفويس',who(b.member?.user)+'\n'+changes.join('\n'),'voice');});
  on('interactionCreate',i=>{if(!i.guild||!i.isChatInputCommand?.())return;return write(i.guild,'⌨️ استخدام أمر',`العضو: ${who(i.user)}\nالأمر: /${i.commandName}\nالروم: <#${i.channelId}>\nهذا تسجيل استخدام الأمر، وليس تأكيد نجاحه.`,'commands',i.channelId);});
}
function game(i,type,phase='بدء لعبة') {return write(i.guild,'🎮 '+phase,`اللعبة: ${type}\nبواسطة: ${who(i.user||i.author)}\nالروم: <#${i.channel?.id||i.channelId}>`,'games');}
module.exports={install,write,game,drain:async()=>{await Promise.all([...queues.values()].map(s=>s.tail));}};
