'use strict';
// Persistent, owner-controlled temporary voice rooms for ZOMBI Bot (discord.js v14).
const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');
const STORE = path.join(__dirname, 'data', 'temporary-voice-rooms.json');
const rooms = new Map(); // voiceChannelId -> {guildId, ownerId, textChannelId, categoryId, allowed:[]}
const locks = new Set();
function load(){ try { const raw=JSON.parse(fs.readFileSync(STORE,'utf8')); for(const [id,v] of Object.entries(raw||{})) rooms.set(id,v); } catch {} }
function save(){ try { fs.mkdirSync(path.dirname(STORE),{recursive:true}); fs.writeFileSync(STORE,JSON.stringify(Object.fromEntries(rooms),null,2)); } catch(e){ console.error('[TempRooms] save failed:',e.message); } }
const isOwnerOrAdmin = (interaction, room) => interaction.user.id===room.ownerId || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
function panelRows(id){
 const row1=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`ztr:rename:${id}`).setLabel('تغيير الاسم').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(`ztr:limit:${id}`).setLabel('حد الأعضاء').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(`ztr:lock:${id}`).setLabel('قفل').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`ztr:unlock:${id}`).setLabel('فتح').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`ztr:hide:${id}`).setLabel('إخفاء').setStyle(ButtonStyle.Secondary));
 const row2=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`ztr:show:${id}`).setLabel('إظهار').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`ztr:allow:${id}`).setLabel('السماح لعضو').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`ztr:kick:${id}`).setLabel('طرد عضو').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`ztr:transfer:${id}`).setLabel('نقل الملكية').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`ztr:delete:${id}`).setLabel('حذف الغرفة').setStyle(ButtonStyle.Danger));
 return [row1,row2];
}
function modalFor(action,id){
 const fields={rename:['اسم الغرفة','room_name','اسم جديد للغرفة','1','100'],limit:['حد الأعضاء','room_limit','أدخل رقمًا من 0 إلى 99 (0 = بلا حد)','1','2'],allow:['السماح لعضو','target_id','أدخل Discord User ID للعضو','17','20'],kick:['طرد عضو','target_id','أدخل Discord User ID للعضو الموجود في الغرفة','17','20'],transfer:['نقل الملكية','target_id','أدخل Discord User ID للمالك الجديد الموجود في السيرفر','17','20']};
 const f=fields[action]; if(!f)return null;
 return new ModalBuilder().setCustomId(`ztrmodal:${action}:${id}`).setTitle(f[0]).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(f[1]).setLabel(f[2]).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(Number(f[3])).setMaxLength(Number(f[4]))));
}
async function removeRoom(guild,id,room){
 const voice=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null);
 const text=room.textChannelId?(guild.channels.cache.get(room.textChannelId)||await guild.channels.fetch(room.textChannelId).catch(()=>null)):null;
 rooms.delete(id); save();
 if(text)await text.delete('Temporary voice room removed').catch(()=>{});
 if(voice)await voice.delete('Temporary voice room empty or deleted').catch(()=>{});
}
async function createRoom(oldState,newState){
 const member=newState.member, trigger=newState.channel;
 if(!member||member.user.bot||!trigger||trigger.type!==ChannelType.GuildVoice||!trigger.name.includes('Create Room'))return;
 const guild=newState.guild, category=trigger.parent;
 if(!category||category.type!==ChannelType.GuildCategory)return;
 const baseName=`غرفة ${member.displayName}`.slice(0,95);
 const overwrites=[
  {id:guild.roles.everyone.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak],deny:[]},
  {id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak,PermissionFlagsBits.ManageChannels],deny:[]}
 ];
 const voice=await guild.channels.create({name:baseName,type:ChannelType.GuildVoice,parent:category.id,userLimit:0,permissionOverwrites:overwrites,reason:`Temporary room owner ${member.id}`});
 const text=await guild.channels.create({name:`تحكم-${member.user.username}`.toLowerCase().replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,90),type:ChannelType.GuildText,parent:category.id,permissionOverwrites:[
  {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
  ...guild.roles.cache.filter(r=>r.permissions.has(PermissionFlagsBits.ManageChannels)||r.permissions.has(PermissionFlagsBits.Administrator)).map(r=>({id:r.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]})),
  {id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
  {id:guild.members.me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
 ],reason:`Temporary room control panel for ${member.id}`}).catch(async e=>{await voice.delete().catch(()=>{});throw e;});
 const record={guildId:guild.id,ownerId:member.id,textChannelId:text.id,categoryId:category.id,allowed:[],createdAt:Date.now()};rooms.set(voice.id,record);save();
 await text.send({content:`🎛️ **لوحة التحكم بالغرفة الصوتية**\nالمالك: <@${member.id}>\nالغرفة: <#${voice.id}>\nيمكن للمالك أو الإدارة المخولة استخدام الأزرار.`,components:panelRows(voice.id),allowedMentions:{users:[member.id]}}).catch(()=>{});
 await member.voice.setChannel(voice,'Created temporary voice room').catch(async()=>{if(!voice.members.size)await removeRoom(guild,voice.id,record);});
}
async function onButton(i){
 const [,action,id]=i.customId.split(':'); const room=rooms.get(id); if(!room||room.guildId!==i.guildId)return i.reply({content:'هذه الغرفة غير مسجلة أو تم حذفها.',ephemeral:true});
 if(!isOwnerOrAdmin(i,room))return i.reply({content:'فقط مالك الغرفة أو الإدارة المخولة يستطيع استخدام هذه الأزرار.',ephemeral:true});
 const guild=i.guild,voice=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null); if(!voice)return i.reply({content:'الغرفة غير موجودة.',ephemeral:true});
 if(['rename','limit','allow','kick','transfer'].includes(action))return i.showModal(modalFor(action,id));
 try{
  if(action==='lock'){await voice.permissionOverwrites.edit(guild.roles.everyone,{Connect:false});await i.reply({content:'🔒 تم قفل الغرفة أمام الأعضاء غير المصرح لهم.',ephemeral:true});}
  else if(action==='unlock'){await voice.permissionOverwrites.edit(guild.roles.everyone,{Connect:true,ViewChannel:true});await i.reply({content:'🔓 تم فتح الغرفة.',ephemeral:true});}
  else if(action==='hide'){await voice.permissionOverwrites.edit(guild.roles.everyone,{ViewChannel:false});await i.reply({content:'🙈 تم إخفاء الغرفة عن الأعضاء غير المصرح لهم.',ephemeral:true});}
  else if(action==='show'){await voice.permissionOverwrites.edit(guild.roles.everyone,{ViewChannel:true});await i.reply({content:'👁️ تم إظهار الغرفة.',ephemeral:true});}
  else if(action==='delete'){await i.reply({content:'🗑️ جارٍ حذف الغرفة...',ephemeral:true});await removeRoom(guild,id,room);}
  else return i.reply({content:'إجراء غير معروف.',ephemeral:true});
 }catch(e){console.error('[TempRooms] button failed',e);if(!i.replied&&!i.deferred)await i.reply({content:`تعذر تنفيذ الإجراء: ${e.message}`,ephemeral:true}).catch(()=>{});}
}
async function onModal(i){
 const [,action,id]=i.customId.split(':');const room=rooms.get(id);if(!room||room.guildId!==i.guildId)return i.reply({content:'الغرفة غير موجودة.',ephemeral:true});
 if(!isOwnerOrAdmin(i,room))return i.reply({content:'لا تملك صلاحية التحكم بهذه الغرفة.',ephemeral:true});
 const guild=i.guild,voice=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null);if(!voice)return i.reply({content:'الغرفة غير موجودة.',ephemeral:true});
 const value=i.fields.getTextInputValue(action==='rename'?'room_name':action==='limit'?'room_limit':'target_id').trim();
 try{
  if(action==='rename'){const name=value.replace(/[\r\n]/g,' ').trim().slice(0,100);if(!name)return i.reply({content:'اسم الغرفة غير صالح.',ephemeral:true});await voice.setName(name);await i.reply({content:`تم تغيير اسم الغرفة إلى **${name}**.`,ephemeral:true});}
  else if(action==='limit'){const n=Number(value);if(!Number.isInteger(n)||n<0||n>99)return i.reply({content:'أدخل رقمًا صحيحًا بين 0 و99.',ephemeral:true});await voice.setUserLimit(n);await i.reply({content:`تم تحديد حد الغرفة إلى ${n===0?'بلا حد':n+' أعضاء'}.`,ephemeral:true});}
  else if(!/^\d{15,25}$/.test(value))return i.reply({content:'معرّف Discord غير صالح.',ephemeral:true});
  else if(action==='allow'){const member=await guild.members.fetch(value).catch(()=>null);if(!member)return i.reply({content:'لم أجد هذا العضو في السيرفر.',ephemeral:true});await voice.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true});if(!room.allowed.includes(member.id))room.allowed.push(member.id);save();await i.reply({content:`تم السماح لـ <@${member.id}> بدخول الغرفة.`,ephemeral:true,allowedMentions:{users:[]}});}
  else if(action==='kick'){const member=await guild.members.fetch(value).catch(()=>null);if(!member||member.voice.channelId!==voice.id)return i.reply({content:'العضو ليس داخل هذه الغرفة.',ephemeral:true});await member.voice.disconnect('Removed by temporary room owner');await i.reply({content:`تم إخراج <@${member.id}> من الغرفة.`,ephemeral:true,allowedMentions:{users:[]}});}
  else if(action==='transfer'){const member=await guild.members.fetch(value).catch(()=>null);if(!member)return i.reply({content:'لم أجد العضو في السيرفر.',ephemeral:true});await voice.permissionOverwrites.edit(room.ownerId,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:false});await voice.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:true});room.ownerId=member.id;save();await i.reply({content:`تم نقل ملكية الغرفة إلى <@${member.id}>.`,ephemeral:true,allowedMentions:{users:[]}});}
 }catch(e){console.error('[TempRooms] modal failed',e);if(!i.replied)await i.reply({content:`تعذر تنفيذ الإجراء: ${e.message}`,ephemeral:true}).catch(()=>{});}
}
function install(client){
 load();
 client.on('voiceStateUpdate',async(oldState,newState)=>{
  try{
   if(newState.channel?.name?.includes('Create Room')&&newState.channelId!==oldState.channelId)await createRoom(oldState,newState);
   const oldId=oldState.channelId;if(oldId&&rooms.has(oldId)){const room=rooms.get(oldId);const guild=oldState.guild;const ch=guild.channels.cache.get(oldId);if(ch&&ch.members.size===0)await removeRoom(guild,oldId,room);}
  }catch(e){console.error('[TempRooms] voice state failed:',e.message);}
 });
 client.on('interactionCreate',async i=>{try{if(i.isButton?.()&&i.customId.startsWith('ztr:'))await onButton(i);else if(i.isModalSubmit?.()&&i.customId.startsWith('ztrmodal:'))await onModal(i);}catch(e){console.error('[TempRooms] interaction failed:',e.message);}});
 client.once('ready',async()=>{for(const [id,room] of [...rooms]){const g=client.guilds.cache.get(room.guildId);if(!g){rooms.delete(id);continue;}const ch=await g.channels.fetch(id).catch(()=>null);if(!ch){const panel=room.textChannelId?await g.channels.fetch(room.textChannelId).catch(()=>null):null;if(panel)await panel.delete().catch(()=>{});rooms.delete(id);}}save();console.log(`🔊 Temporary voice rooms restored: ${rooms.size}`);});
}
module.exports={install};
