'use strict';
// Persistent, owner-controlled temporary voice rooms for ZOMBI Bot (discord.js v14).
const fs = require('node:fs');
const path = require('node:path');
const store = require('./sharedStore');
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
async function refreshPanel(guild,room,voice){
 const text=room.textChannelId?(guild.channels.cache.get(room.textChannelId)||await guild.channels.fetch(room.textChannelId).catch(()=>null)):null;
 if(!text||!room.panelMessageId)return;
 const panel=await text.messages.fetch(room.panelMessageId).catch(()=>null);if(!panel)return;
 await panel.edit({content:`🎛️ **لوحة التحكم بالغرفة الصوتية**\nالمالك: <@${room.ownerId}>\nالغرفة: **${voice.name}** (<#${voice.id}>)\nنوع الغرفة: ${room.triggerType||'عامة'}\nالأعضاء الحاليون: ${voice.members.size}\nالحد المسموح: ${voice.userLimit||'بلا حد'}\nيمكن للمالك أو الإدارة المخولة استخدام الأزرار.`,components:panelRows(voice.id),allowedMentions:{users:[room.ownerId]}}).catch(()=>{});
}
function triggerAccess(type,guild){
 const t=String(type||'').toLowerCase();
 let pattern=null,privateRoom=false;
 if(/police|شرطة/.test(t)){pattern=/police|شرطة|commissioner|officer|detective|dispatcher|security/i;privateRoom=true;}
 else if(/ems|medical|paramedic|إسعاف/.test(t)){pattern=/ems|medical|paramedic|doctor|nurse|hospital|إسعاف/i;privateRoom=true;}
 else if(/gang|عصابة|family/.test(t)){pattern=/gang|family|عصابة|عائلة/i;privateRoom=true;}
 else if(/interview|مقابلة/.test(t)){pattern=/owner|management|admin|moderator|recruit|interview|hr manager/i;privateRoom=true;}
 else if(/team|فريق/.test(t)){pattern=/owner|management|admin|team captain|coach|team member|gamer|player/i;privateRoom=true;}
 else if(/customer service|staff meeting|event staff|teacher|leadership|private|خاص/.test(t)){pattern=/owner|management|admin|manager|support|staff|teacher|instructor|organizer|event|sales|leadership|private|خاص/i;privateRoom=true;}
 const accessRoleIds=pattern?[...guild.roles.cache.filter(r=>r.id!==guild.id&&pattern.test(r.name)).keys()]:[];
 return {privateRoom,accessRoleIds};
}
async function createRoom(oldState,newState){
 const member=newState.member, trigger=newState.channel;
 if(!member||member.user.bot||!trigger||trigger.type!==ChannelType.GuildVoice||!trigger.name.includes('Create Room'))return;
 const guild=newState.guild, category=trigger.parent;
 if(!category||category.type!==ChannelType.GuildCategory)return;
 const triggerType=String(trigger.name).split(/Create Room/i)[1].replace(/^[\s・\-_]+/,'').trim();
 const tempSettings=await store.data(guild.id,'temporary-voice-settings.json',{defaultLimit:0,roomPrefix:'غرفة'}).catch(()=>({defaultLimit:0,roomPrefix:'غرفة'}));
 const defaultLimit=Math.max(0,Math.min(99,Number(tempSettings.defaultLimit)||0));
 const roomPrefix=String(tempSettings.roomPrefix||'غرفة').replace(/[\r\n]/g,' ').trim().slice(0,20)||'غرفة';
 const baseName=(triggerType?`${triggerType}・${member.displayName}`:`${roomPrefix} ${member.displayName}`).slice(0,95);
 const access=triggerAccess(triggerType,guild);
 const everyoneOverwrite=access.privateRoom
  ? {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]}
  : {id:guild.roles.everyone.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak]};
 const overwrites=[everyoneOverwrite,
  ...access.accessRoleIds.map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak]})),
  {id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak,PermissionFlagsBits.ManageChannels]}
 ];
 const voice=await guild.channels.create({name:baseName,type:ChannelType.GuildVoice,parent:category.id,userLimit:defaultLimit,permissionOverwrites:overwrites,reason:`Temporary room owner ${member.id}`});
 const text=await guild.channels.create({name:`تحكم-${member.user.username}`.toLowerCase().replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,90),type:ChannelType.GuildText,parent:category.id,permissionOverwrites:[
  {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
  ...[...new Set([...guild.roles.cache.filter(r=>r.permissions.has(PermissionFlagsBits.ManageChannels)||r.permissions.has(PermissionFlagsBits.Administrator)).map(r=>r.id),...access.accessRoleIds])].filter(id=>id!==guild.roles.everyone.id).map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]})),
  {id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
  ...(guild.members.me?.id?[{id:guild.members.me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}]:[])
 ],reason:`Temporary room control panel for ${member.id}`}).catch(async e=>{await voice.delete().catch(()=>{});throw e;});
 const record={guildId:guild.id,ownerId:member.id,textChannelId:text.id,categoryId:category.id,allowed:[],privateRoom:access.privateRoom,accessRoleIds:access.accessRoleIds,triggerType,createdAt:Date.now()};rooms.set(voice.id,record);save();
 const panel=await text.send({content:`🎛️ **لوحة التحكم بالغرفة الصوتية**\nالمالك: <@${member.id}>\nالغرفة: <#${voice.id}>\nنوع الغرفة: ${triggerType||'عامة'}\nالحد الحالي: ${defaultLimit||'بلا حد'}\nيمكن للمالك أو الإدارة المخولة استخدام الأزرار.`,components:panelRows(voice.id),allowedMentions:{users:[member.id]}}).catch(()=>null);
 if(panel){record.panelMessageId=panel.id;save();}
 await member.voice.setChannel(voice,'Created temporary voice room').catch(async()=>{if(!voice.members.size)await removeRoom(guild,voice.id,record);});
}
async function onButton(i){
 const [,action,id]=i.customId.split(':'); const room=rooms.get(id); if(!room||room.guildId!==i.guildId)return i.reply({content:'هذه الغرفة غير مسجلة أو تم حذفها.',ephemeral:true});
 if(!isOwnerOrAdmin(i,room))return i.reply({content:'فقط مالك الغرفة أو الإدارة المخولة يستطيع استخدام هذه الأزرار.',ephemeral:true});
 const guild=i.guild,voice=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null); if(!voice)return i.reply({content:'الغرفة غير موجودة.',ephemeral:true});
 if(['rename','limit','allow','kick','transfer'].includes(action))return i.showModal(modalFor(action,id));
 try{
  if(action==='lock'){await voice.permissionOverwrites.edit(guild.roles.everyone,{Connect:false});for(const rid of room.accessRoleIds||[])await voice.permissionOverwrites.edit(rid,{Connect:false}).catch(()=>{});room.locked=true;save();await i.reply({content:'🔒 تم قفل الغرفة أمام الأعضاء، مع بقاء المالك قادرًا على الدخول.',ephemeral:true});}
  else if(action==='unlock'){await voice.permissionOverwrites.edit(guild.roles.everyone,{Connect:room.privateRoom?false:true});for(const rid of room.accessRoleIds||[])await voice.permissionOverwrites.edit(rid,{Connect:true}).catch(()=>{});room.locked=false;save();await i.reply({content:'🔓 تم فتح الغرفة للأشخاص المصرح لهم.',ephemeral:true});}
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
  if(action==='rename'){const name=value.replace(/[\r\n]/g,' ').trim().slice(0,100);if(!name)return i.reply({content:'اسم الغرفة غير صالح.',ephemeral:true});await voice.setName(name);await refreshPanel(guild,room,voice);await i.reply({content:`تم تغيير اسم الغرفة إلى **${name}**.`,ephemeral:true});}
  else if(action==='limit'){const n=Number(value);if(!Number.isInteger(n)||n<0||n>99)return i.reply({content:'أدخل رقمًا صحيحًا بين 0 و99.',ephemeral:true});await voice.setUserLimit(n);await refreshPanel(guild,room,voice);await i.reply({content:`تم تحديد حد الغرفة إلى ${n===0?'بلا حد':n+' أعضاء'}.`,ephemeral:true});}
  else if(!/^\d{15,25}$/.test(value))return i.reply({content:'معرّف Discord غير صالح.',ephemeral:true});
  else if(action==='allow'){const member=await guild.members.fetch(value).catch(()=>null);if(!member)return i.reply({content:'لم أجد هذا العضو في السيرفر.',ephemeral:true});await voice.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true});if(!room.allowed.includes(member.id))room.allowed.push(member.id);save();await refreshPanel(guild,room,voice);await i.reply({content:`تم السماح لـ <@${member.id}> بدخول الغرفة.`,ephemeral:true,allowedMentions:{users:[]}});}
  else if(action==='kick'){const member=await guild.members.fetch(value).catch(()=>null);if(!member||member.voice.channelId!==voice.id)return i.reply({content:'العضو ليس داخل هذه الغرفة.',ephemeral:true});await member.voice.disconnect('Removed by temporary room owner');await refreshPanel(guild,room,voice);await i.reply({content:`تم إخراج <@${member.id}> من الغرفة.`,ephemeral:true,allowedMentions:{users:[]}});}
  else if(action==='transfer'){const member=await guild.members.fetch(value).catch(()=>null);if(!member)return i.reply({content:'لم أجد العضو في السيرفر.',ephemeral:true});if(member.user.bot)return i.reply({content:'لا يمكن نقل ملكية الغرفة إلى بوت.',ephemeral:true});const previousOwner=room.ownerId;await voice.permissionOverwrites.edit(previousOwner,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:false});await voice.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:true});const panelChannel=room.textChannelId?await guild.channels.fetch(room.textChannelId).catch(()=>null):null;if(panelChannel){await panelChannel.permissionOverwrites.edit(previousOwner,{ViewChannel:false,SendMessages:false,ReadMessageHistory:false}).catch(()=>{});await panelChannel.permissionOverwrites.edit(member.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}).catch(()=>{});const panelMessage=room.panelMessageId?await panelChannel.messages.fetch(room.panelMessageId).catch(()=>null):null;if(panelMessage)await panelMessage.edit({content:`🎛️ **لوحة التحكم بالغرفة الصوتية**\nالمالك: <@${member.id}>\nالغرفة: <#${voice.id}>\nالحد الحالي: ${voice.userLimit||'بلا حد'}\nيمكن للمالك أو الإدارة المخولة استخدام الأزرار.`,allowedMentions:{users:[member.id]}}).catch(()=>{});}room.ownerId=member.id;save();await refreshPanel(guild,room,voice);await i.reply({content:`تم نقل ملكية الغرفة إلى <@${member.id}>.`,ephemeral:true,allowedMentions:{users:[]}});}
 }catch(e){console.error('[TempRooms] modal failed',e);if(!i.replied)await i.reply({content:`تعذر تنفيذ الإجراء: ${e.message}`,ephemeral:true}).catch(()=>{});}
}
function install(client){
 load();
 client.on('voiceStateUpdate',async(oldState,newState)=>{
  try{
   if(newState.channel?.name?.includes('Create Room')&&newState.channelId!==oldState.channelId)await createRoom(oldState,newState);
   const newId=newState.channelId;if(newId&&rooms.has(newId))await refreshPanel(newState.guild,rooms.get(newId),newState.channel);
   const oldId=oldState.channelId;if(oldId&&rooms.has(oldId)){const room=rooms.get(oldId);const guild=oldState.guild;const ch=guild.channels.cache.get(oldId);if(ch&&ch.members.size===0)await removeRoom(guild,oldId,room);else if(ch)await refreshPanel(guild,room,ch);}
  }catch(e){console.error('[TempRooms] voice state failed:',e.message);}
 });
 client.on('interactionCreate',async i=>{try{if(i.isButton?.()&&i.customId.startsWith('ztr:'))await onButton(i);else if(i.isModalSubmit?.()&&i.customId.startsWith('ztrmodal:'))await onModal(i);}catch(e){console.error('[TempRooms] interaction failed:',e.message);}});
 client.once('ready',async()=>{for(const [id,room] of [...rooms]){const g=client.guilds.cache.get(room.guildId);if(!g){rooms.delete(id);continue;}const ch=await g.channels.fetch(id).catch(()=>null);if(!ch){const panel=room.textChannelId?await g.channels.fetch(room.textChannelId).catch(()=>null):null;if(panel)await panel.delete().catch(()=>{});rooms.delete(id);continue;}if(ch.type===ChannelType.GuildVoice&&ch.members.size===0)await removeRoom(g,id,room);}save();console.log(`🔊 Temporary voice rooms restored: ${rooms.size}`);});
}
module.exports={install};
