'use strict';
const {PermissionFlagsBits:P,MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
const {randomUUID}=require('crypto');
const store=require('./sharedStore');
const {featureAllowed}=require('./planPolicy');
const logs=require('./serverLogs');
const locks=new Map();
function locked(key,fn){const task=(locks.get(key)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(key,task);return task.finally(()=>{if(locks.get(key)===task)locks.delete(key);});}
function allowed(member){return member?.permissions?.has(P.ManageMessages)||member?.permissions?.has(P.Administrator);}
async function config(guild,member,channelId){const [cfg,site]=await Promise.all([store.getConfig(guild.id),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'warnings'))throw Error('💎 نظام التحذيرات غير متاح لخطة هذا السيرفر حسب إعدادات الأونر.');if(!cfg.warnings?.channelId)throw Error('حدد روم التحذيرات من الداشبورد أولًا.');if(channelId!==cfg.warnings.channelId)throw Error('❌ أوامر التحذيرات متاحة فقط في الروم المحدد: <#'+cfg.warnings.channelId+'>');if(!allowed(member))throw Error('❌ تحتاج صلاحية Manage Messages.');return cfg;}
async function reply(i,content){const p={content:String(content).slice(0,1950),allowedMentions:{parse:[]},flags:MessageFlags.Ephemeral};return i.deferred||i.replied?i.editReply(p):i.reply(p);}
async function roles(member,cfg,count){const levels=Array.isArray(cfg.warnings?.roleIds)?cfg.warnings.roleIds:[cfg.warnings?.role1Id,cfg.warnings?.role2Id,cfg.warnings?.role3Id];const ids=levels.filter(Boolean);if(!ids.length)return '';const desired=count?levels[Math.min(count,levels.length)-1]:null;try{for(const id of new Set(ids)){const role=member.guild.roles.cache.get(id);if(!role||!role.editable||role.managed||id===member.guild.id)throw Error('رتبة غير قابلة للإدارة');}for(const id of new Set(ids))if(id!==desired&&member.roles.cache.has(id))await member.roles.remove(id,'ZOMBI warnings');if(desired&&!member.roles.cache.has(desired))await member.roles.add(desired,'ZOMBI warnings');return '';}catch{return '\n⚠️ حُفظ السجل لكن تعذّر تحديث رتبة التحذير؛ تحقق من Manage Roles وترتيب الرتب.';}}
async function action(guild,actor,user,mode,reason='',warningId='',channelId){
 return locked(guild.id,async()=>{
  const cfg=await config(guild,actor,channelId);
  const data=await store.data(guild.id,'member-warnings.json',{}),list=Array.isArray(data[user.id])?data[user.id]:[];
  if(mode==='list')return `⚠️ تحذيرات ${user.username}: ${list.filter(w=>!w.removedAt).length}\n`+list.filter(w=>!w.removedAt).slice(-10).map(w=>`ID: ${w.id}\n${w.reason}\nبواسطة ${w.moderatorId} — ${w.createdAt}`).join('\n');
  const member=await guild.members.fetch(user.id).catch(()=>null);
  if(!member)throw Error('❌ العضو غير موجود بالسيرفر.');
  if(user.id===actor.id||user.bot||user.id===guild.ownerId||(actor.id!==guild.ownerId&&actor.roles.highest.comparePositionTo(member.roles.highest)<=0))throw Error('❌ لا يمكنك تحذير نفسك أو بوت أو عضو رتبته مساوية أو أعلى منك.');
  let record;
  if(mode==='add'){
   if(!reason.trim())throw Error('اكتب سبب التحذير.');
   record={id:randomUUID(),reason:reason.trim().slice(0,500),moderatorId:actor.id,createdAt:new Date().toISOString()};list.push(record);
  }else{
   const candidates=list.filter(w=>!w.removedAt);record=warningId?candidates.find(w=>w.id===warningId):candidates.at(-1);
   if(!record)throw Error('لا يوجد تحذير مطابق.');
   record.removedAt=new Date().toISOString();record.removedBy=actor.id;
  }
  data[user.id]=list;await store.saveData(guild.id,'member-warnings.json',data);
  const count=list.filter(w=>!w.removedAt).length,notice=await roles(member,cfg,count);
  const text=`${mode==='add'?'⚠️ إضافة تحذير':'✅ إزالة تحذير'}\nالعضو: ${user.username} (${user.id})\nالإداري: ${actor.id}\nالسبب: ${record.reason}\nID: ${record.id}\nالتحذيرات الحالية: ${count}`;
  await logs.write(guild,'⚠️ نظام التحذيرات',text,'actions');
  if(mode==='add')await user.send({content:`تحذير في ${guild.name}\n${record.reason}\nالعدد: ${count}`,allowedMentions:{parse:[]}}).catch(()=>{});
  return text+notice;
 });
}
async function handleInteraction(i){
 const cid=i.customId||'',slash=i.isChatInputCommand?.()&&['warn','warnings','unwarn'].includes(i.commandName);
 if(!i.guild||(!slash&&!/^(warning_reason:|warning_modal:)/.test(cid)))return false;
 try{
  const member=await i.guild.members.fetch(i.user.id);await config(i.guild,member,i.channelId);
  if(slash){await i.deferReply({flags:MessageFlags.Ephemeral});const mode={warn:'add',warnings:'list',unwarn:'remove'}[i.commandName];await reply(i,await action(i.guild,member,i.options.getUser('user'),mode,i.options.getString('reason')||'',i.options.getString('id')||'',i.channelId));return true;}
  const [,targetId,actorId]=cid.split(':');if(actorId!==i.user.id)throw Error('هذه العملية للإداري الذي بدأها فقط.');
  if(i.isButton()){const modal=new ModalBuilder().setCustomId(`warning_modal:${targetId}:${actorId}`).setTitle('سبب التحذير').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('warning_reason_input').setLabel('سبب التحذير').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)));await i.showModal(modal);return true;}
  await i.deferReply({flags:MessageFlags.Ephemeral});const user=await i.client.users.fetch(targetId);await reply(i,await action(i.guild,member,user,'add',i.fields.getTextInputValue('warning_reason_input'),'',i.channelId));
 }catch(e){await reply(i,e.message).catch(()=>{});}return true;
}
async function handleMessage(m){
 if(!m.guild||m.author.bot)return false;const match=m.content.trim().match(/^(تحذير|تحذيرات|ازالة تحذير|إزالة تحذير)(?:\s|$)/);if(!match)return false;
 try{const actor=await m.guild.members.fetch(m.author.id);await config(m.guild,actor,m.channelId);const user=m.mentions.users.first();if(!user)throw Error('استخدم: تحذير @العضو السبب، تحذيرات @العضو، إزالة تحذير @العضو');const mode=match[1]==='تحذير'?'add':match[1]==='تحذيرات'?'list':'remove';const reason=m.content.slice(match[0].length).replace(/<@!?\d+>/,'').trim();
 if(mode==='add'&&!reason){await m.reply({content:'اضغط لكتابة سبب التحذير.',allowedMentions:{parse:[]},components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`warning_reason:${user.id}:${m.author.id}`).setLabel('كتابة السبب').setStyle(ButtonStyle.Danger))]});return true;}
 await m.reply({content:(await action(m.guild,actor,user,mode,reason,'',m.channelId)).slice(0,1950),allowedMentions:{parse:[]}});
 }catch(e){await m.reply({content:e.message,allowedMentions:{parse:[]}}).catch(()=>{});}return true;
}
module.exports={handleInteraction,handleMessage,action};
