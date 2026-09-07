const serverLogs = require('./serverLogs');
const fullBank=require('./fullBank');
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, ChannelType, MessageFlags
} = require('discord.js');
const store = require('./sharedStore');
const citySystems = require('./citySystems');
const storeSystem = require('./storeSystem');
const { dashboard, publicCommands } = require('./publicCommands');
const { GAME_DEFS, PUBLIC_GAME_IDS, featureAllowed, gameAllowed, limitFor, planNameForConfig, gameDef } = require('./planPolicy');

let client=null;
let homeGuildGetter=()=>'';
const activeGames=new Map();
const rouletteGames=new Map();
const chairsGames=new Map();
const mafiaGames=new Map();
const killerGames=new Map();
const msgCooldown=new Map();
const voiceSessions=new Map();
const premiumPromoSeen=new Map();
let siteCache={at:0,value:null};

function baseUrl(){return String(process.env.PUBLIC_BASE_URL||process.env.DASHBOARD_PUBLIC_URL||'').replace(/\/$/,'');}
function dashboardUrl(gid){const b=baseUrl();return b?`${b}/dashboard/${gid}`:'';}
function color(cfg){const raw=String(cfg?.branding?.color||'#7c3aed').replace('#','');const n=parseInt(raw,16);return Number.isFinite(n)?n:0x7c3aed;}
function currency(cfg){return `${cfg.currency?.emoji||'🪙'} ${cfg.currency?.name||'ZOM'}`;}
function isAdmin(i){return Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||i.memberPermissions?.has(PermissionFlagsBits.Administrator));}
function canStartGames(subject,cfg){
  const perms=subject?.memberPermissions||subject?.permissions;
  if(perms?.has?.(PermissionFlagsBits.Administrator)||perms?.has?.(PermissionFlagsBits.ManageGuild))return true;
  const selected=Array.isArray(cfg?.games?.startRoleIds)?cfg.games.startRoleIds:[];
  if(!selected.length)return false;
  const roles=subject?.member?.roles?.cache||subject?.roles?.cache;
  return selected.some(id=>roles?.has?.(id));
}
function schedulePremiumPromo(i,cfg,site){
  const promo=site?.premiumPromo||{};
  if(!i?.isChatInputCommand?.()||store.isPremium(cfg)||promo.enabled===false||i.commandName==='premium')return;
  const chance=Math.max(0,Math.min(100,Number(promo.chancePercent??40)));if(chance<=0||Math.random()*100>chance)return;
  const key=`${i.guild.id}:${i.user.id}`,now=Date.now(),cooldown=Math.max(1,Number(promo.cooldownMinutes||10))*60000;
  if(now-Number(premiumPromoSeen.get(key)||0)<cooldown)return;
  premiumPromoSeen.set(key,now);
  const text=String(promo.text||'💎 اشترك في ZOMBI Premium وافتح مميزات وألعاب أكثر من Dashboard.').slice(0,500);
  const url=baseUrl()?`${baseUrl()}/premium`:'';
  const components=url?[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💎 Premium').setURL(url))]:[];
  const t=setTimeout(async()=>{try{const payload={content:text,components,flags:MessageFlags.Ephemeral};if(i.replied||i.deferred)await i.followUp(payload);else await i.reply(payload);}catch{}},1200);t.unref?.();
}

function schedulePremiumPromoMessage(m,cfg,site){
  const raw=String(m?.content||'').trim();
  const looks=/^[-#!]/.test(raw)||/^(لوحة|بنك|نهب|راتب|رصيد|تحويل|سحب|ايداع|إيداع|زوم|zom|bank|عصابة|gang|مهمة|متجر|store)(?:\s|$)/i.test(raw);
  const promo=site?.premiumPromo||{};
  if(!looks||store.isPremium(cfg)||promo.enabled===false)return;
  const chance=Math.max(0,Math.min(100,Number(promo.chancePercent??40)));if(chance<=0||Math.random()*100>chance)return;
  const key=`${m.guild.id}:${m.author.id}`,now=Date.now(),cooldown=Math.max(1,Number(promo.cooldownMinutes||10))*60000;
  if(now-Number(premiumPromoSeen.get(key)||0)<cooldown)return;
  premiumPromoSeen.set(key,now);
  const text=String(promo.text||'💎 اشترك في ZOMBI Premium وافتح مميزات وألعاب أكثر من Dashboard.').slice(0,500);
  const url=baseUrl()?`${baseUrl()}/premium`:'';
  const components=url?[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💎 Premium').setURL(url))]:[];
  const t=setTimeout(async()=>{try{const sent=await m.reply({content:text,components,allowedMentions:{repliedUser:false}});const d=setTimeout(()=>sent?.delete?.().catch(()=>{}),15000);d.unref?.();}catch{}},1200);t.unref?.();
}
function normalizeAnswer(s){return String(s||'').trim().toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ');}
function randomItem(arr){return Array.isArray(arr)&&arr.length?arr[Math.floor(Math.random()*arr.length)]:null;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function siteConfig(force=false){if(!force&&siteCache.value&&Date.now()-siteCache.at<10000)return siteCache.value;siteCache={at:Date.now(),value:await store.getGlobalConfig()};return siteCache.value;}
function featureOn(cfg,site,key){return Boolean(cfg?.features?.[key]!==false&&featureAllowed(site,cfg,key));}
function applyPlanPresentation(cfg,site){if(!cfg)return cfg;if(!featureAllowed(site,cfg,'customCurrency'))cfg.currency={name:'ZOM',emoji:'🪙'};if(!featureAllowed(site,cfg,'customBranding'))cfg.branding={...(cfg.branding||{}),color:'#7c3aed',customName:'',customFooter:''};if(!featureAllowed(site,cfg,'customBotProfile'))cfg.branding={...(cfg.branding||{}),botNickname:'',panelLogoUrl:'',panelBannerUrl:'',avatarUrl:'',bannerUrl:''};return cfg;}
function planLabel(cfg){return planNameForConfig(cfg)==='premium_plus'?'💎 PREMIUM+':planNameForConfig(cfg)==='premium'?'💎 PREMIUM':'🆓 FREE';}
async function syncGuildBotProfile(guild,cfg,site){
  if(!guild)return;
  const allowed=featureAllowed(site,cfg,'customBotProfile');
  const desired=allowed?String(cfg?.branding?.botNickname||'').trim().slice(0,32):'';
  const me=guild.members.me||await guild.members.fetchMe().catch(()=>null);if(!me)return;
  const current=String(me.nickname||'');
  if(current===desired)return;
  await me.setNickname(desired||null,'ZOMBI Dashboard plan/profile sync').catch(e=>console.warn(`⚠️ Nickname sync ${guild.name}:`,e?.message||e));
}
function deniedText(cfg,key){const plan=planNameForConfig(cfg)==='premium_plus'?'Premium+':planNameForConfig(cfg)==='premium'?'Premium':'Free';return `❌ ميزة **${key}** غير متاحة حاليًا في خطة **${plan}** حسب إعدادات صاحب البوت.`;}
async function logAction(guild,cfg,text){return serverLogs.write(guild,'🤖 إجراء البوت',text,'actions');}
async function savePanelPointer(guildId,channelKey,channelId,sectionKey,messageId){const raw=await store.getConfig(guildId);raw.channels=raw.channels||{};raw[sectionKey]=raw[sectionKey]||{};raw.channels[channelKey]=String(channelId||'');raw[sectionKey].panelMessageId=String(messageId||'');return store.saveConfig(guildId,raw);}

const PRIVATE_SLASH_COMMANDS=new Set(['داشبورد','setup','daily','bank','store','gang','premium','help','admin']);
async function deferPublicSlash(i){if(!i?.isChatInputCommand?.()||i.deferred||i.replied)return;if(PRIVATE_SLASH_COMMANDS.has(i.commandName))await i.deferReply({flags:MessageFlags.Ephemeral});else await i.deferReply();}
async function safeReply(i,payload={}){const opts={...(payload||{})},wantsEphemeral=opts.ephemeral===true;delete opts.ephemeral;if(i.deferred){delete opts.flags;return i.editReply(opts);}if(i.replied){if(wantsEphemeral)opts.flags=MessageFlags.Ephemeral;return i.followUp(opts);}if(wantsEphemeral)opts.flags=MessageFlags.Ephemeral;return i.reply(opts);}
async function componentNotice(i,payload){if(i.deferred||i.replied)return i.followUp({...payload,flags:payload.ephemeral===false?undefined:MessageFlags.Ephemeral}).catch(()=>{});return i.reply({...payload,flags:payload.ephemeral===false?undefined:MessageFlags.Ephemeral}).catch(()=>{});}

async function handlePremiumTextLock(m){
  if(!m?.guild||m.author?.bot)return false;
  const raw=String(m.content||'').trim();
  if(raw!=='ق'&&raw!=='ف')return false;

  // احذف رسالة الأمر نفسها فورًا (إذا كان لدى البوت Manage Messages).
  await m.delete().catch(()=>{});

  const cfg=await store.getConfig(m.guild.id);
  const sendTemp=async text=>{
    const sent=await m.channel.send({content:text}).catch(()=>null);
    if(sent){const t=setTimeout(()=>sent.delete().catch(()=>{}),5000);t.unref?.();}
    return sent;
  };

  if(!featureAllowed(await siteConfig(true),cfg,'textChannelLock')){
    await sendTemp('💎 أمرَا **ق / ف** غير متاحين في خطة سيرفرك. راجع خطط Premium وPremium+ من الموقع.');
    return true;
  }

  const memberPerms=m.member?.permissions;
  if(!memberPerms?.has(PermissionFlagsBits.ManageChannels)&&!memberPerms?.has(PermissionFlagsBits.Administrator)){
    await sendTemp('❌ تحتاج صلاحية **Manage Channels** لاستخدام هذا الأمر.');
    return true;
  }

  if(!m.channel?.permissionOverwrites?.edit){
    await sendTemp('❌ هذا الأمر يعمل داخل الرومات التي تدعم صلاحيات القفل والفتح فقط.');
    return true;
  }

  const me=m.guild.members.me||await m.guild.members.fetchMe().catch(()=>null);
  const botPerms=me?.permissionsIn?.(m.channel);
  if(!botPerms?.has(PermissionFlagsBits.Administrator)&&!botPerms?.has(PermissionFlagsBits.ManageRoles)){
    await sendTemp('❌ البوت يحتاج صلاحية **Manage Roles** أو **Administrator** حتى يغيّر صلاحيات الشات.');
    return true;
  }

  try{
    const locking=raw==='ق';
    await m.channel.permissionOverwrites.edit(
      m.guild.roles.everyone,
      {SendMessages:locking?false:null},
      {reason:`ZOMBI Premium text ${locking?'lock':'unlock'} by ${m.author.tag}`}
    );
    await sendTemp(locking?'🔒 تم قفل الشات بنجاح ✅':'🔓 تم فتح الشات بنجاح ✅');
  }catch(error){
    console.error('❌ Premium text lock/unlock:',error);
    await sendTemp('❌ ما قدرت أغيّر حالة الشات. تأكد من صلاحيات البوت وترتيب رتبته.');
  }
  return true;
}

function dashboardEmbed(guild,cfg){const avatar=client.user?.displayAvatarURL?.()||null;return new EmbedBuilder().setColor(color(cfg)).setAuthor({name:'ZOMBI • Dashboard',...(avatar?{iconURL:avatar}:{})}).setTitle(`⚙️ لوحة تحكم ${guild.name}`).setDescription('اضغط الزر بالأسفل لفتح لوحة التحكم الخاصة بهذا السيرفر.\n\n🔐 يظهر التحكم فقط لمالك السيرفر أو من لديه **Manage Server**.').addFields({name:'الخطة',value:planLabel(cfg),inline:true},{name:'حالة الإعداد',value:cfg.setupComplete?'✅ جاهز':'⚠️ يحتاج إعداد',inline:true},{name:'Server ID',value:`\`${guild.id}\``,inline:false}).setFooter({text:'ZOMBI • Public Discord Bot'}).setTimestamp();}
async function replyDashboard(i){if(!isAdmin(i))return safeReply(i,{content:'❌ تحتاج صلاحية Manage Server.',ephemeral:true});const cfg=await store.getConfig(i.guild.id),url=dashboardUrl(i.guild.id),components=url?[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('فتح Dashboard').setEmoji('🌐').setURL(url))]:[];return safeReply(i,{content:url?undefined:'⚠️ رابط الموقع لم يتم ضبطه بعد من صاحب البوت.',embeds:[dashboardEmbed(i.guild,cfg)],components,ephemeral:true});}

async function economyCommand(i,cfg,site){if(!featureOn(cfg,site,'economy'))return safeReply(i,{content:deniedText(cfg,'Economy'),ephemeral:true});const gid=i.guild.id,uid=i.user.id,cmd=i.commandName;
  if(cmd==='balance'){const target=i.options.getUser('user')||i.user,u=await store.getUser(gid,target.id);return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(`💰 رصيد ${target.username}`).setDescription(`**${u.balance.toLocaleString()}** ${currency(cfg)}`)]});}
  if(cmd==='daily'){const now=Date.now(),cd=cfg.economy.dailyCooldownHours*3600000;let out;await store.updateUser(gid,uid,u=>{if(now-u.lastDaily<cd)out={wait:cd-(now-u.lastDaily)};else{u.balance+=cfg.economy.dailyAmount;u.lastDaily=now;out={amount:cfg.economy.dailyAmount,balance:u.balance};}});if(out.wait)return safeReply(i,{content:`⏳ ارجع بعد حوالي **${Math.ceil(out.wait/3600000)} ساعة**.`,ephemeral:true});return safeReply(i,{content:`🎁 أخذت **${out.amount.toLocaleString()}** ${currency(cfg)}. رصيدك: **${out.balance.toLocaleString()}**`});}
  if(cmd==='pay'){const target=i.options.getUser('user'),amount=i.options.getInteger('amount');if(target.bot||target.id===uid)return safeReply(i,{content:'❌ اختر عضوًا آخر.',ephemeral:true});const max=limitFor(site,cfg,'maxTransferAmount');if(amount>max)return safeReply(i,{content:`❌ أقصى تحويل في خطتك هو **${max.toLocaleString()}** ${currency(cfg)}.`,ephemeral:true});const sender=await store.getUser(gid,uid),cd=Math.max(0,Number(cfg.economy.transferCooldownSeconds||0))*1000,now=Date.now();if(cd&&now-Number(sender.lastTransfer||0)<cd)return safeReply(i,{content:`⏳ انتظر **${Math.ceil((cd-(now-Number(sender.lastTransfer||0)))/1000)} ثانية** قبل التحويل مرة ثانية.`,ephemeral:true});const tr=await store.transferBalance(gid,uid,target.id,amount);if(!tr.ok)return safeReply(i,{content:'❌ رصيدك غير كافٍ.',ephemeral:true});await store.updateUser(gid,uid,u=>u.lastTransfer=now);await logAction(i.guild,cfg,`💸 ${i.user.tag} حوّل ${amount.toLocaleString()} إلى ${target.tag}.`);return safeReply(i,{content:`✅ تم تحويل **${amount.toLocaleString()}** ${currency(cfg)} إلى ${target}.`});}
  if(cmd==='leaderboard'){const e=await store.getEconomy(gid),rows=Object.entries(e).sort((a,b)=>Number(b[1].balance||0)-Number(a[1].balance||0)).slice(0,10),lines=rows.length?rows.map(([id,u],n)=>`**${n+1}.** <@${id}> — **${Number(u.balance||0).toLocaleString()}**`).join('\n'):'لا يوجد أرصدة بعد.';return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏆 الأغنى').setDescription(lines)]});}
}
async function profileCommand(i,cfg,site){if(!featureOn(cfg,site,'economy')&&!featureOn(cfg,site,'levels'))return safeReply(i,{content:'❌ الملف الشخصي غير متاح لأن Economy وLevels معطلان.',ephemeral:true});const target=i.options.getUser('user')||i.user,u=await store.getUser(i.guild.id,target.id),bank=await fullBank.get(i.guild.id,cfg),account=bank.getUser(target.id);return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(`👤 ${target.username}`).setThumbnail(target.displayAvatarURL()).addFields({name:'المحفظة',value:`${u.balance.toLocaleString()} ${currency(cfg)}`,inline:true},{name:'البنك',value:`${account.bank.toLocaleString()} ${currency(cfg)}`,inline:true},{name:'المستوى',value:`⭐ ${u.level} • ${u.xp.toLocaleString()} XP`,inline:false})]});}
async function bankCommand(i,cfg,site){
  if(!featureOn(cfg,site,'bank'))return safeReply(i,{content:deniedText(cfg,'Bank'),ephemeral:true});
  const sub=i.options.getSubcommand(),gid=i.guild.id,uid=i.user.id;
  if(sub==='balance'){const u=await store.getUser(gid,uid);return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏦 حسابك البنكي').addFields({name:'المحفظة',value:`${u.balance.toLocaleString()} ${currency(cfg)}`,inline:true},{name:'البنك',value:`${u.bankBalance.toLocaleString()} ${currency(cfg)}`,inline:true})],ephemeral:true});}
  if(sub==='deposit'&&cfg.bank?.depositEnabled===false)return safeReply(i,{content:'❌ الإيداع معطّل من إدارة السيرفر.',ephemeral:true});
  if(sub==='withdraw'&&cfg.bank?.withdrawEnabled===false)return safeReply(i,{content:'❌ السحب معطّل من إدارة السيرفر.',ephemeral:true});
  const amount=i.options.getInteger('amount'),max=Math.min(Number(cfg.bank?.maxTransaction||1e9),limitFor(site,cfg,'maxBankTransaction'));
  if(amount>max)return safeReply(i,{content:`❌ أقصى عملية بنك هي **${max.toLocaleString()}** ${currency(cfg)}.`,ephemeral:true});
  let result;await store.updateUser(gid,uid,u=>{if(sub==='deposit'){if(u.balance<amount){result='wallet';return;}u.balance-=amount;u.bankBalance+=amount;result='ok';}else{if(u.bankBalance<amount){result='bank';return;}u.bankBalance-=amount;u.balance+=amount;result='ok';}});
  if(result==='wallet')return safeReply(i,{content:'❌ رصيد المحفظة غير كافٍ.',ephemeral:true});if(result==='bank')return safeReply(i,{content:'❌ رصيد البنك غير كافٍ.',ephemeral:true});
  const u=await store.getUser(gid,uid);await logAction(i.guild,cfg,`🏦 ${i.user.tag}: ${sub==='deposit'?'إيداع':'سحب'} ${amount.toLocaleString()}.`);return safeReply(i,{content:`✅ تمت العملية. المحفظة **${u.balance.toLocaleString()}** • البنك **${u.bankBalance.toLocaleString()}** ${currency(cfg)}`,ephemeral:true});
}


function bankPanelPayload(cfg){
  const title=cfg.bank?.title||'🏦 ZOMBI City Bank';
  const description=(cfg.bank?.description||'إيداع، سحب وتحويل رصيد البنك.').trim();
  const footer=cfg.branding?.customFooter||cfg.branding?.footer||'ZOMBI • BANK';
  return {
    embeds:[
      new EmbedBuilder()
        .setColor(color(cfg))
        .setTitle(title)
        .setDescription(`${description}\n\n🔒 تفاصيل حسابك والعمليات تظهر لك وحدك.`)
        .setFooter({text:footer})
    ],
    components:[
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pub:bank:balance').setLabel('حسابي').setEmoji('🏦').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pub:bank:deposit').setLabel('إيداع').setEmoji('📥').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pub:bank:withdraw').setLabel('سحب').setEmoji('📤').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pub:bank:transfer').setLabel('تحويل').setEmoji('💸').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pub:bank:top').setLabel('التوب').setEmoji('🏆').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function amountModal(kind,title){
  return new ModalBuilder()
    .setCustomId(`pub:bank:modal:${kind}`)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('المبلغ')
          .setPlaceholder('مثال: 500')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function transferModal(){
  return new ModalBuilder()
    .setCustomId('pub:bank:modal:transfer')
    .setTitle('تحويل رصيد')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('target')
          .setLabel('ID العضو')
          .setPlaceholder('ضع User ID')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('المبلغ')
          .setPlaceholder('مثال: 500')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function parsedPositiveAmount(raw){
  const clean=String(raw||'').replace(/[,\s]/g,'');
  if(!/^\d+$/.test(clean))return 0;
  const n=Number(clean);
  return Number.isSafeInteger(n)&&n>0?n:0;
}

async function handleBankPanelInteraction(i,cfg,site){
  if(!featureOn(cfg,site,'bank')){
    await componentNotice(i,{content:deniedText(cfg,'Bank')});
    return true;
  }
  const cid=String(i.customId||'');
  const gid=i.guild.id,uid=i.user.id;

  if(i.isButton()){
    if(cid==='pub:bank:balance'){
      const u=await store.getUser(gid,uid);
      await componentNotice(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏦 حسابك البنكي').addFields(
        {name:'المحفظة',value:`${u.balance.toLocaleString()} ${currency(cfg)}`,inline:true},
        {name:'البنك',value:`${u.bankBalance.toLocaleString()} ${currency(cfg)}`,inline:true}
      )]});
      return true;
    }
    if(cid==='pub:bank:deposit'){
      if(cfg.bank?.depositEnabled===false){await componentNotice(i,{content:'❌ الإيداع معطّل من إدارة السيرفر.'});return true;}
      await i.showModal(amountModal('deposit','إيداع في البنك'));
      return true;
    }
    if(cid==='pub:bank:withdraw'){
      if(cfg.bank?.withdrawEnabled===false){await componentNotice(i,{content:'❌ السحب معطّل من إدارة السيرفر.'});return true;}
      await i.showModal(amountModal('withdraw','سحب من البنك'));
      return true;
    }
    if(cid==='pub:bank:transfer'){
      await i.showModal(transferModal());
      return true;
    }
    if(cid==='pub:bank:top'){
      const e=await store.getEconomy(gid);
      const rows=Object.entries(e).sort((a,b)=>Number(b[1]?.bankBalance||0)-Number(a[1]?.bankBalance||0)).slice(0,10);
      const lines=rows.length?rows.map(([id,u],n)=>`**${n+1}.** <@${id}> — **${Number(u?.bankBalance||0).toLocaleString()}**`).join('\n'):'لا توجد أرصدة بنكية بعد.';
      await componentNotice(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏆 أعلى الأرصدة البنكية').setDescription(lines)]});
      return true;
    }
  }

  if(i.isModalSubmit()){
    const action=cid.split(':').pop();
    if(!['deposit','withdraw','transfer'].includes(action))return false;
    const amount=parsedPositiveAmount(i.fields.getTextInputValue('amount'));
    if(!amount){await componentNotice(i,{content:'❌ اكتب مبلغًا صحيحًا أكبر من 0.'});return true;}

    if(action==='deposit'||action==='withdraw'){
      const max=Math.min(Number(cfg.bank?.maxTransaction||1e9),limitFor(site,cfg,'maxBankTransaction'));
      if(amount>max){await componentNotice(i,{content:`❌ أقصى عملية بنك هي **${max.toLocaleString()}** ${currency(cfg)}.`});return true;}
      if(action==='deposit'&&cfg.bank?.depositEnabled===false){await componentNotice(i,{content:'❌ الإيداع معطّل من إدارة السيرفر.'});return true;}
      if(action==='withdraw'&&cfg.bank?.withdrawEnabled===false){await componentNotice(i,{content:'❌ السحب معطّل من إدارة السيرفر.'});return true;}
      let result='ok';
      const u=await store.updateUser(gid,uid,user=>{
        if(action==='deposit'){
          if(user.balance<amount){result='wallet';return;}
          user.balance-=amount;user.bankBalance+=amount;
        }else{
          if(user.bankBalance<amount){result='bank';return;}
          user.bankBalance-=amount;user.balance+=amount;
        }
      });
      if(result==='wallet'){await componentNotice(i,{content:'❌ رصيد المحفظة غير كافٍ.'});return true;}
      if(result==='bank'){await componentNotice(i,{content:'❌ رصيد البنك غير كافٍ.'});return true;}
      await logAction(i.guild,cfg,`🏦 ${i.user.tag}: ${action==='deposit'?'إيداع':'سحب'} ${amount.toLocaleString()}.`);
      await componentNotice(i,{content:`✅ تمت العملية. المحفظة **${u.balance.toLocaleString()}** • البنك **${u.bankBalance.toLocaleString()}** ${currency(cfg)}`});
      return true;
    }

    const rawTarget=String(i.fields.getTextInputValue('target')||'');
    const m=rawTarget.match(/\d{15,25}/);
    const targetId=m?.[0]||'';
    if(!targetId||targetId===uid){await componentNotice(i,{content:'❌ ضع ID عضو آخر بشكل صحيح.'});return true;}
    const target=await i.guild.members.fetch(targetId).catch(()=>null);
    if(!target||target.user?.bot){await componentNotice(i,{content:'❌ العضو غير موجود في هذا السيرفر.'});return true;}
    const max=limitFor(site,cfg,'maxTransferAmount');
    if(amount>max){await componentNotice(i,{content:`❌ أقصى تحويل في خطتك هو **${max.toLocaleString()}** ${currency(cfg)}.`});return true;}
    const sender=await store.getUser(gid,uid),cd=Math.max(0,Number(cfg.economy?.transferCooldownSeconds||0))*1000,now=Date.now();
    if(cd&&now-Number(sender.lastTransfer||0)<cd){await componentNotice(i,{content:`⏳ انتظر **${Math.ceil((cd-(now-Number(sender.lastTransfer||0)))/1000)} ثانية** قبل التحويل مرة ثانية.`});return true;}
    const tr=await store.transferBalance(gid,uid,targetId,amount);
    if(!tr.ok){await componentNotice(i,{content:'❌ رصيد محفظتك غير كافٍ.'});return true;}
    await store.updateUser(gid,uid,u=>u.lastTransfer=now);
    await logAction(i.guild,cfg,`💸 ${i.user.tag} حوّل ${amount.toLocaleString()} إلى ${target.user.tag}.`);
    await componentNotice(i,{content:`✅ تم تحويل **${amount.toLocaleString()}** ${currency(cfg)} إلى <@${targetId}>.`});
    return true;
  }
  return false;
}

async function sendBankPanel(guild,channel,cfg,siteArg=null){
  const site=siteArg||await siteConfig();
  if(!featureOn(cfg,site,'bank'))throw new Error('Bank غير متاح لهذه الخطة.');
  const target=channel||guild.channels.cache.get(cfg.channels?.bankPanel);
  if(!target?.isTextBased())throw new Error('حدد روم لوحة البنك من Dashboard أولًا.');
  const payload=(await fullBank.get(guild.id,cfg,guild.id===String(homeGuildGetter?.()||''))).createBankPanel();
  let msg=null;
  const oldId=String(cfg.bank?.panelMessageId||'');
  if(oldId)msg=await target.messages.fetch(oldId).catch(()=>null);
  if(msg)await msg.edit(payload);
  else msg=await target.send(payload);
  await savePanelPointer(guild.id,'bankPanel',target.id,'bank',msg.id);
  return msg;
}

function gameRule(cfg,site,type){const raw=cfg.games?.quickGameSettings?.[type]||{rounds:cfg.games?.rounds||5,roundTimeSeconds:cfg.games?.roundTimeSeconds||25,winnerReward:cfg.games?.winnerReward||300};return{rounds:Math.max(1,Math.min(limitFor(site,cfg,'maxRounds'),Number(raw.rounds||5))),roundTimeSeconds:Math.max(5,Math.min(limitFor(site,cfg,'maxRoundTimeSeconds'),Number(raw.roundTimeSeconds||25))),winnerReward:Math.max(0,Math.min(limitFor(site,cfg,'maxWinnerReward'),Number(raw.winnerReward||0)))};}
function gameAvailable(cfg,site,type){return PUBLIC_GAME_IDS.includes(type)&&cfg.games?.enabled?.[type]!==false&&gameAllowed(site,cfg,type);}
function gameName(type){const d=gameDef(type);return d?`${d.emoji} ${d.label}`:type;}
const HASH_GAME_ALIASES=new Map(Object.entries({
  'اسئلة':'quiz','أسئلة':'quiz','اسئله':'quiz','سؤال':'quiz','quiz':'quiz',
  'تخمين':'guess','خمن':'guess','guess':'guess',
  'حجروورقمقص':'rps','حجرورقمقص':'rps','rps':'rps',
  'سرعة':'speed','سرعه':'speed','speed':'speed',
  'ترتيب':'scramble','ترتيبالحروف':'scramble','scramble':'scramble',
  'صحخطأ':'truefalse','صحخطا':'truefalse','صحغلط':'truefalse','truefalse':'truefalse',
  'حساب':'math','رياضيات':'math','math':'math',
  'الاقرب':'closest','الأقرب':'closest','اقرب':'closest','closest':'closest',
  'كلمة':'word','الكلمة':'word','كلمه':'word','word':'word',
  'عجلة':'wheel','عجله':'wheel','عجلةالحظ':'wheel','عجلهالحظ':'wheel','wheel':'wheel',
  'يومي':'daily','اليومي':'daily','daily':'daily',
  'مافيا':'mafia','mafia':'mafia',
  'روليت':'roulette','roulette':'roulette',
  'كراسي':'chairs','الكراسي':'chairs','chairs':'chairs',
  'منالقاتل':'killer','القاتل':'killer','killer':'killer'
}));
function normalizeHashGameName(value){return String(value||'').trim().replace(/^#+/,'').toLowerCase().replace(/[ـ\s_\-]+/g,'').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه');}
function messageGameAdapter(m){return{guild:m.guild,channel:m.channel,user:m.author,member:m.member,memberPermissions:m.member?.permissions,replied:false,deferred:false,reply:payload=>m.reply({...payload,allowedMentions:{repliedUser:false}}),followUp:payload=>m.channel.send(payload)};}
async function handleHashGameCommand(m){
  if(!m?.guild||m.author?.bot)return false;const raw=String(m.content||'').trim();if(!raw.startsWith('#'))return false;
  const normalized=normalizeHashGameName(raw);
  if(['ايقاف','وقف','stop','stopgame'].includes(normalized)){
    const adapter=messageGameAdapter(m);
    await stopCurrentRoomGames(adapter);
    return true;
  }
  const type=HASH_GAME_ALIASES.get(normalized);if(!type)return false;
  const [cfg,site]=await Promise.all([store.getConfig(m.guild.id),siteConfig(true)]);applyPlanPresentation(cfg,site);
  if(!featureOn(cfg,site,'games')){const detectedPlan=planNameForConfig(cfg)==='premium_plus'?'Premium+':planNameForConfig(cfg)==='premium'?'Premium':'Free';await m.reply({content:`💎 نظام الألعاب غير متاح في خطة هذا السيرفر. اشترك لفتح المزيد. (الخطة المكتشفة: ${detectedPlan})`,allowedMentions:{repliedUser:false}}).catch(()=>{});return true;}
  if(!gameAllowed(site,cfg,type)){const url=baseUrl()?`${baseUrl()}/premium`:'';const components=url?[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💎 الاشتراك والترقية').setURL(url))]:[];await m.reply({content:`💎 **${gameName(type)}** غير متاحة في خطتك الحالية. تحتاج ترقية الاشتراك حسب إعدادات Owner.`,components,allowedMentions:{repliedUser:false}}).catch(()=>{});return true;}
  if(cfg.games?.enabled?.[type]===false){await m.reply({content:`❌ **${gameName(type)}** معطلة من Dashboard في هذا السيرفر.`,allowedMentions:{repliedUser:false}}).catch(()=>{});return true;}
  await startGameByType(messageGameAdapter(m),type,cfg,site,false);return true;
}
function gameKey(guildId,channelId){return `${guildId}:${channelId}`;}
const GAME_BUTTON_STYLES={
  quiz:ButtonStyle.Primary,guess:ButtonStyle.Primary,rps:ButtonStyle.Primary,speed:ButtonStyle.Primary,scramble:ButtonStyle.Primary,
  truefalse:ButtonStyle.Secondary,math:ButtonStyle.Secondary,closest:ButtonStyle.Secondary,word:ButtonStyle.Secondary,wheel:ButtonStyle.Success,
  daily:ButtonStyle.Success,mafia:ButtonStyle.Danger,roulette:ButtonStyle.Danger,chairs:ButtonStyle.Secondary,killer:ButtonStyle.Danger
};
const GAME_PANEL_ORDER=[
  ['quiz','guess','rps','speed','scramble'],
  ['truefalse','math','closest','word','wheel'],
  ['daily','mafia','roulette','chairs','killer']
];
function gamesPanelRows(){
  const rows=GAME_PANEL_ORDER.map(ids=>new ActionRowBuilder().addComponents(
    ids.map(id=>{
      const g=gameDef(id);
      return new ButtonBuilder()
        .setCustomId(`pub:game:${id}`)
        .setLabel(g?.label||id)
        .setEmoji(g?.emoji||'🎮')
        .setStyle(GAME_BUTTON_STYLES[id]||ButtonStyle.Secondary);
    })
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pub:game:stop').setLabel('إيقاف اللعبة').setEmoji('🛑').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}
function gamesPanelPayload(cfg){
  return {
    embeds:[
      new EmbedBuilder()
        .setColor(color(cfg))
        .setTitle('🎮 ألعاب ZOM')
        .setDescription(
          'اختر اللعبة التي تريد تشغيلها.\n\n' +
          '🎯 وقت الجولة وعدد الجولات والجائزة النهائية يتم تحديدها من **Dashboard** لكل لعبة.\n' +
          '⭐ فوز الجولة = **نقطة**، والجائزة تُصرف للفائز النهائي فقط.\n' +
          '🎭 المافيا والروليت والكراسي ومن القاتل تعمل في السيرفرات العامة حسب الخطة.\n\n' +
          '⌨️ ويمكن تشغيل أي لعبة مباشرة بكتابة **# + اسم اللعبة** مثل: `#اسئلة`، `#روليت`، `#كراسي`، `#من-القاتل`.\n' +
          '🛑 لإيقاف اللعبة: اضغط زر **إيقاف اللعبة** أو اكتب `#ايقاف` / استخدم **/ايقاف**. المضيف، الرتب المسموحة، والإدارة يستطيعون الإيقاف.'
        )
        .setFooter({text:'ZOM Games System'})
    ],
    components:gamesPanelRows()
  };
}
async function showGamesMenu(i,cfg,site){
  if(!featureOn(cfg,site,'games'))return safeReply(i,{content:deniedText(cfg,'Games'),ephemeral:true});
  return safeReply(i,gamesPanelPayload(cfg));
}
async function sendGamesPanel(guild,channel,cfg,siteArg=null){
  const site=siteArg||await siteConfig();
  if(!featureOn(cfg,site,'games'))throw new Error('Games غير متاحة لهذه الخطة.');
  const target=channel||guild.channels.cache.get(cfg.channels.gamePanel);
  if(!target?.isTextBased())throw new Error('حدد روم لوحة الألعاب أو استخدم الأمر داخل روم نصي.');
  const payload=gamesPanelPayload(cfg);
  let msg=null;
  if(cfg.games?.panelMessageId&&cfg.channels.gamePanel===target.id){
    try{msg=await target.messages.fetch(cfg.games.panelMessageId);await msg.edit(payload);}catch{}
  }
  if(!msg)msg=await target.send(payload);
  await savePanelPointer(guild.id,'gamePanel',target.id,'games',msg.id);
  return msg;
}
async function generateRound(gid,type){const content=await store.getGameContent(gid);if(type==='quiz'){const x=randomItem(content.quizQuestions);return{question:x.question,answer:x.answer};}if(type==='truefalse'){const x=randomItem(content.trueFalseQuestions);return{question:`${x.question}\n\nاكتب: **صح** أو **خطأ**`,answer:x.answer};}if(type==='speed'){const a=randomItem(content.speedWords);return{question:`اكتب الكلمة التالية بسرعة: **${a}**`,answer:a};}if(type==='scramble'||type==='word'){const x=randomItem(content.wordQuestions);return{question:type==='scramble'?`رتب الحروف: **${x.scrambled}**`:`ما هي الكلمة الصحيحة للحروف: **${x.scrambled}**؟`,answer:x.answer};}if(type==='daily'){const x=randomItem(content.dailyQuestions);return{question:x.question,answer:x.answer};}if(type==='math'){const op=randomItem(['+','-','×']);let a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1,result;if(op==='-'){if(b>a)[a,b]=[b,a];result=a-b;}else if(op==='×'){a=Math.floor(Math.random()*10)+1;b=Math.floor(Math.random()*10)+1;result=a*b;}else result=a+b;return{question:`كم يساوي **${a} ${op} ${b}**؟`,answer:String(result)};}if(type==='guess'){const n=Math.floor(Math.random()*20)+1;return{question:'خمن رقمًا من **1 إلى 20**',answer:String(n),number:n};}if(type==='closest'){const n=Math.floor(Math.random()*100)+1;return{question:'أرسل رقمًا من **1 إلى 100**؛ عند انتهاء الوقت يفوز الأقرب.',number:n,answer:String(n),closest:true};}return null;}
function roundEmbed(cfg,type,round,maxRounds,rule,rd){return new EmbedBuilder().setColor(color(cfg)).setTitle(`🎮 ${gameName(type)}`).setDescription(`🎯 الجولة **${round}/${maxRounds}**\n\n${rd.question}\n\n⏱️ الوقت: **${rule.roundTimeSeconds} ثانية**\n🏆 فوز الجولة = **نقطة**\n💰 جائزة الفائز النهائي: **${rule.winnerReward.toLocaleString()} ${currency(cfg)}**`);}
async function sendRound(game){const rd=await generateRound(game.guild.id,game.type);if(!rd){await game.channel.send('❌ تعذر إنشاء الجولة.').catch(()=>{});return finishQuickGame(game);}game.roundData=rd;game.guesses=new Map();game.resolved=false;await game.channel.send({embeds:[roundEmbed(game.cfg,game.type,game.round,game.maxRounds,game.rule,rd)]});const collector=game.channel.createMessageCollector({filter:m=>!m.author.bot,time:game.rule.roundTimeSeconds*1000});game.collector=collector;
  collector.on('collect',m=>{if(game.resolved)return;if(rd.closest){const n=Number(String(m.content).trim());if(Number.isFinite(n)&&n>=1&&n<=100)game.guesses.set(m.author.id,{n,user:m.author});return;}if(normalizeAnswer(m.content)===normalizeAnswer(rd.answer)){game.resolved=true;game.roundWinner=m.author;collector.stop('winner');}});
  collector.on('end',async(_c,reason)=>{if(activeGames.get(game.key)!==game)return;let winner=game.roundWinner||null;if(rd.closest&&game.guesses.size){let best=null;for(const v of game.guesses.values()){const diff=Math.abs(v.n-rd.number);if(!best||diff<best.diff)best={...v,diff};}winner=best?.user||null;}if(winner){game.scores[winner.id]=(game.scores[winner.id]||0)+1;if(!game.scoreOrder[winner.id])game.scoreOrder[winner.id]=++game.sequence;await game.channel.send(`✅ الجولة لـ ${winner}! النقاط: **${game.scores[winner.id]}**`).catch(()=>{});}else await game.channel.send(`⌛ انتهى الوقت. الإجابة: **${rd.answer}**`).catch(()=>{});if(game.round>=game.maxRounds)return finishQuickGame(game);game.round++;game.roundWinner=null;await sleep(1200);sendRound(game).catch(e=>{console.error('Public game next round:',e);activeGames.delete(game.key);});});
}
async function finishQuickGame(game){activeGames.delete(game.key);const entries=Object.entries(game.scores).sort((a,b)=>Number(b[1])-Number(a[1])||Number(game.scoreOrder[a[0]]||999999)-Number(game.scoreOrder[b[0]]||999999));if(!entries.length){await game.channel.send('🏁 انتهت اللعبة بدون فائز.').catch(()=>{});return;}const [winnerId,points]=entries[0];if(game.rule.winnerReward>0)await store.updateUser(game.guild.id,winnerId,u=>u.balance+=game.rule.winnerReward);const board=entries.slice(0,10).map(([id,p],n)=>`**${n+1}.** <@${id}> — ${p} نقطة`).join('\n');await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle('🏆 انتهت اللعبة').setDescription(`الفائز: <@${winnerId}> بـ **${points}** نقطة\nالجائزة: **${game.rule.winnerReward.toLocaleString()} ${currency(game.cfg)}**\n\n${board}`)]}).catch(()=>{});}
async function startQuickGame(i,type,cfg,site,fromMenu=false){if(!gameAvailable(cfg,site,type)){const msg='❌ هذه اللعبة غير متاحة لهذه الخطة أو معطلة من Dashboard.';return fromMenu?componentNotice(i,{content:msg}):safeReply(i,{content:msg,ephemeral:true});}const key=gameKey(i.guild.id,i.channel.id);if(activeGames.has(key)){const msg='❌ توجد لعبة تعمل في هذا الروم.';return fromMenu?componentNotice(i,{content:msg}):safeReply(i,{content:msg,ephemeral:true});}const rule=gameRule(cfg,site,type),game={key,guild:i.guild,channel:i.channel,type,cfg,site,rule,hostId:i.user.id,round:1,maxRounds:rule.rounds,scores:{},scoreOrder:{},sequence:0,collector:null};activeGames.set(key,game);void serverLogs.game(i,type,'بدء لعبة');if(fromMenu){if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});await i.channel.send(`🎮 بدأت **${gameName(type)}** بواسطة ${i.user}.`).catch(()=>{});}else await safeReply(i,{content:`🎮 بدأت **${gameName(type)}** — ${rule.rounds} جولات.`});await sleep(400);return sendRound(game);}

async function startRps(i,cfg,site,fromMenu=false){const type='rps';if(!gameAvailable(cfg,site,type))return fromMenu?componentNotice(i,{content:'❌ RPS غير متاحة.'}):safeReply(i,{content:'❌ RPS غير متاحة.',ephemeral:true});const key=gameKey(i.guild.id,i.channel.id);if(activeGames.has(key))return fromMenu?componentNotice(i,{content:'❌ توجد لعبة تعمل.'}):safeReply(i,{content:'❌ توجد لعبة تعمل.',ephemeral:true});const rule=gameRule(cfg,site,type),game={key,type,ownerId:i.user.id,guild:i.guild,channel:i.channel,cfg,site,rule,round:1,userScore:0,botScore:0};activeGames.set(key,game);void serverLogs.game(i,type,'بدء لعبة');const row=new ActionRowBuilder().addComponents(['rock','paper','scissors'].map((x,n)=>new ButtonBuilder().setCustomId(`pub:rps:${x}`).setLabel(['حجر','ورق','مقص'][n]).setEmoji(['🪨','📄','✂️'][n]).setStyle(ButtonStyle.Primary)));const payload={embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('✂️ حجر ورق مقص').setDescription(`اللاعب: ${i.user}\nالجولات: **${rule.rounds}**\nاختر حركتك.`)],components:[row]};if(fromMenu){if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});await i.channel.send(payload);}else await safeReply(i,payload);}
async function handleRpsButton(i,cfg,site){const key=gameKey(i.guild.id,i.channel.id),game=activeGames.get(key);if(!game||game.type!=='rps')return componentNotice(i,{content:'❌ لا توجد لعبة RPS نشطة.'});if(i.user.id!==game.ownerId)return componentNotice(i,{content:'❌ هذه الجولة لصاحب اللعبة فقط.'});const choice=i.customId.split(':')[2],opts=['rock','paper','scissors'],bot=randomItem(opts);let result='تعادل';if((choice==='rock'&&bot==='scissors')||(choice==='paper'&&bot==='rock')||(choice==='scissors'&&bot==='paper')){game.userScore++;result='✅ فزت بالجولة';}else if(choice!==bot){game.botScore++;result='❌ البوت فاز بالجولة';}game.round++;const names={rock:'🪨 حجر',paper:'📄 ورق',scissors:'✂️ مقص'};if(game.round>game.rule.rounds){activeGames.delete(key);const won=game.userScore>game.botScore;if(won&&game.rule.winnerReward>0)await store.updateUser(i.guild.id,i.user.id,u=>u.balance+=game.rule.winnerReward);return i.update({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏁 انتهت RPS').setDescription(`أنت: **${game.userScore}** • البوت: **${game.botScore}**\n${won?`🏆 ربحت **${game.rule.winnerReward.toLocaleString()} ${currency(cfg)}**`:(game.userScore===game.botScore?'🤝 تعادل':'🤖 البوت فاز')}`)],components:[]});}return i.update({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('✂️ حجر ورق مقص').setDescription(`أنت: ${names[choice]}\nالبوت: ${names[bot]}\n${result}\n\nالنتيجة: **${game.userScore} - ${game.botScore}**\nالجولة التالية: **${game.round}/${game.rule.rounds}**`)],components:i.message.components});}
async function startWheel(i,cfg,site,fromMenu=false){if(!gameAvailable(cfg,site,'wheel'))return fromMenu?componentNotice(i,{content:'❌ عجلة الحظ غير متاحة.'}):safeReply(i,{content:'❌ عجلة الحظ غير متاحة.',ephemeral:true});void serverLogs.game(i,'wheel');const rule=gameRule(cfg,site,'wheel'),rewards=[0,Math.floor(rule.winnerReward*.25),Math.floor(rule.winnerReward*.5),rule.winnerReward,Math.floor(rule.winnerReward*1.5)].map(x=>Math.max(0,Math.min(limitFor(site,cfg,'maxWinnerReward'),x))),reward=randomItem(rewards);if(reward>0)await store.updateUser(i.guild.id,i.user.id,u=>u.balance+=reward);const payload={embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🎡 عجلة الحظ').setDescription(reward?`🎉 ${i.user} ربحت **${reward.toLocaleString()} ${currency(cfg)}**!`:`😅 ${i.user} لم تربح هذه المرة.`)]};if(fromMenu){if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});return i.channel.send(payload);}return safeReply(i,payload);}
async function startGameByType(i,type,cfg,site,fromMenu=false){if(!canStartGames(i,cfg))return safeReply(i,{content:'❌ تشغيل الألعاب يحتاج الرتبة المحددة في Dashboard أو Administrator.',ephemeral:true});if(type==='rps')return startRps(i,cfg,site,fromMenu);if(type==='wheel')return startWheel(i,cfg,site,fromMenu);if(type==='roulette')return startRoulette(i,cfg,site,fromMenu);if(type==='chairs')return startChairs(i,cfg,site,fromMenu);if(type==='mafia')return startMafia(i,cfg,site,fromMenu);if(type==='killer')return startKiller(i,cfg,site,fromMenu);return startQuickGame(i,type,cfg,site,fromMenu);}

function activeGameTypeForKey(key){
  const quick=activeGames.get(key);
  if(quick)return quick.type||'game';
  if(rouletteGames.has(key))return'roulette';
  if(chairsGames.has(key))return'chairs';
  if(mafiaGames.has(key))return'mafia';
  if(killerGames.has(key))return'killer';
  return null;
}
function activeGameForKey(key){
  return activeGames.get(key)||rouletteGames.get(key)||chairsGames.get(key)||mafiaGames.get(key)||killerGames.get(key)||null;
}
function gameControllerAllowed(subject,cfg,key){
  if(isAdmin(subject)||canStartGames(subject,cfg))return true;
  const game=activeGameForKey(key);
  if(!game)return false;
  const uid=subject?.user?.id||subject?.author?.id||subject?.id||subject?.member?.id;
  return Boolean(uid&&(game.hostId===uid||game.ownerId===uid));
}
async function stopGameKey(key){
  const stopped=[];
  const quick=activeGames.get(key);
  if(quick){
    activeGames.delete(key);
    quick.cancelled=true;
    try{quick.collector?.stop?.('manual-stop');}catch{}
    stopped.push(quick.type||'game');
  }
  const roulette=rouletteGames.get(key);
  if(roulette){
    rouletteGames.delete(key);roulette.cancelled=true;roulette.phase='stopped';
    try{await roulette.message?.edit?.({components:[]});}catch{}
    stopped.push('roulette');
  }
  const chairs=chairsGames.get(key);
  if(chairs){
    chairsGames.delete(key);chairs.cancelled=true;chairs.phase='stopped';
    if(chairs.timer){clearTimeout(chairs.timer);chairs.timer=null;}
    try{await chairs.message?.edit?.({components:[]});}catch{}
    try{await chairs.roundMessage?.edit?.({components:[]});}catch{}
    stopped.push('chairs');
  }
  const mafia=mafiaGames.get(key);
  if(mafia){
    mafiaGames.delete(key);mafia.cancelled=true;mafia.phase='stopped';
    if(mafia.timer){clearTimeout(mafia.timer);mafia.timer=null;}
    try{await mafia.message?.edit?.({components:[]});}catch{}
    try{await mafia.voteMessage?.edit?.({components:[]});}catch{}
    stopped.push('mafia');
  }
  const killer=killerGames.get(key);
  if(killer){
    killerGames.delete(key);killer.cancelled=true;killer.phase='stopped';
    if(killer.timer){clearTimeout(killer.timer);killer.timer=null;}
    try{await killer.message?.edit?.({components:[]});}catch{}
    stopped.push('killer');
  }
  return [...new Set(stopped)];
}
async function stopCurrentRoomGames(i){
  const cfg=await store.getConfig(i.guild.id),key=gameKey(i.guild.id,i.channel.id);
  if(!activeGameTypeForKey(key))return safeReply(i,{content:'ℹ️ لا توجد لعبة ZOMBI تعمل في هذا الروم.',ephemeral:true});
  if(!gameControllerAllowed(i,cfg,key)){
    const roles=(cfg.games?.startRoleIds||[]).map(id=>`<@&${id}>`).join('، ');
    return safeReply(i,{content:roles?`❌ إيقاف اللعبة متاح للمضيف، الإدارة، أو الرتب: ${roles}`:'❌ إيقاف اللعبة متاح لمضيف اللعبة أو إدارة السيرفر فقط.',ephemeral:true});
  }
  const stopped=await stopGameKey(key),names=stopped.map(gameName).join('، ');
  const actor=i.user||i.author;
  await logAction(i.guild,cfg,`🛑 ${actor?.tag||actor?.id||'unknown'} أوقف: ${names} في #${i.channel.name}.`);
  return safeReply(i,{content:`🛑 تم إيقاف اللعبة: **${names}**.`,ephemeral:true});
}
async function stopAllGuildGames(i){
  if(!isAdmin(i))return safeReply(i,{content:'❌ تحتاج صلاحية Manage Server.',ephemeral:true});
  const prefix=`${i.guild.id}:`,keys=new Set();
  for(const map of [activeGames,rouletteGames,chairsGames,mafiaGames,killerGames])for(const key of map.keys())if(key.startsWith(prefix))keys.add(key);
  let total=0;const names=[];
  for(const key of keys){const stopped=await stopGameKey(key);total+=stopped.length;names.push(...stopped);}
  if(!total)return safeReply(i,{content:'ℹ️ لا توجد ألعاب ZOMBI نشطة في السيرفر.',ephemeral:true});
  return safeReply(i,{content:`🛑 تم إيقاف **${total}** لعبة نشطة في السيرفر.\n${[...new Set(names)].map(gameName).join('، ')}`,ephemeral:true});
}

function effectiveTicketTypes(cfg,site){const max=limitFor(site,cfg,'ticketTypes');return (cfg.tickets?.types||[]).filter(x=>x?.enabled!==false).slice(0,max);}
async function sendTicketPanel(guild,channel,cfg,siteArg=null){const site=siteArg||await siteConfig();if(!featureOn(cfg,site,'tickets'))throw new Error('نظام التذاكر غير متاح لهذه الخطة.');const target=channel||guild.channels.cache.get(cfg.channels.ticketPanel);if(!target?.isTextBased())throw new Error('حدد روم لوحة التذاكر من الداشبورد أو استخدم الأمر داخل روم نصي.');const types=effectiveTicketTypes(cfg,site);if(!types.length)throw new Error('أضف نوع تذكرة من Dashboard.');const rows=[];for(let n=0;n<types.length;n+=5)rows.push(new ActionRowBuilder().addComponents(types.slice(n,n+5).map(t=>new ButtonBuilder().setCustomId(`pub:ticket:open:${t.id}`).setStyle(ButtonStyle.Primary).setLabel(t.label).setEmoji(t.emoji||'🎫'))));const footer=featureAllowed(site,cfg,'customBranding')?(cfg.branding.customFooter||cfg.branding.footer):'Powered by ZOMBI';const msg=await target.send({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(cfg.tickets.title).setDescription(cfg.tickets.description).setFooter({text:footer})],components:rows.slice(0,5)});await savePanelPointer(guild.id,'ticketPanel',target.id,'tickets',msg.id);return msg;}
async function openTicket(i,cfg,site){
  if(!featureOn(cfg,site,'tickets'))return componentNotice(i,{content:deniedText(cfg,'Tickets')});
  const typeId=i.customId.split(':')[3]||'general',type=(cfg.tickets.types||[]).find(x=>x.id===typeId)||(cfg.tickets.types||[])[0];
  if(!type||type.enabled===false)return componentNotice(i,{content:'❌ نوع التذكرة غير موجود أو معطّل.'});
  const member=i.guild.members.cache.get(i.user.id)||await i.guild.members.fetch(i.user.id).catch(()=>i.member);
  const openRoles=(type.openRoleIds||[]).filter(Boolean);
  if(openRoles.length&&!openRoles.some(r=>member?.roles?.cache?.has?.(r)))return componentNotice(i,{content:'❌ لا تملك رتبة تسمح بفتح هذا النوع من التذاكر.'});
  const tickets=await store.data(i.guild.id,'tickets.json',{}),maxOpen=Math.max(1,Number(type.maxOpenPerUser||1));
  const active=Object.values(tickets).filter(t=>t.userId===i.user.id&&t.typeId===type.id&&t.status==='open'&&i.guild.channels.cache.has(t.channelId));
  if(active.length>=maxOpen)return componentNotice(i,{content:`❌ لديك الحد الأقصى من هذا النوع (${maxOpen}): <#${active[0].channelId}>`});
  const overwrites=[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}];
  const roleLimit=limitFor(site,cfg,'ticketSupportRoles'),roleIds=[...new Set([...(cfg.tickets.supportRoleIds||[]),...(type.supportRoleIds||[]),...(type.viewRoleIds||[])])].slice(0,roleLimit);
  for(const rid of roleIds)overwrites.push({id:rid,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
  const base=(type.label||type.name||'ticket').toLowerCase().replace(/[^a-z0-9-_]/g,'').slice(0,25)||'ticket';
  const ch=await i.guild.channels.create({name:`${base}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g,'').slice(0,80)||`ticket-${i.user.id.slice(-6)}`,type:ChannelType.GuildText,parent:type.categoryId||cfg.channels.ticketCategory||null,permissionOverwrites:overwrites,reason:`ZOMBI ticket for ${i.user.tag}`});
  tickets[ch.id]={channelId:ch.id,userId:i.user.id,typeId:type.id,openedAt:Date.now(),status:'open'};await store.saveData(i.guild.id,'tickets.json',tickets);
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pub:ticket:close').setStyle(ButtonStyle.Danger).setLabel('إغلاق التذكرة').setEmoji('🔒'));
  await ch.send({content:`مرحبًا ${i.user} 👋
**النوع:** ${type.emoji||'🎫'} ${type.label||type.name}
${type.welcomeMessage||type.description||'اشرح طلبك وسيتم الرد عليك من الإدارة.'}`,components:[row]});
  return componentNotice(i,{content:`✅ تم فتح تذكرتك: ${ch}`});
}
async function closeTicket(i){const tickets=await store.data(i.guild.id,'tickets.json',{}),t=tickets[i.channel.id];if(!t)return componentNotice(i,{content:'❌ هذا الروم ليس تذكرة مسجلة.'});if(t.userId!==i.user.id&&!isAdmin(i))return componentNotice(i,{content:'❌ لا يمكنك إغلاق هذه التذكرة.'});t.status='closed';t.closedAt=Date.now();await store.saveData(i.guild.id,'tickets.json',tickets);await i.reply('🔒 سيتم حذف التذكرة بعد 5 ثوانٍ.').catch(()=>{});setTimeout(()=>i.channel.delete('ZOMBI ticket closed').catch(()=>{}),5000);}
async function sendStorePanel(guild,channel,cfg,siteArg=null){const site=siteArg||await siteConfig();if(!featureOn(cfg,site,'store'))throw new Error('المتجر غير متاح لهذه الخطة.');const products=(cfg.store.products||[]).slice(0,limitFor(site,cfg,'storeProducts'));if(!products.length)throw new Error('أضف منتجات من الداشبورد أولًا.');const target=channel||guild.channels.cache.get(cfg.channels.storePanel);if(!target?.isTextBased())throw new Error('حدد روم المتجر أو استخدم الأمر داخل روم نصي.');const select=new StringSelectMenuBuilder().setCustomId('pub:store:buy').setPlaceholder('اختر رتبة للشراء').addOptions(products.slice(0,25).map(p=>({label:(p.name||guild.roles.cache.get(p.roleId)?.name||'Role').slice(0,100),description:`${p.price.toLocaleString()} ${cfg.currency.name}`,value:p.roleId,emoji:p.emoji||undefined})));const msg=await target.send({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(cfg.store.title).setDescription(cfg.store.description)],components:[new ActionRowBuilder().addComponents(select)]});await savePanelPointer(guild.id,'storePanel',target.id,'store',msg.id);return msg;}
async function showStore(i,cfg,site){if(!featureOn(cfg,site,'store'))return safeReply(i,{content:deniedText(cfg,'Store'),ephemeral:true});const products=(cfg.store.products||[]).slice(0,limitFor(site,cfg,'storeProducts'));if(!products.length)return safeReply(i,{content:'🛒 المتجر فارغ حاليًا.',ephemeral:true});const select=new StringSelectMenuBuilder().setCustomId('pub:store:buy').setPlaceholder('اختر رتبة').addOptions(products.slice(0,25).map(p=>({label:(p.name||i.guild.roles.cache.get(p.roleId)?.name||'Role').slice(0,100),description:`${p.price.toLocaleString()} ${cfg.currency.name}`,value:p.roleId,emoji:p.emoji||undefined})));return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(cfg.store.title).setDescription(cfg.store.description)],components:[new ActionRowBuilder().addComponents(select)],ephemeral:true});}
async function buyStore(i,cfg,site){if(!featureOn(cfg,site,'store'))return componentNotice(i,{content:deniedText(cfg,'Store')});const roleId=i.values[0],p=(cfg.store.products||[]).slice(0,limitFor(site,cfg,'storeProducts')).find(x=>x.roleId===roleId);if(!p)return componentNotice(i,{content:'❌ المنتج غير موجود أو تجاوز حد الخطة.'});const role=i.guild.roles.cache.get(roleId);if(!role)return componentNotice(i,{content:'❌ الرتبة لم تعد موجودة.'});if(i.member.roles.cache.has(roleId))return componentNotice(i,{content:'❌ لديك هذه الرتبة بالفعل.'});const u=await store.getUser(i.guild.id,i.user.id);if(u.balance<p.price)return componentNotice(i,{content:'❌ رصيدك غير كافٍ.'});try{await i.member.roles.add(role,'ZOMBI store purchase');}catch{return componentNotice(i,{content:'❌ لم أستطع إعطاء الرتبة. تأكد أن رتبة البوت أعلى منها.'});}await store.updateUser(i.guild.id,i.user.id,x=>{x.balance-=p.price;x.purchases.push({roleId,price:p.price,at:Date.now()});});return componentNotice(i,{content:`✅ اشتريت ${role} مقابل **${p.price.toLocaleString()}** ${currency(cfg)}.`});}
async function sendRolePanel(guild,channel,cfg,siteArg=null){const site=siteArg||await siteConfig();if(!featureOn(cfg,site,'rolePanel'))throw new Error('Self Roles غير متاحة لهذه الخطة.');const items=(cfg.rolePanel.items||[]).slice(0,limitFor(site,cfg,'selfRoles'));if(!items.length)throw new Error('أضف Self Roles من الداشبورد أولًا.');const target=channel||guild.channels.cache.get(cfg.channels.rolePanel);if(!target?.isTextBased())throw new Error('حدد روم لوحة الرتب أو استخدم الأمر داخل روم نصي.');const rows=[];for(let n=0;n<items.length;n+=5)rows.push(new ActionRowBuilder().addComponents(items.slice(n,n+5).map(x=>new ButtonBuilder().setCustomId(`pub:role:${x.roleId}`).setLabel(x.label||guild.roles.cache.get(x.roleId)?.name||'Role').setEmoji(x.emoji||'🔔').setStyle(({Primary:ButtonStyle.Primary,Secondary:ButtonStyle.Secondary,Success:ButtonStyle.Success,Danger:ButtonStyle.Danger}[x.style]||ButtonStyle.Secondary)))));const msg=await target.send({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle(cfg.rolePanel.title).setDescription(cfg.rolePanel.description).setFooter({text:cfg.rolePanel.footer||'ZOMBI • ROLE CENTER'})],components:rows.slice(0,5)});await savePanelPointer(guild.id,'rolePanel',target.id,'rolePanel',msg.id);return msg;}
async function toggleRole(i,cfg,site){if(!featureOn(cfg,site,'rolePanel'))return componentNotice(i,{content:deniedText(cfg,'Self Roles')});const roleId=i.customId.split(':')[2],allowed=(cfg.rolePanel.items||[]).slice(0,limitFor(site,cfg,'selfRoles')).some(x=>x.roleId===roleId);if(!allowed)return componentNotice(i,{content:'❌ هذه الرتبة غير متاحة ضمن حد الخطة.'});const role=i.guild.roles.cache.get(roleId);if(!role)return componentNotice(i,{content:'❌ الرتبة غير موجودة.'});try{if(i.member.roles.cache.has(roleId)){await i.member.roles.remove(role);return componentNotice(i,{content:`➖ تمت إزالة ${role}.`});}await i.member.roles.add(role);return componentNotice(i,{content:`✅ تمت إضافة ${role}.`});}catch{return componentNotice(i,{content:'❌ لم أستطع تعديل الرتبة. تأكد من ترتيب رتبة البوت.'});}}



// ==========================================================
// PUBLIC MULTI-SERVER PARTY GAMES
// Roulette / Chairs / Mafia / Killer
// ==========================================================
function specialMaps(){return [rouletteGames,chairsGames,mafiaGames,killerGames];}
function channelBusy(key){return activeGames.has(key)||specialMaps().some(m=>m.has(key));}
function lobbyLimits(cfg,site,type){
  const raw=cfg.games?.lobby?.[type]||{};
  const planMax=Math.max(2,limitFor(site,cfg,'maxGamePlayers'));
  const defaultMin=type==='mafia'?4:2;
  const min=Math.max(defaultMin,Math.min(planMax,Number(raw.minPlayers||defaultMin)));
  const max=Math.max(min,Math.min(planMax,Number(raw.maxPlayers||planMax)));
  return {min,max};
}
function playerNames(game,ids){return ids.map(id=>`<@${id}>`).join('، ')||'—';}
function lobbyButtons(prefix){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`pub:${prefix}:join`).setLabel('انضم').setEmoji('➕').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`pub:${prefix}:leave`).setLabel('مغادرة').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`pub:${prefix}:start`).setLabel('بدء').setEmoji('▶️').setStyle(ButtonStyle.Primary)
);}
async function sendLobby(i,game,title,description,fromMenu){
  const payload={embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle(title).setDescription(`${description}\n\n👑 المضيف: <@${game.hostId}>\n👥 اللاعبون (${game.players.length}/${game.maxPlayers}): ${playerNames(game,game.players)}\n\nالحد الأدنى: **${game.minPlayers}**`)],components:[lobbyButtons(game.type)]};
  let msg;
  if(fromMenu){if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});msg=await i.channel.send(payload);}else msg=await safeReply(i,payload);
  game.message=msg; return msg;
}
async function updateLobby(i,game,title,description){
  const payload={embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle(title).setDescription(`${description}\n\n👑 المضيف: <@${game.hostId}>\n👥 اللاعبون (${game.players.length}/${game.maxPlayers}): ${playerNames(game,game.players)}\n\nالحد الأدنى: **${game.minPlayers}**`)],components:[lobbyButtons(game.type)]};
  return i.update(payload);
}
function canStartLobby(i,game){return i.user.id===game.hostId||isAdmin(i);}

async function startRoulette(i,cfg,site,fromMenu=false){
  const type='roulette'; if(!gameAvailable(cfg,site,type))return fromMenu?componentNotice(i,{content:'❌ الروليت غير متاحة لهذه الخطة أو معطلة.'}):safeReply(i,{content:'❌ الروليت غير متاحة لهذه الخطة أو معطلة.',ephemeral:true});
  const key=gameKey(i.guild.id,i.channel.id); if(channelBusy(key))return fromMenu?componentNotice(i,{content:'❌ توجد لعبة تعمل في هذا الروم.'}):safeReply(i,{content:'❌ توجد لعبة تعمل في هذا الروم.',ephemeral:true});
  const lim=lobbyLimits(cfg,site,type),game={key,type,guild:i.guild,channel:i.channel,cfg,site,rule:gameRule(cfg,site,type),hostId:i.user.id,players:[i.user.id],minPlayers:lim.min,maxPlayers:lim.max,phase:'lobby'};rouletteGames.set(key,game);void serverLogs.game(i,type,'فتح لوبي لعبة');
  return sendLobby(i,game,'🎰 ZOMBI Roulette','انضموا ثم يضغط المضيف **بدء**. في كل لفة يخرج لاعب عشوائي حتى يبقى فائز واحد.',fromMenu);
}
async function rouletteComponent(i,cfg,site){
  const key=gameKey(i.guild.id,i.channel.id),game=rouletteGames.get(key);if(!game)return componentNotice(i,{content:'❌ لا توجد روليت نشطة.'});const action=i.customId.split(':')[2];
  if(action==='join'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة بالفعل.'});if(game.players.includes(i.user.id))return componentNotice(i,{content:'⚠️ أنت منضم بالفعل.'});if(game.players.length>=game.maxPlayers)return componentNotice(i,{content:'❌ وصلت اللعبة للحد الأقصى.'});game.players.push(i.user.id);return updateLobby(i,game,'🎰 ZOMBI Roulette','انضموا ثم يضغط المضيف **بدء**. في كل لفة يخرج لاعب عشوائي حتى يبقى فائز واحد.');}
  if(action==='leave'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة بالفعل.'});if(!game.players.includes(i.user.id))return componentNotice(i,{content:'⚠️ أنت غير منضم.'});game.players=game.players.filter(x=>x!==i.user.id);if(!game.players.length){rouletteGames.delete(key);return i.update({content:'🛑 تم إلغاء الروليت لعدم وجود لاعبين.',embeds:[],components:[]});}if(game.hostId===i.user.id)game.hostId=game.players[0];return updateLobby(i,game,'🎰 ZOMBI Roulette','انضموا ثم يضغط المضيف **بدء**. في كل لفة يخرج لاعب عشوائي حتى يبقى فائز واحد.');}
  if(action==='start'){if(!canStartLobby(i,game))return componentNotice(i,{content:'❌ المضيف أو إدارة السيرفر فقط يستطيع البدء.'});if(game.players.length<game.minPlayers)return componentNotice(i,{content:`❌ تحتاج **${game.minPlayers}** لاعبين على الأقل.`});game.phase='running';void serverLogs.game(i,game.type,'بدء اللعب بعد اللوبي');await i.update({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🎰 بدأت الروليت').setDescription(`👥 ${playerNames(game,game.players)}\n\n🔥 بدأت اللفات...`)],components:[]});runRoulette(game).catch(e=>{console.error('Public roulette:',e);rouletteGames.delete(key);});}
}
async function runRoulette(game){
  let alive=[...game.players],round=1,delay=Math.max(2,Math.min(10,Number(game.rule.roundTimeSeconds||5)))*1000;
  while(alive.length>1&&rouletteGames.get(game.key)===game){await game.channel.send(`🎰 **اللفة ${round}**... الأسطوانة تدور بين ${alive.length} لاعبين.`).catch(()=>{});await sleep(delay);if(rouletteGames.get(game.key)!==game)return;const out=randomItem(alive);alive=alive.filter(x=>x!==out);await game.channel.send(`💥 خرج <@${out}>!\n✅ المتبقون: ${playerNames(game,alive)}`).catch(()=>{});round++;}
  if(rouletteGames.get(game.key)!==game)return;
  if(!alive.length){rouletteGames.delete(game.key);return;}const winner=alive[0];if(game.rule.winnerReward>0)await store.updateUser(game.guild.id,winner,u=>u.balance+=game.rule.winnerReward);await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle('🏆 فائز الروليت').setDescription(`<@${winner}> هو آخر لاعب!\n💰 الجائزة: **${game.rule.winnerReward.toLocaleString()} ${currency(game.cfg)}**`)]}).catch(()=>{});rouletteGames.delete(game.key);
}

async function startChairs(i,cfg,site,fromMenu=false){
  const type='chairs'; if(!gameAvailable(cfg,site,type))return fromMenu?componentNotice(i,{content:'❌ الكراسي غير متاحة.'}):safeReply(i,{content:'❌ الكراسي غير متاحة لهذه الخطة أو معطلة.',ephemeral:true});
  const key=gameKey(i.guild.id,i.channel.id);if(channelBusy(key))return fromMenu?componentNotice(i,{content:'❌ توجد لعبة تعمل في هذا الروم.'}):safeReply(i,{content:'❌ توجد لعبة تعمل في هذا الروم.',ephemeral:true});
  const lim=lobbyLimits(cfg,site,type),game={key,type,guild:i.guild,channel:i.channel,cfg,site,rule:gameRule(cfg,site,type),hostId:i.user.id,players:[i.user.id],alive:[i.user.id],minPlayers:lim.min,maxPlayers:lim.max,phase:'lobby',round:1,seated:new Set(),timer:null};chairsGames.set(key,game);void serverLogs.game(i,type,'فتح لوبي لعبة');
  return sendLobby(i,game,'🪑 لعبة الكراسي','بعد البدء يظهر زر **اجلس**. عدد الكراسي أقل من اللاعبين بكرسي واحد؛ الأسرع ينجو.',fromMenu);
}
async function chairsComponent(i,cfg,site){
  const key=gameKey(i.guild.id,i.channel.id),game=chairsGames.get(key);if(!game)return componentNotice(i,{content:'❌ لا توجد لعبة كراسي نشطة.'});const action=i.customId.split(':')[2];
  if(action==='join'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة.'});if(game.players.includes(i.user.id))return componentNotice(i,{content:'⚠️ أنت منضم بالفعل.'});if(game.players.length>=game.maxPlayers)return componentNotice(i,{content:'❌ اللعبة ممتلئة.'});game.players.push(i.user.id);game.alive=[...game.players];return updateLobby(i,game,'🪑 لعبة الكراسي','بعد البدء يظهر زر **اجلس**. عدد الكراسي أقل من اللاعبين بكرسي واحد؛ الأسرع ينجو.');}
  if(action==='leave'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة.'});game.players=game.players.filter(x=>x!==i.user.id);game.alive=[...game.players];if(!game.players.length){chairsGames.delete(key);return i.update({content:'🛑 تم إلغاء لعبة الكراسي.',embeds:[],components:[]});}if(game.hostId===i.user.id)game.hostId=game.players[0];return updateLobby(i,game,'🪑 لعبة الكراسي','بعد البدء يظهر زر **اجلس**. عدد الكراسي أقل من اللاعبين بكرسي واحد؛ الأسرع ينجو.');}
  if(action==='start'){if(!canStartLobby(i,game))return componentNotice(i,{content:'❌ المضيف أو الإدارة فقط.'});if(game.players.length<game.minPlayers)return componentNotice(i,{content:`❌ تحتاج ${game.minPlayers} لاعبين على الأقل.`});game.phase='round';void serverLogs.game(i,game.type,'بدء اللعب بعد اللوبي');await i.update({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🪑 بدأت لعبة الكراسي').setDescription(`👥 ${playerNames(game,game.players)}`)],components:[]});return chairRound(game);}
  if(action==='seat'){if(game.phase!=='seat'||!game.alive.includes(i.user.id))return componentNotice(i,{content:'❌ لا يمكنك الجلوس الآن.'});if(game.seated.has(i.user.id))return componentNotice(i,{content:'✅ أنت جالس بالفعل.'});const seats=Math.max(1,game.alive.length-1);if(game.seated.size>=seats)return componentNotice(i,{content:'💥 انتهت الكراسي!'});game.seated.add(i.user.id);await componentNotice(i,{content:`🪑 جلست! (${game.seated.size}/${seats})`});if(game.seated.size>=seats){clearTimeout(game.timer);game.timer=null;resolveChairRound(game).catch(()=>{});}}
}
async function chairRound(game){
  if(chairsGames.get(game.key)!==game)return;if(game.alive.length<=1)return finishChairs(game);game.phase='seat';game.seated=new Set();const seats=game.alive.length-1,row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pub:chairs:seat').setLabel('اجلس الآن').setEmoji('🪑').setStyle(ButtonStyle.Success));game.roundMessage=await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle(`🪑 الجولة ${game.round}`).setDescription(`👥 اللاعبون: **${game.alive.length}**\n🪑 الكراسي: **${seats}**\n⏱️ أمامكم **${game.rule.roundTimeSeconds} ثانية** — اضغط **اجلس الآن**!`)],components:[row]});game.timer=setTimeout(()=>resolveChairRound(game).catch(()=>{}),game.rule.roundTimeSeconds*1000);
}
async function resolveChairRound(game){
  if(game.resolving||game.phase!=='seat'||chairsGames.get(game.key)!==game)return;game.resolving=true;game.phase='resolve';if(game.timer){clearTimeout(game.timer);game.timer=null;}await game.roundMessage?.edit({components:[]}).catch(()=>{});let survivors=[...game.seated];let eliminated=game.alive.filter(x=>!game.seated.has(x));if(!survivors.length){const out=randomItem(game.alive);eliminated=[out];survivors=game.alive.filter(x=>x!==out);}game.alive=survivors;await game.channel.send(`💥 خرج: ${playerNames(game,eliminated)}\n✅ المتبقون: ${playerNames(game,game.alive)}`).catch(()=>{});game.round++;game.resolving=false;await sleep(1200);return chairRound(game);
}
async function finishChairs(game){const winner=game.alive[0];if(winner&&game.rule.winnerReward>0)await store.updateUser(game.guild.id,winner,u=>u.balance+=game.rule.winnerReward);await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle('🏆 فائز الكراسي').setDescription(winner?`<@${winner}> فاز!\n💰 **${game.rule.winnerReward.toLocaleString()} ${currency(game.cfg)}**`:'انتهت بدون فائز.')] }).catch(()=>{});chairsGames.delete(game.key);}

async function startMafia(i,cfg,site,fromMenu=false){
  const type='mafia';if(!gameAvailable(cfg,site,type))return fromMenu?componentNotice(i,{content:'❌ المافيا غير متاحة.'}):safeReply(i,{content:'❌ المافيا غير متاحة لهذه الخطة أو معطلة.',ephemeral:true});const key=gameKey(i.guild.id,i.channel.id);if(channelBusy(key))return fromMenu?componentNotice(i,{content:'❌ توجد لعبة تعمل في هذا الروم.'}):safeReply(i,{content:'❌ توجد لعبة تعمل في هذا الروم.',ephemeral:true});const lim=lobbyLimits(cfg,site,type),game={key,type,guild:i.guild,channel:i.channel,cfg,site,rule:gameRule(cfg,site,type),hostId:i.user.id,players:[i.user.id],minPlayers:lim.min,maxPlayers:lim.max,phase:'lobby',alive:new Set(),mafias:new Set(),citizens:new Set(),votes:new Map(),round:1,timer:null};mafiaGames.set(key,game);void serverLogs.game(i,type,'فتح لوبي لعبة');return sendLobby(i,game,'🎭 Mafia','بعد البدء يرسل البوت الدور لكل لاعب بالخاص. بالليل تختار المافيا ضحية تلقائيًا، وبالنهار يصوّت الجميع.',fromMenu);
}
async function mafiaComponent(i,cfg,site){
  const key=gameKey(i.guild.id,i.channel.id),game=mafiaGames.get(key);if(!game)return componentNotice(i,{content:'❌ لا توجد Mafia نشطة.'});const action=i.customId.split(':')[2];
  if(action==='join'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة.'});if(game.players.includes(i.user.id))return componentNotice(i,{content:'⚠️ أنت منضم.'});if(game.players.length>=game.maxPlayers)return componentNotice(i,{content:'❌ اللعبة ممتلئة.'});game.players.push(i.user.id);return updateLobby(i,game,'🎭 Mafia','بعد البدء يرسل البوت الدور لكل لاعب بالخاص. بالليل تختار المافيا ضحية تلقائيًا، وبالنهار يصوّت الجميع.');}
  if(action==='leave'){if(game.phase!=='lobby')return componentNotice(i,{content:'❌ بدأت اللعبة.'});game.players=game.players.filter(x=>x!==i.user.id);if(!game.players.length){mafiaGames.delete(key);return i.update({content:'🛑 تم إلغاء Mafia.',embeds:[],components:[]});}if(game.hostId===i.user.id)game.hostId=game.players[0];return updateLobby(i,game,'🎭 Mafia','بعد البدء يرسل البوت الدور لكل لاعب بالخاص. بالليل تختار المافيا ضحية تلقائيًا، وبالنهار يصوّت الجميع.');}
  if(action==='start'){if(!canStartLobby(i,game))return componentNotice(i,{content:'❌ المضيف أو الإدارة فقط.'});if(game.players.length<game.minPlayers)return componentNotice(i,{content:`❌ تحتاج ${game.minPlayers} لاعبين على الأقل.`});game.phase='running';void serverLogs.game(i,game.type,'بدء اللعب بعد اللوبي');game.alive=new Set(game.players);const shuffled=[...game.players].sort(()=>Math.random()-.5),mafiaCount=Math.max(1,Math.min(3,Math.floor(game.players.length/4)));game.mafias=new Set(shuffled.slice(0,mafiaCount));game.citizens=new Set(shuffled.slice(mafiaCount));for(const id of game.players){const role=game.mafias.has(id)?'🔪 أنت **MAFIA**':'👤 أنت **مواطن**';client.users.fetch(id).then(u=>u.send(`🎭 Mafia في **${game.guild.name}**\n${role}\nلا تكشف دورك.`)).catch(()=>{});}await i.update({embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🎭 بدأت Mafia').setDescription(`تم توزيع الأدوار بالخاص.\n👥 اللاعبون: ${game.players.length}\n🔪 عدد أفراد المافيا: **${mafiaCount}**`)],components:[]});runMafiaRound(game).catch(e=>{console.error('Public mafia:',e);mafiaGames.delete(key);});}
  if(action==='vote'){if(game.phase!=='vote'||!game.alive.has(i.user.id))return componentNotice(i,{content:'❌ لا يمكنك التصويت الآن.'});const target=i.values?.[0];if(!target||!game.alive.has(target)||target===i.user.id)return componentNotice(i,{content:'❌ اختيار غير صالح.'});game.votes.set(i.user.id,target);return componentNotice(i,{content:`🗳️ تم تسجيل صوتك ضد <@${target}>.`});}
}
function mafiaWinner(game){const alive=[...game.alive],m=alive.filter(x=>game.mafias.has(x)).length,c=alive.length-m;if(m===0)return'citizens';if(m>=c)return'mafia';return null;}
async function runMafiaRound(game){
  if(mafiaGames.get(game.key)!==game)return;let winner=mafiaWinner(game);if(winner)return finishMafia(game,winner);
  if(game.round>game.rule.rounds){const alive=[...game.alive],m=alive.filter(x=>game.mafias.has(x)).length,c=alive.length-m;return finishMafia(game,m>=c?'mafia':'citizens');}
  game.phase='night';const citizensAlive=[...game.alive].filter(x=>!game.mafias.has(x));if(citizensAlive.length){const victim=randomItem(citizensAlive);game.alive.delete(victim);await game.channel.send(`🌙 **ليلة ${game.round}**\n🔪 المافيا تخلصت من <@${victim}>.`).catch(()=>{});}winner=mafiaWinner(game);if(winner)return finishMafia(game,winner);await sleep(1200);
  if(mafiaGames.get(game.key)!==game)return;
  game.phase='vote';game.votes=new Map();const alive=[...game.alive],options=alive.slice(0,25).map(id=>({label:(game.guild.members.cache.get(id)?.displayName||id).slice(0,100),value:id,description:'صوّت لإخراجه'}));const row=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('pub:mafia:vote').setPlaceholder('اختر من تريد إخراجه').addOptions(options));game.voteMessage=await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle(`☀️ تصويت اليوم ${game.round}`).setDescription(`الأحياء: ${playerNames(game,alive)}\n\n⏱️ أمامكم **${game.rule.roundTimeSeconds} ثانية** للتصويت.`)],components:[row]});game.timer=setTimeout(()=>resolveMafiaVote(game).catch(()=>{}),game.rule.roundTimeSeconds*1000);
}
async function resolveMafiaVote(game){if(game.phase!=='vote'||mafiaGames.get(game.key)!==game)return;game.phase='resolve';await game.voteMessage?.edit({components:[]}).catch(()=>{});const counts={};for(const target of game.votes.values())counts[target]=(counts[target]||0)+1;let out=null,best=-1;for(const [id,n] of Object.entries(counts)){if(n>best){best=n;out=id;}}if(out&&game.alive.has(out)){game.alive.delete(out);await game.channel.send(`🗳️ خرج <@${out}> بـ **${best}** أصوات. ${game.mafias.has(out)?'🔪 كان من المافيا!':'👤 كان مواطنًا.'}`).catch(()=>{});}else await game.channel.send('🗳️ لم يتم حسم التصويت هذا اليوم.').catch(()=>{});const winner=mafiaWinner(game);if(winner)return finishMafia(game,winner);game.round++;await sleep(1200);return runMafiaRound(game);}
async function finishMafia(game,side){if(game.timer)clearTimeout(game.timer);const winners=side==='mafia'?[...game.mafias]:[...game.citizens];if(game.rule.winnerReward>0)for(const id of winners)await store.updateUser(game.guild.id,id,u=>u.balance+=game.rule.winnerReward);await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle(side==='mafia'?'🔪 فازت المافيا':'🏘️ فاز المواطنون').setDescription(`الفريق الفائز: ${playerNames(game,winners)}\n💰 مكافأة كل فائز: **${game.rule.winnerReward.toLocaleString()} ${currency(game.cfg)}**`)]}).catch(()=>{});mafiaGames.delete(game.key);}

const DEFAULT_KILLER_CASES=[
  {id:'case_demo_1',enabled:true,title:'💎 سر الألماسة',story:'اختفت ألماسة من خزنة لم تتعرض للكسر.',suspects:['أحمد','سامر','وليد'],clues:['الخزنة لم تُكسر.','أحمد يعرف الرقم السري.','سامر كان في المطبخ.'],hints:['فكر بمن يستطيع فتحها دون كسر.','الرقم السري هو المفتاح.','شخص واحد يعرف الرقم.'],killer:'أحمد',answer:'أحمد كان يعرف الرقم السري، ولذلك استطاع فتح الخزنة دون كسرها.'}
];
function normalizeKillerCases(raw){
  const src=Array.isArray(raw)&&raw.length?raw:DEFAULT_KILLER_CASES,out=[];
  for(const x of src){
    const suspects=(Array.isArray(x?.suspects)?x.suspects:[]).map(y=>String(y).slice(0,80)).filter(Boolean).slice(0,5);if(suspects.length<2)continue;
    let killer=String(x?.killer||'').trim();
    if(!killer&&Number.isFinite(Number(x?.answer))){const idx=Math.max(0,Math.min(suspects.length-1,Number(x.answer)));killer=suspects[idx]||'';}
    if(!suspects.includes(killer))continue;
    const hints=(Array.isArray(x?.hints)?x.hints:[]).map(y=>String(y).slice(0,300)).filter(Boolean).slice(0,3);while(hints.length<3)hints.push('راجع الأدلة جيدًا.');
    let solution='';
    if(typeof x?.answer==='string'&&!/^\d+$/.test(x.answer.trim()))solution=x.answer;
    else solution=String(x?.explanation||x?.solution||'');
    out.push({id:String(x?.id||`case_${out.length+1}`),enabled:x?.enabled!==false,title:String(x?.title||`قضية ${out.length+1}`).slice(0,120),story:String(x?.story||'').slice(0,2000),suspects,clues:(Array.isArray(x?.clues)?x.clues:[]).map(y=>String(y).slice(0,300)).filter(Boolean).slice(0,10),hints,killer,answer:String(solution||`القاتل هو ${killer}.`).slice(0,2000)});
  }
  return out.filter(x=>x.enabled&&x.story).slice(0,500);
}
async function startKiller(i,cfg,site,fromMenu=false){
  const type='killer';if(!gameAvailable(cfg,site,type))return fromMenu?componentNotice(i,{content:'❌ من القاتل غير متاحة.'}):safeReply(i,{content:'❌ من القاتل غير متاحة لهذه الخطة أو معطلة.',ephemeral:true});
  const key=gameKey(i.guild.id,i.channel.id);if(channelBusy(key))return fromMenu?componentNotice(i,{content:'❌ توجد لعبة تعمل في هذا الروم.'}):safeReply(i,{content:'❌ توجد لعبة تعمل في هذا الروم.',ephemeral:true});
  const cases=normalizeKillerCases(await store.data(i.guild.id,'killer-cases.json',DEFAULT_KILLER_CASES));if(!cases.length)return safeReply(i,{content:'❌ لا توجد قضايا مفعلة للعبة من القاتل.',ephemeral:true});
  const rule=gameRule(cfg,site,type),game={key,type,guild:i.guild,channel:i.channel,cfg,site,rule,hostId:i.user.id,round:1,maxRounds:Math.min(rule.rounds,cases.length),cases:[...cases].sort(()=>Math.random()-.5),scores:{},scoreOrder:{},sequence:0,hintsUsed:0,timer:null,phase:'start'};killerGames.set(key,game);void serverLogs.game(i,type,'بدء لعبة');
  if(fromMenu){if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});await i.channel.send(`🕵️ بدأت **من القاتل** بواسطة ${i.user}.`);}else await safeReply(i,{content:`🕵️ بدأت **من القاتل** — ${game.maxRounds} قضية.`});
  await sleep(350);return killerRound(game);
}
async function killerRound(game){
  if(killerGames.get(game.key)!==game)return;if(game.round>game.maxRounds)return finishKiller(game);
  const c=game.cases[game.round-1];game.current=c;game.phase='answer';game.hintsUsed=0;game.roundWinner=null;
  const suspectRow=new ActionRowBuilder().addComponents(c.suspects.map((name,idx)=>new ButtonBuilder().setCustomId(`pub:killer:answer:${idx}`).setLabel(String(name).slice(0,80)).setStyle(ButtonStyle.Danger)));
  const controlRow=new ActionRowBuilder().addComponents([1,2,3].map(n=>new ButtonBuilder().setCustomId(`pub:killer:hint:${n}`).setLabel(`تلميح ${n}`).setEmoji('💡').setStyle(ButtonStyle.Primary)));
  const clues=c.clues.length?c.clues.map((x,n)=>`**${n+1}.** ${x}`).join('\n'):'لا توجد أدلة إضافية.';
  game.message=await game.channel.send({embeds:[new EmbedBuilder().setColor(0x8B0000).setTitle(`🕵️ ${c.title} — ${game.round}/${game.maxRounds}`).setDescription(`## 📖 القصة\n${c.story}\n\n## 👥 المشتبه بهم\n${c.suspects.map((x,n)=>`**${n+1}.** ${x}`).join('\n')}\n\n## 🔎 الأدلة\n${clues}\n\n⏱️ الوقت: **${game.rule.roundTimeSeconds} ثانية** • لديك 3 تلميحات`)],components:[suspectRow,controlRow]});
  game.timer=setTimeout(()=>resolveKillerRound(game,'timeout').catch(()=>{}),game.rule.roundTimeSeconds*1000);
}
async function killerComponent(i,cfg,site){
  const key=gameKey(i.guild.id,i.channel.id),game=killerGames.get(key);if(!game||game.phase!=='answer')return componentNotice(i,{content:'❌ لا توجد قضية تستقبل إجابات الآن.'});
  const parts=i.customId.split(':'),action=parts[2];
  if(action==='hint'){
    const n=Number(parts[3]);if(!Number.isInteger(n)||n<1||n>3)return componentNotice(i,{content:'❌ تلميح غير صالح.'});if(n>game.hintsUsed+1)return componentNotice(i,{content:`🔒 استخدم **التلميح ${game.hintsUsed+1}** أولًا.`});game.hintsUsed=Math.max(game.hintsUsed,n);return componentNotice(i,{content:`💡 **التلميح ${n}:**\n${game.current.hints[n-1]}`});
  }
  if(action!=='answer')return false;const idx=Number(parts[3]);if(!Number.isInteger(idx)||idx<0||idx>=game.current.suspects.length)return componentNotice(i,{content:'❌ اختيار غير صالح.'});
  const selected=game.current.suspects[idx];if(selected!==game.current.killer)return componentNotice(i,{content:`❌ **${selected}** ليس القاتل. القضية ما زالت مستمرة.`});
  game.roundWinner=i.user;if(!game.scoreOrder[i.user.id])game.scoreOrder[i.user.id]=++game.sequence;if(!i.deferred&&!i.replied)await i.deferUpdate().catch(()=>{});return resolveKillerRound(game,'solved');
}
async function resolveKillerRound(game,reason='timeout'){
  if(game.phase!=='answer'||killerGames.get(game.key)!==game)return;game.phase='resolve';if(game.timer){clearTimeout(game.timer);game.timer=null;}await game.message?.edit({components:[]}).catch(()=>{});
  if(game.roundWinner)game.scores[game.roundWinner.id]=(game.scores[game.roundWinner.id]||0)+1;
  const solved=Boolean(game.roundWinner),who=solved?`🎯 حلها: ${game.roundWinner}`:'⌛ انتهى الوقت بدون حل.';
  await game.channel.send({embeds:[new EmbedBuilder().setColor(solved?0x00AA00:0x747F8D).setTitle(solved?'🎉 تم حل القضية!':'⌛ انتهت القضية').setDescription(`🏆 **القاتل:** ${game.current.killer}\n\n💡 **الحل:**\n${game.current.answer||'—'}\n\n${who}\n🔎 استُخدم **${game.hintsUsed}/3** تلميحات.`)]}).catch(()=>{});
  game.round++;await sleep(1000);return killerRound(game);
}
async function finishKiller(game){
  const rows=Object.entries(game.scores).sort((a,b)=>b[1]-a[1]||Number(game.scoreOrder[a[0]]||999999)-Number(game.scoreOrder[b[0]]||999999));if(!rows.length){await game.channel.send('🏁 انتهت من القاتل بدون فائز.').catch(()=>{});killerGames.delete(game.key);return;}
  const best=rows[0][1],winners=rows.filter(x=>x[1]===best).map(x=>x[0]);if(game.rule.winnerReward>0)for(const id of winners)await store.updateUser(game.guild.id,id,u=>u.balance+=game.rule.winnerReward);
  await game.channel.send({embeds:[new EmbedBuilder().setColor(color(game.cfg)).setTitle('🏆 نهاية من القاتل').setDescription(`الفائزون: ${playerNames(game,winners)}\nالنقاط: **${best}**\n💰 الجائزة لكل فائز: **${game.rule.winnerReward.toLocaleString()} ${currency(game.cfg)}**`)]}).catch(()=>{});killerGames.delete(game.key);
}

async function gangState(gid){const x=await store.data(gid,'gangs-public.json',{gangs:{},membership:{}});x.gangs=x.gangs||{};x.membership=x.membership||{};return x;} async function saveGangState(gid,x){return store.saveData(gid,'gangs-public.json',x);} async function currentGang(gid,uid){const x=await gangState(gid),id=x.membership[uid];return{state:x,id,gang:id?x.gangs[id]:null};}
function gangEmbed(cfg,g){return new EmbedBuilder().setColor(color(cfg)).setTitle(`🏴 ${g.name}`).addFields({name:'القائد',value:`<@${g.leaderId}>`,inline:true},{name:'الخزنة',value:`${Number(g.bank||0).toLocaleString()} ${currency(cfg)}`,inline:true},{name:`الأعضاء (${g.members.length})`,value:g.members.map(id=>`${(g.deputies||[]).includes(id)?'⭐ ':''}<@${id}>`).join('\n')||'—'}).setFooter({text:'ZOMBI Gangs'});}
async function gangCommand(i,cfg,site){
  if(!featureOn(cfg,site,'gangs'))return safeReply(i,{content:deniedText(cfg,'Gangs'),ephemeral:true});
  const maxMembers=Math.min(Number(cfg.gangs.maxMembers||7),limitFor(site,cfg,'gangMembers'));
  const maxDeputies=Math.min(Number(cfg.gangs.maxDeputies||2),limitFor(site,cfg,'gangDeputies'));
  const gid=i.guild.id,uid=i.user.id,sub=i.options.getSubcommand();let{state,gang}=await currentGang(gid,uid);
  if(sub==='list'){const gangs=Object.values(state.gangs||{}).sort((a,b)=>Number(b.bank||0)-Number(a.bank||0));const text=gangs.length?gangs.slice(0,20).map((g,n)=>`**${n+1}. ${g.name}** — 👥 ${g.members?.length||0}/${maxMembers} • 🏦 ${Number(g.bank||0).toLocaleString()}`).join('\n'):'لا توجد عصابات بعد.';return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏴 عصابات السيرفر').setDescription(text)]});}
  if(sub==='create'){
    if(gang)return safeReply(i,{content:'❌ أنت داخل عصابة بالفعل.',ephemeral:true});
    const cost=Math.max(0,Number(cfg.gangs.createCost||0));if(cost){const u=await store.getUser(gid,uid);if(u.balance<cost)return safeReply(i,{content:`❌ إنشاء العصابة يحتاج **${cost.toLocaleString()} ${currency(cfg)}**.`,ephemeral:true});await store.updateUser(gid,uid,x=>x.balance-=cost);}
    const name=String(i.options.getString('name')||'').trim(),gangId=`g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;state.gangs[gangId]={id:gangId,name,leaderId:uid,deputies:[],members:[uid],bank:0,createdAt:Date.now(),lastMissionAt:0,missionsCompleted:0};state.membership[uid]=gangId;await saveGangState(gid,state);return safeReply(i,{content:`✅ تم إنشاء عصابة **${name}**${cost?` مقابل **${cost.toLocaleString()} ${currency(cfg)}**`:''}.`,ephemeral:true});
  }
  if(!gang)return safeReply(i,{content:'❌ أنت لست داخل عصابة.',ephemeral:true});
  if(sub==='info')return safeReply(i,{embeds:[gangEmbed(cfg,gang).addFields({name:'المهمات',value:`${Number(gang.missionsCompleted||0)} مكتملة`,inline:true})]});
  const deputy=(gang.deputies||[]).includes(uid),leader=gang.leaderId===uid,canManage=leader||deputy;
  if(sub==='invite'){if(!canManage)return safeReply(i,{content:'❌ القائد أو النائب فقط يمكنه الدعوة.',ephemeral:true});const target=i.options.getUser('user');if(target.bot)return safeReply(i,{content:'❌ لا يمكن دعوة بوت.',ephemeral:true});if(state.membership[target.id])return safeReply(i,{content:'❌ هذا العضو داخل عصابة بالفعل.',ephemeral:true});if(gang.members.length>=maxMembers)return safeReply(i,{content:`❌ العصابة وصلت للحد الأقصى (${maxMembers}).`,ephemeral:true});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pub:gang:accept:${gang.id}:${target.id}`).setStyle(ButtonStyle.Success).setLabel('قبول الدعوة').setEmoji('✅'));return safeReply(i,{content:`🏴 ${target} تمت دعوتك إلى **${gang.name}**.`,components:[row]});}
  if(sub==='kick'){if(!canManage)return safeReply(i,{content:'❌ لا تملك صلاحية.',ephemeral:true});const target=i.options.getUser('user');if(target.id===gang.leaderId)return safeReply(i,{content:'❌ لا يمكن طرد القائد.',ephemeral:true});if(!gang.members.includes(target.id))return safeReply(i,{content:'❌ العضو ليس في عصابتك.',ephemeral:true});if(deputy&&(gang.deputies||[]).includes(target.id))return safeReply(i,{content:'❌ النائب لا يستطيع طرد نائب آخر.',ephemeral:true});gang.members=gang.members.filter(x=>x!==target.id);gang.deputies=(gang.deputies||[]).filter(x=>x!==target.id);delete state.membership[target.id];await saveGangState(gid,state);return safeReply(i,{content:`✅ تم طرد ${target} من العصابة.`});}
  if(sub==='deputy'){if(!leader)return safeReply(i,{content:'❌ القائد فقط يستطيع إدارة النواب.',ephemeral:true});const target=i.options.getUser('user');if(target.id===uid||!gang.members.includes(target.id))return safeReply(i,{content:'❌ اختر عضوًا من العصابة.',ephemeral:true});gang.deputies=gang.deputies||[];if(gang.deputies.includes(target.id)){gang.deputies=gang.deputies.filter(x=>x!==target.id);await saveGangState(gid,state);return safeReply(i,{content:`➖ تمت إزالة ${target} من منصب النائب.`});}if(gang.deputies.length>=maxDeputies)return safeReply(i,{content:`❌ الحد الأقصى للنواب هو **${maxDeputies}**.`,ephemeral:true});gang.deputies.push(target.id);await saveGangState(gid,state);return safeReply(i,{content:`⭐ أصبح ${target} نائبًا للعصابة.`});}
  if(sub==='leave'){if(leader){if(gang.members.length>1)return safeReply(i,{content:'❌ القائد لا يستطيع المغادرة وفي العصابة أعضاء.',ephemeral:true});delete state.gangs[gang.id];delete state.membership[uid];await saveGangState(gid,state);return safeReply(i,{content:'🗑️ تم حل العصابة.',ephemeral:true});}gang.members=gang.members.filter(x=>x!==uid);gang.deputies=(gang.deputies||[]).filter(x=>x!==uid);delete state.membership[uid];await saveGangState(gid,state);return safeReply(i,{content:'✅ غادرت العصابة.',ephemeral:true});}
  if(sub==='mission'){if(cfg.gangs.missionsEnabled===false)return safeReply(i,{content:'❌ مهمات العصابات معطلة من Dashboard.',ephemeral:true});if(!canManage)return safeReply(i,{content:'❌ القائد أو النائب فقط يستطيع بدء المهمة.',ephemeral:true});if(gang.members.length<2)return safeReply(i,{content:'❌ تحتاج العصابة عضوين على الأقل للمهمات.',ephemeral:true});const now=Date.now(),cd=Math.max(1,Number(cfg.gangs.missionCooldownMinutes||240))*60000,last=Number(gang.lastMissionAt||0);if(now-last<cd)return safeReply(i,{content:`⏳ المهمة التالية <t:${Math.floor((last+cd)/1000)}:R>.`,ephemeral:true});const missions=['حماية نقطة نفوذ','جمع معلومات عن عصابة منافسة','توصيل شحنة آمنة','مهمة مراقبة سرية','تأمين موقع العصابة'];const min=Math.max(0,Number(cfg.gangs.missionRewardMin||0)),max=Math.max(min,Number(cfg.gangs.missionRewardMax||min)),reward=Math.floor(Math.random()*(max-min+1))+min;gang.bank=Number(gang.bank||0)+reward;gang.lastMissionAt=now;gang.missionsCompleted=Number(gang.missionsCompleted||0)+1;await saveGangState(gid,state);return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🏴 مهمة عصابة ناجحة').setDescription(`المهمة: **${randomItem(missions)}**\n💰 أضيف إلى الخزنة: **${reward.toLocaleString()} ${currency(cfg)}**\n🏦 الخزنة الآن: **${Number(gang.bank).toLocaleString()}**`)]});}
  const amount=i.options.getInteger('amount');
  if(sub==='deposit'){if(cfg.gangs.bankEnabled===false)return safeReply(i,{content:'❌ خزنة العصابة معطلة.',ephemeral:true});const u=await store.getUser(gid,uid);if(u.balance<amount)return safeReply(i,{content:'❌ رصيدك غير كافٍ.',ephemeral:true});await store.updateUser(gid,uid,x=>x.balance-=amount);gang.bank=Number(gang.bank||0)+amount;await saveGangState(gid,state);return safeReply(i,{content:`🏦 أودعت **${amount.toLocaleString()}** في خزنة العصابة.`});}
  if(sub==='withdraw'){if(cfg.gangs.bankEnabled===false)return safeReply(i,{content:'❌ خزنة العصابة معطلة.',ephemeral:true});if(!canManage)return safeReply(i,{content:'❌ القائد أو النائب فقط يستطيع السحب.',ephemeral:true});if(Number(gang.bank||0)<amount)return safeReply(i,{content:'❌ خزنة العصابة لا تكفي.',ephemeral:true});gang.bank-=amount;await store.updateUser(gid,uid,x=>x.balance+=amount);await saveGangState(gid,state);return safeReply(i,{content:`💰 سحبت **${amount.toLocaleString()}** من خزنة العصابة.`});}
}
async function acceptGangInvite(i,cfg,site){if(!featureOn(cfg,site,'gangs'))return componentNotice(i,{content:deniedText(cfg,'Gangs')});const parts=i.customId.split(':'),gangId=parts[3],targetId=parts[4];if(i.user.id!==targetId)return componentNotice(i,{content:'❌ هذه الدعوة ليست لك.'});const state=await gangState(i.guild.id),gang=state.gangs[gangId];if(!gang)return componentNotice(i,{content:'❌ العصابة لم تعد موجودة.'});if(state.membership[i.user.id])return componentNotice(i,{content:'❌ أنت داخل عصابة بالفعل.'});const maxMembers=Math.min(Number(cfg.gangs.maxMembers||7),limitFor(site,cfg,'gangMembers'));if(gang.members.length>=maxMembers)return componentNotice(i,{content:'❌ العصابة ممتلئة.'});gang.members.push(i.user.id);state.membership[i.user.id]=gangId;await saveGangState(i.guild.id,state);await i.update({content:`✅ ${i.user} انضم إلى **${gang.name}**.`,components:[]});}

async function adminCommand(i,cfg,site){
  if(!isAdmin(i))return safeReply(i,{content:'❌ تحتاج صلاحية إدارة السيرفر.',ephemeral:true});
  const sub=i.options.getSubcommand();
  if(sub==='synccommands'){const result=await registerGuildCommands(i.guild);return safeReply(i,{content:`✅ تمت مزامنة **${result?.count||publicCommands.length}** أمر. جرّب الآن `/games` أو `/roulette`.`,ephemeral:true});}
  if(sub==='gamepanel'){if(!featureOn(cfg,site,'games'))return safeReply(i,{content:deniedText(cfg,'Games'),ephemeral:true});await sendGamesPanel(i.guild,i.channel,cfg,site);await logAction(i.guild,cfg,`🎮 ${i.user.tag} أرسل/حدث لوحة الألعاب في #${i.channel.name}.`);return safeReply(i,{content:'✅ تم إرسال / تحديث لوحة الألعاب في هذا الروم.',ephemeral:true});}
  if(sub==='stopgames')return stopAllGuildGames(i);
  if(sub==='ticketpanel'){if(!featureOn(cfg,site,'tickets'))return safeReply(i,{content:deniedText(cfg,'Tickets'),ephemeral:true});await sendTicketPanel(i.guild,i.channel,cfg,site);await logAction(i.guild,cfg,`🎫 ${i.user.tag} أرسل لوحة التذاكر في #${i.channel.name}.`);return safeReply(i,{content:'✅ تم إرسال لوحة التذاكر في هذا الروم.',ephemeral:true});}
  if(sub==='storepanel'){if(!featureOn(cfg,site,'store'))return safeReply(i,{content:deniedText(cfg,'Store'),ephemeral:true});await storeSystem.sendStorePanel(i.guild,i.channel,cfg,site);await logAction(i.guild,cfg,`🛒 ${i.user.tag} أرسل لوحة المتجر في #${i.channel.name}.`);return safeReply(i,{content:'✅ تم إرسال لوحة المتجر في هذا الروم.',ephemeral:true});}
  if(sub==='rolepanel'){if(!featureOn(cfg,site,'rolePanel'))return safeReply(i,{content:deniedText(cfg,'Self Roles'),ephemeral:true});await sendRolePanel(i.guild,i.channel,cfg,site);await logAction(i.guild,cfg,`🔔 ${i.user.tag} أرسل لوحة الرتب في #${i.channel.name}.`);return safeReply(i,{content:'✅ تم إرسال لوحة الرتب في هذا الروم.',ephemeral:true});}
  if(!featureOn(cfg,site,'moderation'))return safeReply(i,{content:deniedText(cfg,'Moderation'),ephemeral:true});
  if(sub==='clear'){
    if(cfg.moderation?.clearEnabled===false)return safeReply(i,{content:'❌ أمر Clear معطّل من Dashboard.',ephemeral:true});
    const requested=i.options.getInteger('amount'),max=Math.min(100,limitFor(site,cfg,'maxClearMessages'));if(requested>max)return safeReply(i,{content:`❌ الحد الأقصى في الخطة هو **${max}** رسالة.`,ephemeral:true});const msgs=await i.channel.bulkDelete(requested,true);await logAction(i.guild,cfg,`🧹 ${i.user.tag} حذف ${msgs.size} رسالة من #${i.channel.name}.`);return safeReply(i,{content:`🧹 تم حذف ${msgs.size} رسالة.`,ephemeral:true});
  }
  if(sub==='kick'){
    if(cfg.moderation?.kickEnabled===false)return safeReply(i,{content:'❌ Kick معطّل من Dashboard.',ephemeral:true});const m=await i.guild.members.fetch(i.options.getUser('user').id);if(!m.kickable)return safeReply(i,{content:'❌ لا أستطيع طرد هذا العضو.',ephemeral:true});const tag=m.user.tag;await m.kick(i.options.getString('reason')||`By ${i.user.tag}`);await logAction(i.guild,cfg,`👢 ${i.user.tag} طرد ${tag}.`);return safeReply(i,{content:`✅ تم طرد ${tag}.`,ephemeral:true});
  }
  if(sub==='ban'){
    if(cfg.moderation?.banEnabled===false)return safeReply(i,{content:'❌ Ban معطّل من Dashboard.',ephemeral:true});const u=i.options.getUser('user');await i.guild.members.ban(u.id,{reason:i.options.getString('reason')||`By ${i.user.tag}`});await logAction(i.guild,cfg,`🔨 ${i.user.tag} حظر ${u.tag}.`);return safeReply(i,{content:`✅ تم حظر ${u.tag}.`,ephemeral:true});
  }
  if(sub==='lock'||sub==='unlock'){
    if(cfg.moderation?.lockEnabled===false)return safeReply(i,{content:'❌ Lock/Unlock معطّل من Dashboard.',ephemeral:true});await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:sub==='unlock'?null:false});await logAction(i.guild,cfg,`${sub==='lock'?'🔒':'🔓'} ${i.user.tag} ${sub==='lock'?'قفل':'فتح'} #${i.channel.name}.`);return safeReply(i,{content:sub==='lock'?'🔒 تم قفل الروم.':'🔓 تم فتح الروم.',ephemeral:true});
  }
}
async function premiumCommand(i,cfg){const code=i.options.getString('code');if(code){if(!isAdmin(i))return safeReply(i,{content:'❌ تفعيل Premium يحتاج صلاحية Manage Server.',ephemeral:true});try{const r=await store.redeemCode(i.guild.id,code);siteCache.at=0;return safeReply(i,{content:`💎 تم تفعيل ${r.item.plan==='premium_plus'?'Premium+':'Premium'} لمدة **${r.item.days} يوم** لهذا السيرفر!`,ephemeral:true});}catch(e){return safeReply(i,{content:`❌ ${e.message}`,ephemeral:true});}}const until=store.isPremium(cfg)?`\nينتهي: <t:${Math.floor(cfg.premiumUntil/1000)}:R>`:'',row=baseUrl()?new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Premium').setURL(`${baseUrl()}/premium`)):null;return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('💎 ZOMBI Premium').setDescription(`الخطة الحالية: **${planLabel(cfg)}**${until}\n\nالميزات والحدود يحددها صاحب ZOMBI من Owner Panel.`)],components:row?[row]:[],ephemeral:true});}
async function helpCommand(i,cfg,site){const list=[];if(featureOn(cfg,site,'economy'))list.push('`/balance` `/daily` `/pay` `/leaderboard` — Economy');if(featureOn(cfg,site,'bank'))list.push('`/bank` — البنك');if(featureOn(cfg,site,'games'))list.push('`/games` — لوحة الألعاب', '`/roulette` `/chairs` `/mafia` `/killer` — تشغيل مباشر إذا كانت متاحة', '`/ايقاف` أو `#ايقاف` — إيقاف اللعبة للمضيف أو الرتب المسموحة أو الإدارة');if(featureOn(cfg,site,'store'))list.push('`/store` — المتجر');if(featureOn(cfg,site,'gangs'))list.push('`/gang` — العصابات');if(featureOn(cfg,site,'moderation'))list.push('`/admin` — الإدارة');list.push('`/داشبورد` — لوحة تحكم السيرفر','`/premium` — حالة Premium');return safeReply(i,{embeds:[new EmbedBuilder().setColor(color(cfg)).setTitle('🤖 ZOMBI Commands').setDescription(list.join('\n'))],ephemeral:true});}

async function handleInteraction(i){
  try{if(!i.guild)return false;if(await require('./warningSystem').handleInteraction(i))return true;const home=String(homeGuildGetter?.()||''),isHome=i.guild.id===home,cid=i.customId||'';
  if(i.isButton()&&cid==='pub:game:stop'){await stopCurrentRoomGames(i);return true;}
  if(i.isChatInputCommand()&&['ايقاف','stopgame'].includes(i.commandName)){await deferPublicSlash(i);await stopCurrentRoomGames(i);return true;}
  if (cid.startsWith('pub:bank:') || (i.isChatInputCommand()&&i.commandName==='bank')) {
    const [cfg,site]=await Promise.all([store.getConfig(i.guild.id),siteConfig()]);
    if(!featureOn(cfg,site,'bank')||i.channelId!==cfg.channels?.bankPanel){await safeReply(i,{content:'❌ افتح لوحة البنك داخل روم البنك المحدد فقط.',ephemeral:true});return true;}
    const bank=await fullBank.get(i.guild.id,cfg,isHome);await safeReply(i,{...bank.createBankPanel(),ephemeral:true});return true;
  }
  if (/^(bank_|stock_|trade_|heist:)/.test(cid)) {
    const [cfg,site]=await Promise.all([store.getConfig(i.guild.id),siteConfig()]);
    if(!featureOn(cfg,site,'bank')){await safeReply(i,{content:'البنك معطل أو غير متاح.',ephemeral:true});return true;}
    const bank=await fullBank.get(i.guild.id,cfg,isHome);await bank.handleBankInteraction(i);await bank.flush();return true;
  }
  if ((i.isChatInputCommand()&&['games','roulette','chairs','mafia','killer'].includes(i.commandName)) || cid.startsWith('pub:game:') || cid==='pub:games:select') {
    const gameCfg=await store.getConfig(i.guild.id);
    if(!canStartGames(i,gameCfg)){const roles=(gameCfg.games?.startRoleIds||[]).map(id=>`<@&${id}>`).join('، ');await safeReply(i,{content:roles?`❌ تشغيل الألعاب متاح فقط للأدمن أو الرتب: ${roles}`:'❌ تشغيل الألعاب متاح للأدمن فقط. اختر رتب إضافية من Dashboard.',ephemeral:true});return true;}
  }
  if(i.isChatInputCommand()&&i.commandName==='داشبورد'){await deferPublicSlash(i);await replyDashboard(i);return true;}
  // السيرفر الأساسي يبقى على أوامره القديمة، لكن لو أرسلنا Panels من الموقع
  // لازم نعالج أزرار/قوائم pub:* حتى تعمل Tickets / Store / Self Roles من Dashboard الجديد.
  if(isHome){
    if(cid.startsWith('pub:')){
      const [cfg,site]=await Promise.all([store.getConfig(i.guild.id),siteConfig()]);await syncGuildBotProfile(i.guild,cfg,site);applyPlanPresentation(cfg,site);
      if(cid.startsWith('pub:bank:')&&await handleBankPanelInteraction(i,cfg,site))return true;
      if(await citySystems.handleInteraction(i,cfg,site))return true;
      if(await storeSystem.handleInteraction(i,cfg,site))return true;
      if(i.isButton()&&cid.startsWith('pub:ticket:open:')){await openTicket(i,cfg,site);return true;}
      if(i.isButton()&&cid==='pub:ticket:close'){await closeTicket(i);return true;}
      if(i.isButton()&&cid.startsWith('pub:role:')){await toggleRole(i,cfg,site);return true;}
      if(i.isStringSelectMenu()&&cid==='pub:store:buy'){await buyStore(i,cfg,site);return true;}
      if(i.isButton()&&cid.startsWith('pub:game:')){const type=cid.split(':')[2];await startGameByType(i,type,cfg,site,true);return true;}
      if(i.isStringSelectMenu()&&cid==='pub:games:select'){const type=i.values[0];await startGameByType(i,type,cfg,site,true);return true;}
      if(i.isButton()&&cid.startsWith('pub:rps:')){await handleRpsButton(i,cfg,site);return true;}
    }
    return false;
  }
  if(i.isChatInputCommand())await deferPublicSlash(i);
  const [cfg,site]=await Promise.all([store.getConfig(i.guild.id),siteConfig()]);applyPlanPresentation(cfg,site);schedulePremiumPromo(i,cfg,site);
  if(i.isChatInputCommand()){
    if(i.commandName==='setup'){if(!isAdmin(i))return true;const url=dashboardUrl(i.guild.id),rows=url?[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('إكمال الإعداد').setEmoji('⚙️'))]:[];await safeReply(i,{content:url?undefined:'⚠️ رابط الموقع لم يتم ضبطه بعد.',embeds:[dashboardEmbed(i.guild,cfg)],components:rows,ephemeral:true});return true;}
    if(['balance','daily','pay','leaderboard'].includes(i.commandName)){await economyCommand(i,cfg,site);return true;}
    if(i.commandName==='profile'){await profileCommand(i,cfg,site);return true;}
    if(i.commandName==='bank'){await bankCommand(i,cfg,site);return true;}
    if(i.commandName==='gang'){await citySystems.handleGangCommand(i,cfg,site);return true;}
    if(i.commandName==='games'){const type=i.options.getString('game');if(type)await startGameByType(i,type,cfg,site,false);else await showGamesMenu(i,cfg,site);return true;}
    if(i.commandName==='ايقاف'||i.commandName==='stopgame'){await stopCurrentRoomGames(i);return true;}
    if(['roulette','chairs','mafia','killer'].includes(i.commandName)){await startGameByType(i,i.commandName,cfg,site,false);return true;}
    if(i.commandName==='store'){await storeSystem.showStore(i,cfg,site,safeReply);return true;}
    if(i.commandName==='premium'){await premiumCommand(i,cfg);return true;}
    if(i.commandName==='help'){await helpCommand(i,cfg,site);return true;}
    if(i.commandName==='admin'){await adminCommand(i,cfg,site);return true;}
    return true;
  }
  if(i.isButton()&&cid.startsWith('pub:game:')){const type=cid.split(':')[2];await startGameByType(i,type,cfg,site,true);return true;}
  if(i.isStringSelectMenu()&&cid==='pub:games:select'){const type=i.values[0];await startGameByType(i,type,cfg,site,true);return true;}
  if(i.isButton()&&cid.startsWith('pub:rps:')){await handleRpsButton(i,cfg,site);return true;}
  if(cid.startsWith('pub:bank:')&&await handleBankPanelInteraction(i,cfg,site))return true;
  if(await citySystems.handleInteraction(i,cfg,site))return true;
  if(await storeSystem.handleInteraction(i,cfg,site))return true;
  if((i.isButton()||i.isStringSelectMenu())&&cid.startsWith('pub:roulette:')){await rouletteComponent(i,cfg,site);return true;}
  if(i.isButton()&&cid.startsWith('pub:chairs:')){await chairsComponent(i,cfg,site);return true;}
  if((i.isButton()||i.isStringSelectMenu())&&cid.startsWith('pub:mafia:')){await mafiaComponent(i,cfg,site);return true;}
  if(i.isButton()&&cid.startsWith('pub:killer:')){await killerComponent(i,cfg,site);return true;}
  if(i.isButton()&&cid.startsWith('pub:gang:accept:')){await acceptGangInvite(i,cfg,site);return true;}
  if(i.isButton()&&cid.startsWith('pub:ticket:open:')){await openTicket(i,cfg,site);return true;}
  if(i.isButton()&&cid==='pub:ticket:close'){await closeTicket(i);return true;}
  if(i.isButton()&&cid.startsWith('pub:role:')){await toggleRole(i,cfg,site);return true;}
  if(i.isStringSelectMenu()&&cid==='pub:store:buy'){await buyStore(i,cfg,site);return true;}
  return true;

  }catch(error){
    const label=i?.isChatInputCommand?.()?`/${i.commandName}`:(i?.customId||'interaction');
    console.error(`❌ Public interaction failed [${i?.guild?.name||i?.guildId||'unknown'}] ${label}:`,error);
    const payload={content:`❌ تعذر تنفيذ الأمر الآن.\n\`${String(error?.message||error).slice(0,180)}\``,ephemeral:true};
    try{await safeReply(i,payload);}catch{}
    return true;
  }
}
async function registerGuildCommands(guild){
  const home=String(homeGuildGetter?.()||'');
  if(!guild||guild.id===home)return {skipped:true};
  const payload=publicCommands.map(x=>x.toJSON());
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const registered=await guild.commands.set(payload);
      console.log(`✅ Public commands registered: ${guild.name} (${registered.size}) [attempt ${attempt}]`);
      return {ok:true,count:registered.size};
    }catch(e){
      lastError=e;
      console.warn(`⚠️ Public commands ${guild.name} attempt ${attempt}:`,e?.message||e);
      if(attempt<3)await sleep(attempt*1500);
    }
  }
  throw lastError||new Error('تعذر تسجيل أوامر السيرفر.');
}
async function registerGlobalCommands(){
  if(!client?.application)return {ok:false,count:0};
  const payload=publicCommands.map(x=>x.toJSON());
  try{const registered=await client.application.commands.set(payload);console.log(`✅ Global public commands registered: ${registered.size}`);return {ok:true,count:registered.size};}
  catch(e){console.warn('⚠️ Global public command registration failed:',e?.message||e);return {ok:false,count:0,error:e};}
}
async function registerAll(){
  if(!client)return {ok:0,failed:0};
  let ok=0,failed=0;
  for(const guild of client.guilds.cache.values()){
    if(guild.id===String(homeGuildGetter?.()||''))continue;
    try{await registerGuildCommands(guild);ok++;}
    catch(e){failed++;console.warn(`❌ Commands ${guild.name}:`,e?.message||e);}
  }
  console.log(`🌐 Public command sync finished: ${ok} ok / ${failed} failed`);
  return {ok,failed};
}
function levelFor(xp,cfg){let level=0,need=cfg.levels.baseXp,total=0;while(xp>=total+need&&level<1000){total+=need;level++;need=cfg.levels.baseXp+level*cfg.levels.growth;}return level;}
function init(c,{getHomeGuildId}={}){
  client=c;homeGuildGetter=getHomeGuildId||homeGuildGetter;
  citySystems.init(c,{getSiteConfig:siteConfig,getHomeGuildId:homeGuildGetter});
  const scheduleGuildSync=(g)=>{
    if(!g||g.id===String(homeGuildGetter?.()||''))return;
    Promise.all([store.getConfig(g.id),siteConfig()]).then(([cfg,site])=>syncGuildBotProfile(g,cfg,site)).catch(e=>console.warn(`⚠️ Config/profile init ${g?.name||g?.id}:`,e?.message||e));
    for(const delay of [1500,8000,20000])setTimeout(()=>registerGuildCommands(g).catch(e=>console.warn(`⚠️ Public command retry ${g.name}:`,e?.message||e)),delay).unref?.();
  };
  c.on('guildCreate',scheduleGuildSync);
  c.on('guildAvailable',scheduleGuildSync);
  c.on('messageCreate',async m=>{if(!m.guild||m.author.bot||m.guild.id===String(homeGuildGetter?.()||''))return;try{if(await require('./warningSystem').handleMessage(m))return;const raw=String(m.content||'').trim().toLowerCase();if(await handlePremiumTextLock(m))return;if(raw==='!zombi-sync'||raw==='zombi sync'||raw==='زومبي مزامنة'){const member=m.member,allowed=Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild)||member?.permissions?.has(PermissionFlagsBits.Administrator));if(!allowed){await m.reply('❌ تحتاج صلاحية Manage Server لتحديث الأوامر.').catch(()=>{});return;}const result=await registerGuildCommands(m.guild);await m.reply(`✅ تمت مزامنة **${result?.count||publicCommands.length}** أمر. جرّب الآن **/games** أو **/roulette**.`).catch(()=>{});return;}if(['إيقاف','ايقاف','وقف','!stopgame','!ايقاف'].includes(String(m.content||'').trim())){await stopCurrentRoomGames(messageGameAdapter(m));return;}const [cfg,site]=await Promise.all([store.getConfig(m.guild.id),siteConfig()]);applyPlanPresentation(cfg,site);if(await handleHashGameCommand(m))return;schedulePremiumPromoMessage(m,cfg,site);if(raw==='-العاب'||raw==='-ألعاب'){
if(!canStartGames(m.member,cfg)){await m.reply('❌ تشغيل الألعاب غير مسموح لك. الرتب المسموحة تحدد من Dashboard.');return;}
if(!featureOn(cfg,site,'games')){await m.reply('الألعاب معطلة أو غير متاحة.');return;}
await m.reply(gamesPanelPayload(cfg));return;}
if(featureOn(cfg,site,'bank')){const bank=await fullBank.get(m.guild.id,cfg);if(await bank.handleBankCommand(m)){await bank.flush();return;}}
if(await citySystems.onMessage(m,cfg,site))return;const key=`${m.guild.id}:${m.author.id}`,now=Date.now();const msgAllowed=!Array.isArray(cfg.economy?.messageChannelIds)||!cfg.economy.messageChannelIds.length||cfg.economy.messageChannelIds.includes(m.channel.id);if(featureOn(cfg,site,'economy')&&msgAllowed)await store.updateUser(m.guild.id,m.author.id,u=>{u.messageCount++;if(u.messageCount%cfg.economy.messageEvery===0&&now-u.lastMessageReward>=cfg.economy.messageCooldownSeconds*1000){u.balance+=cfg.economy.messageReward;u.lastMessageReward=now;}});if(featureOn(cfg,site,'levels')){const prev=(await store.getUser(m.guild.id,m.author.id)).level;await store.updateUser(m.guild.id,m.author.id,u=>{if(now-(msgCooldown.get(key)||0)>=cfg.levels.xpCooldownSeconds*1000){u.xp+=cfg.levels.xpPerMessage;msgCooldown.set(key,now);u.level=levelFor(u.xp,cfg);}});const current=(await store.getUser(m.guild.id,m.author.id)).level;if(current>prev){const ch=m.guild.channels.cache.get(cfg.channels.levelUp)||m.channel;ch?.send?.(`🎉 ${m.author} وصل إلى المستوى **${current}**!`).catch(()=>{});}}}catch(e){console.error('Public message system:',e.message);}});
  c.on('voiceStateUpdate',(oldState,newState)=>{const guild=newState.guild||oldState.guild;if(!guild||guild.id===String(homeGuildGetter?.()||''))return;const member=newState.member||oldState.member;if(!member||member.user.bot)return;const key=`${guild.id}:${member.id}`,was=Boolean(oldState.channel),now=Boolean(newState.channel);if(!was&&now)voiceSessions.set(key,Date.now());else if(was&&!now)voiceSessions.delete(key);else if(was&&now&&!voiceSessions.has(key))voiceSessions.set(key,Date.now());});
  // Premium/profile expiry sync: عند انتهاء Premium يرجع Nickname للوضع العادي تلقائيًا.
  setInterval(async()=>{try{const site=await siteConfig();for(const guild of client.guilds.cache.values()){if(guild.id===String(homeGuildGetter?.()||''))continue;const cfg=await store.getConfig(guild.id);await syncGuildBotProfile(guild,cfg,site);}}catch(e){console.warn('⚠️ Premium/profile expiry sync:',e?.message||e);}},300000).unref?.();
  setInterval(async()=>{const now=Date.now();for(const [key,since] of voiceSessions){try{const [gid,uid]=key.split(':'),guild=client.guilds.cache.get(gid);if(!guild||gid===String(homeGuildGetter?.()||'')){voiceSessions.delete(key);continue;}const [cfg,site]=await Promise.all([store.getConfig(gid),siteConfig()]);applyPlanPresentation(cfg,site);if(!featureOn(cfg,site,'voiceRewards')){voiceSessions.delete(key);continue;}const member=guild.members.cache.get(uid);if(!member?.voice?.channel){voiceSessions.delete(key);continue;}const allowedVoice=!Array.isArray(cfg.economy?.voiceChannelIds)||!cfg.economy.voiceChannelIds.length||cfg.economy.voiceChannelIds.includes(member.voice.channel.id);if(!allowedVoice){voiceSessions.set(key,now);continue;}const interval=cfg.economy.voiceEveryMinutes*60000;if(now-since>=interval){await store.updateUser(gid,uid,u=>u.balance+=cfg.economy.voiceReward);voiceSessions.set(key,now);member.send(`🎙️ حصلت على **${cfg.economy.voiceReward.toLocaleString()}** ${currency(cfg)} مقابل نشاطك الصوتي في **${guild.name}**.`).catch(()=>{});}}catch(e){console.warn('Voice reward:',e.message);}}},60000).unref?.();
}

module.exports={init,handleInteraction,handlePremiumTextLock,handleHashGameCommand,stopCurrentRoomGames,stopGameKey,registerGuildCommands,registerGlobalCommands,registerAll,dashboardCommand:dashboard.toJSON(),publicCommands:publicCommands.map(x=>x.toJSON()),sendGamesPanel,sendBankPanel,sendTicketPanel,sendStorePanel:storeSystem.sendStorePanel,sendRolePanel,dashboardUrl,siteConfig};
