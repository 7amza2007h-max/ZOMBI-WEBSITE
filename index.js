// ==========================================================
// ZOM BOT - PROFESSIONAL FULL INDEX.JS
// Discord.js v14
// ==========================================================
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    SlashCommandBuilder,
    AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

// مكتبات العجلة المتحركة الموجودة في مشروعك - تحميل آمن
let createCanvas = null;
let loadImage = null;
let GIFEncoder = null;

try {
    ({ createCanvas, loadImage } = require('canvas'));
    GIFEncoder = require('gifencoder');
} catch (error) {
    console.warn(
        '⚠️ canvas/gifencoder غير متوفرين؛ ستعمل عجلة ZOM بالأنيميشن النصي.'
    );
}

const {
    createChairsGame,
    handleChairsInteraction,
    stopChairsGame
} = require('./chairsGame');

const {
    startKillerGame,
    handleKillerButton,
    stopKillerGame
} = require('./games/killerGame');

const {
    initVoiceRooms,
    handleVoiceStateUpdate,
    handleVoiceRoomInteraction,
    handleVoiceRoomSelect,
    handleRenameMessage,
    refreshPanel: refreshVoiceRoomPanel
} = require('./voiceRooms/voiceRooms');

const {
    initLevels,
    handleLevelCommand,
    handleLevelTop
} = require('./levels/levels');

const {
    initBank,
    handleBankCommand,
    handleBankInteraction,
    getUser: getBankUser,
    saveBank,
    getCatalog: getBankCatalog,
    saveCatalog: saveBankCatalog,
    refreshPanel: refreshBankPanel
} = require('./bank/bank');

const gangSystem = require('./gangs/gangSystem');
const gangMissions = require('./gangs/gangMissions');
const bankRobbery = require('./robbery/bankRobbery');
const ticketSystem = require('./tickets/ticketSystem');
const rolePanel = require('./roles/rolePanel');
const nameChangeSystem = require('./nameChangeSystem');
const zomStore = require('./zomStore');
const gameContentStore = require('./gameContent');
const publicSystem = require('./public/publicSystem');
const publicSharedStore = require('./public/sharedStore');
const { QUICK_RULE_GAME_IDS, HEIST_GAME_DEFS, heistGameAllowed } = require('./public/planPolicy');

const {
    handleWarningMessage,
    handleRemoveWarningMessage,
    handleWarningButton,
    handleWarningModal
} = require('./warnings');

// ==========================================================
// CONFIG + LIVE DASHBOARD SETTINGS
// ==========================================================

const TOKEN = process.env.TOKEN;

const {
    loadBotConfig,
    saveBotConfig
} = require('./botConfig');

let dashboardConfig = loadBotConfig();
let citySystemsInitialized = false;

let ALLOWED_GUILD_ID;
let STORE_CHANNEL_ID;
let MESSAGE_CHANNEL_ID;
let VOICE_CHANNEL_IDS;

let MESSAGE_EVERY;
let MESSAGE_REWARD;
let MESSAGE_REWARD_COOLDOWN;
let VOICE_EVERY_MINUTES;
let VOICE_REWARD;
let DAILY_REWARD;
let DAILY_COOLDOWN;
let GAME_REWARD;

let WHEEL_REWARDS;
let ROULETTE_MAX_PLAYERS;
let ROULETTE_ENABLED;
let ROULETTE_TURN_SECONDS;
let ROULETTE_ACTION_COSTS;
let MAFIA_MIN_PLAYERS;
let MAFIA_MAX_PLAYERS;

function applyDashboardConfig(config) {
    dashboardConfig = config;

    ALLOWED_GUILD_ID = config.discord.allowedGuildId;
    STORE_CHANNEL_ID = config.discord.storeChannelId;
    MESSAGE_CHANNEL_ID = config.discord.messageChannelId;
    VOICE_CHANNEL_IDS = [...config.discord.voiceChannelIds];

    MESSAGE_EVERY = config.economy.messageEvery;
    MESSAGE_REWARD = config.economy.messageReward;
    MESSAGE_REWARD_COOLDOWN =
        config.economy.messageRewardCooldownSeconds * 1000;
    VOICE_EVERY_MINUTES = config.economy.voiceEveryMinutes;
    VOICE_REWARD = config.economy.voiceReward;
    DAILY_REWARD = config.economy.dailyReward;
    DAILY_COOLDOWN =
        config.economy.dailyCooldownHours * 60 * 60 * 1000;
    GAME_REWARD = config.economy.gameReward;

    WHEEL_REWARDS = [...config.games.wheelRewards];
    ROULETTE_MAX_PLAYERS = config.games.rouletteMaxPlayers;
    ROULETTE_ENABLED = config.games.rouletteEnabled !== false;
    ROULETTE_TURN_SECONDS = Math.max(10, Math.min(120, Number(config.games.rouletteTurnSeconds || 25)));
    ROULETTE_ACTION_COSTS = {
        revive: Number(config.games.rouletteActionCosts?.revive ?? 300),
        link: Number(config.games.rouletteActionCosts?.link ?? 300),
        protect: Number(config.games.rouletteActionCosts?.protect ?? 300),
        freeze: Number(config.games.rouletteActionCosts?.freeze ?? 500),
        double: Number(config.games.rouletteActionCosts?.double ?? 500),
        curse: Number(config.games.rouletteActionCosts?.curse ?? 500),
        unlink: Number(config.games.rouletteActionCosts?.unlink ?? 200),
        add: Number(config.games.rouletteActionCosts?.add ?? 1000)
    };
    MAFIA_MIN_PLAYERS = config.games.mafiaMinPlayers;
    MAFIA_MAX_PLAYERS = config.games.mafiaMaxPlayers;
}

async function updateDashboardConfig(nextConfig) {
    const previous = dashboardConfig;
    const saved = saveBotConfig(nextConfig);
    applyDashboardConfig(saved);

    if (citySystemsInitialized) {
        try {
            await bankRobbery.handleConfigChange(
                previous.robbery,
                saved.robbery
            );
        } catch (error) {
            const rollback = saveBotConfig(previous);
            applyDashboardConfig(rollback);
            throw error;
        }
    }

    try {
        if (client?.isReady?.()) {
            client.user.setPresence({
                activities: [{ name: saved.system?.presenceText || 'ZOM Economy | /help', type: 0 }],
                status: saved.system?.presenceStatus || 'online'
            });
        }
    } catch (error) {
        console.warn('⚠️ تعذر تحديث Presence مباشرة:', error?.message || error);
    }

    try {
        const voiceChanged = JSON.stringify(previous.voiceRooms) !== JSON.stringify(saved.voiceRooms);
        if (voiceChanged && saved.voiceRooms?.enabled !== false && client?.isReady?.()) {
            await refreshVoiceRoomPanel(client);
        }
    } catch (error) {
        console.warn('⚠️ تعذر تحديث لوحة الرومات الصوتية:', error?.message || error);
    }

    try {
        const bankChanged = previous.bank?.bankChannelId !== saved.bank?.bankChannelId;
        if (bankChanged && client?.isReady?.()) {
            await refreshBankPanel(client);
        }
    } catch (error) {
        console.warn('⚠️ تعذر تحديث لوحة البنك:', error?.message || error);
    }

    try {
        const rolePanelChanged = JSON.stringify(previous.rolePanel) !== JSON.stringify(saved.rolePanel);
        if (rolePanelChanged && client?.isReady?.()) {
            await rolePanel.refreshPanel();
        }
    } catch (error) {
        console.warn('⚠️ تعذر تحديث لوحة رتب الإشعارات:', error?.message || error);
    }

    try {
        const storePanelChanged =
            JSON.stringify(previous.shopPanel) !== JSON.stringify(saved.shopPanel) ||
            previous.discord?.storeChannelId !== saved.discord?.storeChannelId;
        if (storePanelChanged && client?.isReady?.()) {
            await zomStore.refreshPanel();
        }
    } catch (error) {
        console.warn('⚠️ تعذر تحديث لوحة متجر ZOM:', error?.message || error);
    }

    return saved;
}

function setRobberyAvailability(enabled) {
    const next = JSON.parse(
        JSON.stringify(dashboardConfig)
    );
    next.robbery.enabled = enabled === true;
    const saved = saveBotConfig(next);
    applyDashboardConfig(saved);
}

applyDashboardConfig(dashboardConfig);

// ==========================================================
// 🌐 SHARED WEBSITE -> HOME GAME SETTINGS BRIDGE
// Dashboard الموقع يحفظ إعدادات السيرفر الأساسي في Neon مثل باقي السيرفرات.
// هذا الجسر يطبّق أسئلة/وقت/جولات/جائزة الألعاب على النظام الأصلي بدون حذف أي نظام قديم.
// ==========================================================
let homeSharedGameConfig = null;
let homeSharedSiteConfig = null;
let homeSharedSyncAt = 0;
const homePremiumPromoSeen = new Map();

async function syncHomePublicGameSettings(force = false) {
    const guildId = String(ALLOWED_GUILD_ID || dashboardConfig?.discord?.allowedGuildId || '');
    if (!guildId) return null;
    if (!force && homeSharedGameConfig && Date.now() - homeSharedSyncAt < 5000) {
        return homeSharedGameConfig;
    }

    try {
        let sharedCfg = await publicSharedStore.getConfig(guildId);
        const sharedSite = await publicSharedStore.getGlobalConfig();
        homeSharedSiteConfig = sharedSite;

        // أول تشغيل بعد V6: انقل إعدادات الألعاب القديمة للسيرفر الأساسي إلى Neon إذا
        // كانت إعدادات الموقع ما زالت بالقيم الافتراضية. هذا يعمل حتى لو كان V4 قد وضع setupComplete=true.
        if (sharedCfg?.games?.homeLegacyImported !== true) {
            const looksDefault = QUICK_RULE_GAME_IDS.every(key => {
                const r = sharedCfg?.games?.quickGameSettings?.[key] || {};
                return Number(r.rounds || 5) === 5 && Number(r.winnerReward ?? 300) === 300;
            });
            sharedCfg.games = sharedCfg.games || {};
            sharedCfg.games.quickGameSettings = sharedCfg.games.quickGameSettings || {};
            if (looksDefault) {
                for (const key of QUICK_RULE_GAME_IDS) {
                    const oldRule = dashboardConfig?.games?.quickGameSettings?.[key];
                    if (oldRule) sharedCfg.games.quickGameSettings[key] = { ...oldRule };
                }
            }
            sharedCfg.games.homeLegacyImported = true;
            sharedCfg = await publicSharedStore.saveConfig(guildId, sharedCfg);
        }

        let sharedContentRaw = await publicSharedStore.data(guildId, 'game-content.json', null);
        if (!sharedContentRaw) {
            sharedContentRaw = gameContentStore.get();
            await publicSharedStore.saveGameContent(guildId, sharedContentRaw);
        }
        const sharedContent = await publicSharedStore.getGameContent(guildId);

        homeSharedGameConfig = sharedCfg;
        homeSharedSyncAt = Date.now();
        const previousConfigForBridge = JSON.parse(JSON.stringify(dashboardConfig || {}));
        const previousRobberyForBridge = JSON.parse(JSON.stringify(dashboardConfig.robbery || {}));

        dashboardConfig.games = dashboardConfig.games || {};
        dashboardConfig.games.quickGameSettings = dashboardConfig.games.quickGameSettings || {};
        dashboardConfig.games.startRoleIds = Array.isArray(sharedCfg?.games?.startRoleIds) ? sharedCfg.games.startRoleIds.map(String) : [];

        for (const key of QUICK_RULE_GAME_IDS) {
            const src = sharedCfg?.games?.quickGameSettings?.[key];
            if (!src) continue;
            dashboardConfig.games.quickGameSettings[key] = {
                rounds: Math.max(1, Math.min(25, Number(src.rounds || 5))),
                roundTimeSeconds: Math.max(5, Math.min(300, Number(src.roundTimeSeconds || 25))),
                winnerReward: Math.max(0, Number(src.winnerReward || 0))
            };
        }

        if (sharedCfg?.system) {
            dashboardConfig.system = dashboardConfig.system || {};
            dashboardConfig.system.presenceText = String(sharedCfg.system.presenceText || dashboardConfig.system.presenceText || 'ZOM Economy | /help');
            dashboardConfig.system.presenceStatus = ['online','idle','dnd','invisible'].includes(String(sharedCfg.system.presenceStatus)) ? String(sharedCfg.system.presenceStatus) : (dashboardConfig.system.presenceStatus || 'online');
        }
        if (sharedCfg?.bank) {
            dashboardConfig.bank = dashboardConfig.bank || {};
            for (const key of ['goldValue','salaryCooldownHours','maxSalary','tradeProfitPercent','tradeSessionMinutes','maxLoan','loanInterestPercent','companyEmployeeStartSalary','companyEmployeeSalaryIncrease','companyLevelUpHours','companyOwnerStartSalary','companyOwnerSalaryIncrease','heistGameCooldownSeconds','heistTimeSeconds','heistJailHours','heistBailPrice','cashProtectionPrice','cashProtectionMinutes','cashProtectionCooldownMinutes']) {
                if (sharedCfg.bank[key] !== undefined) dashboardConfig.bank[key] = Number(sharedCfg.bank[key]);
            }
            dashboardConfig.bank.heistEnabled = sharedCfg.bank.heistEnabled !== false;
            dashboardConfig.bank.heistGamesAllowed = Object.fromEntries((HEIST_GAME_DEFS||[]).map(g => [g.id, heistGameAllowed(sharedSite, sharedCfg, g.id) && sharedCfg.bank?.heistGamesEnabled?.[g.id] !== false]));
        }
        if (sharedCfg?.warnings) {
            dashboardConfig.warnings = {
                role1Id: String(sharedCfg.warnings.role1Id || ''),
                role2Id: String(sharedCfg.warnings.role2Id || ''),
                role3Id: String(sharedCfg.warnings.role3Id || '')
            };
        }
        // V7: مزامنة إعدادات Economy / Voice Rewards / Levels / Gangs من نفس Dashboard
        // حتى السيرفر الأساسي يرجع يتحكم من الموقع بدل تعديل الملفات يدويًا.
        if (sharedCfg?.economy) {
            dashboardConfig.economy.messageEvery = Number(sharedCfg.economy.messageEvery || dashboardConfig.economy.messageEvery);
            dashboardConfig.economy.messageReward = Number(sharedCfg.economy.messageReward ?? dashboardConfig.economy.messageReward);
            dashboardConfig.economy.messageRewardCooldownSeconds = Number(sharedCfg.economy.messageCooldownSeconds ?? dashboardConfig.economy.messageRewardCooldownSeconds);
            dashboardConfig.economy.voiceEveryMinutes = Number(sharedCfg.economy.voiceEveryMinutes || dashboardConfig.economy.voiceEveryMinutes);
            dashboardConfig.economy.voiceReward = Number(sharedCfg.economy.voiceReward ?? dashboardConfig.economy.voiceReward);
            dashboardConfig.economy.dailyReward = Number(sharedCfg.economy.dailyAmount ?? dashboardConfig.economy.dailyReward);
            dashboardConfig.economy.dailyCooldownHours = Number(sharedCfg.economy.dailyCooldownHours || dashboardConfig.economy.dailyCooldownHours);
        }
        if (sharedCfg?.levels) {
            dashboardConfig.levels.enabled = sharedCfg.features?.levels !== false;
            dashboardConfig.levels.xpPerMessage = Number(sharedCfg.levels.xpPerMessage || dashboardConfig.levels.xpPerMessage);
            dashboardConfig.levels.xpCooldownSeconds = Number(sharedCfg.levels.xpCooldownSeconds || dashboardConfig.levels.xpCooldownSeconds);
            dashboardConfig.levels.baseXp = Number(sharedCfg.levels.baseXp || dashboardConfig.levels.baseXp);
            dashboardConfig.levels.xpGrowthPerLevel = Number(sharedCfg.levels.growth ?? dashboardConfig.levels.xpGrowthPerLevel);
            if (sharedCfg.channels?.levelUp) dashboardConfig.levels.levelUpChannelId = String(sharedCfg.channels.levelUp);
        }
        if (sharedCfg?.gangs) {
            dashboardConfig.gangs.maxMembers = Number(sharedCfg.gangs.maxMembers || dashboardConfig.gangs.maxMembers);
            dashboardConfig.gangs.categoryId = String(sharedCfg.channels?.gangCategory || dashboardConfig.gangs.categoryId || '');
            dashboardConfig.gangs.minMissionParticipants = Number(sharedCfg.gangs.minMissionParticipants || 2);
            dashboardConfig.gangs.maxMissionSteps = Number(sharedCfg.gangs.maxMissionSteps || dashboardConfig.gangs.maxMissionSteps || 5);
            dashboardConfig.gangs.puzzleMaxAttempts = Number(sharedCfg.gangs.puzzleMaxAttempts || dashboardConfig.gangs.puzzleMaxAttempts || 2);
            dashboardConfig.gangs.chatMaxAttempts = Number(sharedCfg.gangs.chatMaxAttempts || dashboardConfig.gangs.chatMaxAttempts || 2);
            dashboardConfig.gangs.relayMaxAttempts = Number(sharedCfg.gangs.relayMaxAttempts || dashboardConfig.gangs.relayMaxAttempts || 2);
            dashboardConfig.gangs.missionCooldownMinutes = Math.max(1, Number(sharedCfg.gangs.missionCooldownMinutes || dashboardConfig.gangs.missionCooldownMinutes || 240));
            // إبقاء الحقل القديم للتوافق مع النسخ القديمة، بدون إجبار المدة على ساعة كاملة.
            dashboardConfig.gangs.missionCooldownHours = dashboardConfig.gangs.missionCooldownMinutes / 60;
            dashboardConfig.gangs.missionDurationMinutes = Number(sharedCfg.gangs.missionDurationMinutes || dashboardConfig.gangs.missionDurationMinutes);
            dashboardConfig.gangs.missionRewardMin = Number(sharedCfg.gangs.missionRewardMin ?? dashboardConfig.gangs.missionRewardMin);
            dashboardConfig.gangs.missionRewardMax = Number(sharedCfg.gangs.missionRewardMax ?? dashboardConfig.gangs.missionRewardMax);
        }
        if (sharedCfg?.voiceRooms) {
            dashboardConfig.voiceRooms.enabled = sharedCfg.features?.voiceRooms !== false && sharedCfg.voiceRooms.enabled !== false;
            dashboardConfig.voiceRooms.createVoiceChannelId = String(sharedCfg.channels?.voiceCreate || dashboardConfig.voiceRooms.createVoiceChannelId || '');
            dashboardConfig.voiceRooms.controlTextChannelId = String(sharedCfg.channels?.voiceControl || dashboardConfig.voiceRooms.controlTextChannelId || '');
            dashboardConfig.voiceRooms.categoryId = String(sharedCfg.channels?.voiceCategory || dashboardConfig.voiceRooms.categoryId || '');
            dashboardConfig.voiceRooms.roomName = String(sharedCfg.voiceRooms.roomName || dashboardConfig.voiceRooms.roomName || '🎙️・{username}');
        }
        if (sharedCfg?.channels) {
            if (Array.isArray(sharedCfg.economy?.messageChannelIds) && sharedCfg.economy.messageChannelIds.length) dashboardConfig.discord.messageChannelId = String(sharedCfg.economy.messageChannelIds[0]);
            if (Array.isArray(sharedCfg.economy?.voiceChannelIds) && sharedCfg.economy.voiceChannelIds.length) dashboardConfig.discord.voiceChannelIds = sharedCfg.economy.voiceChannelIds.map(String);
            if (sharedCfg.channels.bankPanel) dashboardConfig.bank.bankChannelId = String(sharedCfg.channels.bankPanel);
        }
        if (sharedCfg?.store) {
            dashboardConfig.shopPanel.enabled = sharedCfg.features?.store !== false;
            dashboardConfig.shopPanel.channelId = String(sharedCfg.channels?.storePanel || dashboardConfig.shopPanel.channelId || '');
            dashboardConfig.shopPanel.title = String(sharedCfg.store.title || dashboardConfig.shopPanel.title || 'متجر الرتب');
            dashboardConfig.shopPanel.description = String(sharedCfg.store.description || dashboardConfig.shopPanel.description || '');
            dashboardConfig.shopPanel.footer = String(sharedCfg.store.footer || dashboardConfig.shopPanel.footer || 'ZOMBI • ZOM Store');
            dashboardConfig.shopPanel.bannerUrl = String(sharedCfg.store.bannerUrl || '');
            dashboardConfig.shopPanel.thumbnailUrl = String(sharedCfg.store.thumbnailUrl || '');
            dashboardConfig.shopPanel.detailBannerUrl = String(sharedCfg.store.detailBannerUrl || '');
            dashboardConfig.shopPanel.accentColor = String(sharedCfg.store.accentColor || dashboardConfig.shopPanel.accentColor || '#B00020');
        }
        if (sharedCfg?.rolePanel) {
            dashboardConfig.rolePanel.enabled = sharedCfg.features?.rolePanel !== false;
            dashboardConfig.rolePanel.channelId = String(sharedCfg.channels?.rolePanel || dashboardConfig.rolePanel.channelId || '');
            dashboardConfig.rolePanel.title = String(sharedCfg.rolePanel.title || dashboardConfig.rolePanel.title || '');
            dashboardConfig.rolePanel.description = String(sharedCfg.rolePanel.description || dashboardConfig.rolePanel.description || '');
            dashboardConfig.rolePanel.roles = (sharedCfg.rolePanel.items || []).map(item => ({
                roleId: String(item.roleId || ''), label: String(item.label || ''), emoji: String(item.emoji || '🔔'), style: String(item.style || 'Primary')
            })).filter(item => item.roleId);
        }
        if (sharedCfg?.tickets && typeof ticketSystem.replaceConfiguration === 'function') {
            const oldTicketState = ticketSystem.getState?.() || {};
            const remoteTypes = Array.isArray(sharedCfg.tickets.types) ? sharedCfg.tickets.types : [];
            const nextTicketConfig = {
                panel: {
                    title: String(sharedCfg.tickets.title || oldTicketState.panel?.title || '🎫 ZOMBI Tickets'),
                    description: String(sharedCfg.tickets.description || oldTicketState.panel?.description || ''),
                    footer: String(sharedCfg.branding?.customFooter || oldTicketState.panel?.footer || 'ZOMBI Support'),
                    channelId: String(sharedCfg.channels?.ticketPanel || oldTicketState.panel?.channelId || ''),
                    messageId: String(sharedCfg.tickets.panelMessageId || oldTicketState.panel?.messageId || '')
                },
                types: remoteTypes.map(item => ({
                    id: String(item.id || ''),
                    name: String(item.name || item.label || 'تذكرة'),
                    emoji: String(item.emoji || '🎫'),
                    description: String(item.description || 'فتح تكت جديد'),
                    welcomeMessage: String(item.welcomeMessage || 'اشرح طلبك بالتفصيل وسيتم الرد عليك بأقرب وقت.'),
                    categoryId: String(item.categoryId || sharedCfg.channels?.ticketCategory || ''),
                    openRoleIds: Array.isArray(item.openRoleIds) ? item.openRoleIds.map(String) : [],
                    viewRoleIds: [...new Set([
                        ...(Array.isArray(sharedCfg.tickets.supportRoleIds) ? sharedCfg.tickets.supportRoleIds : []),
                        ...(Array.isArray(item.supportRoleIds) ? item.supportRoleIds : []),
                        ...(Array.isArray(item.viewRoleIds) ? item.viewRoleIds : [])
                    ].map(String))],
                    maxOpenPerUser: Number(item.maxOpenPerUser || 1),
                    enabled: item.enabled !== false
                }))
            };
            const comparableOld = {
                panel: {
                    title: String(oldTicketState.panel?.title || ''),
                    description: String(oldTicketState.panel?.description || ''),
                    footer: String(oldTicketState.panel?.footer || ''),
                    channelId: String(oldTicketState.panel?.channelId || ''),
                    messageId: String(oldTicketState.panel?.messageId || '')
                },
                types: (oldTicketState.types || []).map(item => ({
                    id: String(item.id || ''),
                    name: String(item.name || ''),
                    emoji: String(item.emoji || '🎫'),
                    description: String(item.description || ''),
                    welcomeMessage: String(item.welcomeMessage || ''),
                    categoryId: String(item.categoryId || ''),
                    openRoleIds: Array.isArray(item.openRoleIds) ? item.openRoleIds.map(String) : [],
                    viewRoleIds: Array.isArray(item.viewRoleIds) ? item.viewRoleIds.map(String) : [],
                    maxOpenPerUser: Number(item.maxOpenPerUser || 1),
                    enabled: item.enabled !== false
                }))
            };
            if (JSON.stringify(comparableOld) !== JSON.stringify(nextTicketConfig)) {
                ticketSystem.replaceConfiguration(nextTicketConfig);
                if (client?.isReady?.() && nextTicketConfig.panel.channelId && nextTicketConfig.types.some(x => x.enabled !== false)) {
                    await ticketSystem.sendPanel(nextTicketConfig.panel.channelId).catch(() => {});
                }
            }
        }
        if (sharedCfg?.robbery) {
            dashboardConfig.robbery.enabled = sharedCfg.features?.bankRobbery !== false && sharedCfg.robbery.enabled === true;
            dashboardConfig.robbery.bankChannelId = String(sharedCfg.channels?.centralBank || dashboardConfig.robbery.bankChannelId || '');
            dashboardConfig.robbery.lobbyMinutes = Number(sharedCfg.robbery.lobbyMinutes || dashboardConfig.robbery.lobbyMinutes);
            dashboardConfig.robbery.missionMinutes = Number(sharedCfg.robbery.missionMinutes || dashboardConfig.robbery.missionMinutes);
            dashboardConfig.robbery.reward = Number(sharedCfg.robbery.reward || dashboardConfig.robbery.reward);
            dashboardConfig.robbery.cooldownHours = Number(sharedCfg.robbery.cooldownHours ?? dashboardConfig.robbery.cooldownHours);
            dashboardConfig.robbery.equipmentPrices = {
                mask: Number(sharedCfg.robbery.equipment?.mask ?? dashboardConfig.robbery.equipmentPrices.mask),
                laptop: Number(sharedCfg.robbery.equipment?.hacking ?? dashboardConfig.robbery.equipmentPrices.laptop),
                drill: Number(sharedCfg.robbery.equipment?.drill ?? dashboardConfig.robbery.equipmentPrices.drill),
                radio: Number(sharedCfg.robbery.equipment?.radio ?? dashboardConfig.robbery.equipmentPrices.radio),
                car: Number(sharedCfg.robbery.equipment?.car ?? dashboardConfig.robbery.equipmentPrices.car)
            };
        }
        if (sharedCfg?.games) {
            if (Array.isArray(sharedCfg.games.wheelRewards) && sharedCfg.games.wheelRewards.length) dashboardConfig.games.wheelRewards = sharedCfg.games.wheelRewards.map(Number);
            dashboardConfig.games.rouletteEnabled = sharedCfg.games.rouletteEnabled !== false;
            dashboardConfig.games.rouletteTurnSeconds = Number(sharedCfg.games.rouletteTurnSeconds || dashboardConfig.games.rouletteTurnSeconds || 25);
            if (sharedCfg.games.rouletteActionCosts) dashboardConfig.games.rouletteActionCosts = { ...dashboardConfig.games.rouletteActionCosts, ...sharedCfg.games.rouletteActionCosts };
            if (sharedCfg.games.chairs) {
                dashboardConfig.chairs.startCountdownSeconds = Number(sharedCfg.games.chairs.startCountdownSeconds || dashboardConfig.chairs.startCountdownSeconds || 5);
                dashboardConfig.chairs.betweenRoundsMs = Number(sharedCfg.games.chairs.betweenRoundsMs || dashboardConfig.chairs.betweenRoundsMs || 2500);
            }
        }
        if (sharedCfg?.games?.lobby) {
            dashboardConfig.games.rouletteMaxPlayers = Number(sharedCfg.games.lobby.roulette?.maxPlayers || dashboardConfig.games.rouletteMaxPlayers);
            dashboardConfig.games.mafiaMinPlayers = Number(sharedCfg.games.lobby.mafia?.minPlayers || dashboardConfig.games.mafiaMinPlayers);
            dashboardConfig.games.mafiaMaxPlayers = Number(sharedCfg.games.lobby.mafia?.maxPlayers || dashboardConfig.games.mafiaMaxPlayers);
            dashboardConfig.chairs.minPlayers = Number(sharedCfg.games.lobby.chairs?.minPlayers || dashboardConfig.chairs.minPlayers);
            dashboardConfig.chairs.maxPlayers = Number(sharedCfg.games.lobby.chairs?.maxPlayers || dashboardConfig.chairs.maxPlayers);
            const chairRule = sharedCfg.games.quickGameSettings?.chairs;
            if (chairRule) {
                dashboardConfig.chairs.roundTimeSeconds = Number(chairRule.roundTimeSeconds || dashboardConfig.chairs.roundTimeSeconds);
                dashboardConfig.chairs.winnerReward = Number(chairRule.winnerReward ?? dashboardConfig.chairs.winnerReward);
            }
        }
        // احفظ الجسر في bot-settings.json أيضًا حتى الأنظمة القديمة التي تقرأ getBotConfig()
        // (العصابات/المهمات/السرقة/الفويس) تستقبل تعديل Dashboard مباشرة.
        dashboardConfig = saveBotConfig(dashboardConfig);
        applyDashboardConfig(dashboardConfig);

        // طبّق تغييرات Dashboard على اللوحات القديمة فورًا بدل انتظار Restart.
        if (client?.isReady?.()) {
            try {
                const presenceChanged =
                    previousConfigForBridge.system?.presenceText !== dashboardConfig.system?.presenceText ||
                    previousConfigForBridge.system?.presenceStatus !== dashboardConfig.system?.presenceStatus;
                if (presenceChanged) {
                    client.user.setPresence({
                        activities: [{ name: dashboardConfig.system?.presenceText || 'ZOM Economy | /help', type: 0 }],
                        status: dashboardConfig.system?.presenceStatus || 'online'
                    });
                }
            } catch (error) {
                console.warn('⚠️ تعذر تحديث Presence من Dashboard:', error?.message || error);
            }
            try {
                if (JSON.stringify(previousConfigForBridge.shopPanel || {}) !== JSON.stringify(dashboardConfig.shopPanel || {})) {
                    await zomStore.refreshPanel().catch(() => {});
                }
            } catch {}
            try {
                if (JSON.stringify(previousConfigForBridge.rolePanel || {}) !== JSON.stringify(dashboardConfig.rolePanel || {})) {
                    await rolePanel.refreshPanel().catch(() => {});
                }
            } catch {}
            try {
                if (JSON.stringify(previousConfigForBridge.voiceRooms || {}) !== JSON.stringify(dashboardConfig.voiceRooms || {})) {
                    await refreshVoiceRoomPanel(client).catch(() => {});
                }
            } catch {}
            try {
                if (previousConfigForBridge.bank?.bankChannelId !== dashboardConfig.bank?.bankChannelId) {
                    await refreshBankPanel(client).catch(() => {});
                }
            } catch {}
        }

        if (citySystemsInitialized) {
            try {
                await bankRobbery.handleConfigChange(previousRobberyForBridge, dashboardConfig.robbery || {});
            } catch (robberyBridgeError) {
                console.warn('⚠️ تعذر تحديث حالة سرقة البنك من Dashboard:', robberyBridgeError?.message || robberyBridgeError);
            }
        }

        // نفس ملفات المحتوى القديمة تبقى مستخدمة محليًا، لكن مصدر تعديلها هو Dashboard المشترك.
        gameContentStore.save(sharedContent);
        try {
            const killerCases = await publicSharedStore.data(guildId, 'killer-cases.json', null);
            if (Array.isArray(killerCases)) {
                fs.writeFileSync(path.join(__dirname, 'games', 'killer-cases.json'), JSON.stringify(killerCases, null, 2), 'utf8');
            }
            const gangMissionTemplates = await publicSharedStore.data(guildId, 'gang-missions.json', null);
            if (Array.isArray(gangMissionTemplates)) {
                fs.writeFileSync(path.join(__dirname, 'data', 'gang-missions.json'), JSON.stringify(gangMissionTemplates, null, 2), 'utf8');
            }
        } catch (contentSyncError) {
            console.warn('⚠️ تعذر مزامنة قضايا/مهمات السيرفر الأساسي:', contentSyncError?.message || contentSyncError);
        }

        // V8.3: مزامنة متجر الرتب القديم + كتالوج البنك + لوحة تغيير الاسم من Neon إلى ملفات النظام القديم.
        try {
            if (Array.isArray(sharedCfg?.store?.products)) {
                const nextShop = {};
                for (const product of sharedCfg.store.products) {
                    if (!product?.id || !product?.roleId) continue;
                    nextShop[String(product.id)] = { ...product };
                }
                if (JSON.stringify(nextShop) !== JSON.stringify(shopProducts)) {
                    shopProducts = nextShop;
                    saveShop();
                    await zomStore.refreshPanel().catch(() => {});
                }
            }
            const remoteCatalog = await publicSharedStore.data(guildId, 'bank-catalog.json', null);
            if (remoteCatalog && typeof remoteCatalog === 'object') saveBankCatalog(remoteCatalog);

            if (sharedCfg?.nameChange) {
                const rawColor = String(sharedCfg.nameChange.color || '#8B5CF6').replace('#', '');
                const parsedColor = Number.parseInt(rawColor, 16);
                const oldNameState = nameChangeSystem.getState?.() || {};
                const nextNameState = {
                    ...oldNameState,
                    enabled: sharedCfg.nameChange.enabled !== false,
                    channelId: String(sharedCfg.channels?.nameChangePanel || oldNameState.channelId || ''),
                    title: String(sharedCfg.nameChange.title || oldNameState.title || 'تغيير اسمك في السيرفر'),
                    description: String(sharedCfg.nameChange.description || oldNameState.description || ''),
                    buttonLabel: String(sharedCfg.nameChange.buttonLabel || oldNameState.buttonLabel || 'تغيير اسمي'),
                    buttonEmoji: String(sharedCfg.nameChange.buttonEmoji || oldNameState.buttonEmoji || '✏️'),
                    modalTitle: String(sharedCfg.nameChange.modalTitle || oldNameState.modalTitle || 'تغيير اسمك في السيرفر'),
                    inputLabel: String(sharedCfg.nameChange.inputLabel || oldNameState.inputLabel || 'ضع الاسم الجديد'),
                    inputPlaceholder: String(sharedCfg.nameChange.inputPlaceholder || oldNameState.inputPlaceholder || ''),
                    successMessage: String(sharedCfg.nameChange.successMessage || oldNameState.successMessage || '✅ تم تغيير اسمك بنجاح إلى **{name}**.'),
                    cooldownSeconds: Number(sharedCfg.nameChange.cooldownSeconds ?? oldNameState.cooldownSeconds ?? 30),
                    color: Number.isFinite(parsedColor) ? parsedColor : (oldNameState.color || 0x8B5CF6),
                    bannerUrl: String(sharedCfg.nameChange.bannerUrl || '')
                };
                const oldComparable = { ...oldNameState }; delete oldComparable.updatedAt;
                const nextComparable = { ...nextNameState }; delete nextComparable.updatedAt;
                if (JSON.stringify(oldComparable) !== JSON.stringify(nextComparable)) {
                    nameChangeSystem.savePanel(nextNameState);
                    if (client?.isReady?.()) await nameChangeSystem.refreshPanel().catch(() => {});
                }
            }
        } catch (legacyDataSyncError) {
            console.warn('⚠️ تعذر مزامنة متجر/بنك/تغيير الاسم القديم:', legacyDataSyncError?.message || legacyDataSyncError);
        }
        await syncHomeLiveDashboardData(guildId);
        return sharedCfg;
    } catch (error) {
        console.warn('⚠️ تعذر مزامنة إعدادات ألعاب السيرفر الأساسي من Dashboard:', error?.message || error);
        return homeSharedGameConfig;
    }
}

function homeGameEnabled(type) {
    return homeSharedGameConfig?.games?.enabled?.[String(type)] !== false;
}
function homeCanStartGames(member) {
    if (member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
    const ids = Array.isArray(homeSharedGameConfig?.games?.startRoleIds) ? homeSharedGameConfig.games.startRoleIds : [];
    if (!ids.length) return false;
    return ids.some(id => member?.roles?.cache?.has(String(id)));
}

function looksLikeZombiTextCommand(text) {
    const v = String(text || '').trim();
    if (!v) return false;
    if (/^[-#!]/.test(v)) return true;
    return /^(لوحة|بنك|نهب|راتب|رصيد|تحويل|سحب|ايداع|إيداع|زوم|zom|bank|عصابة|gang|مهمة|متجر|store)(?:\s|$)/i.test(v);
}

async function maybeHomePremiumPromo(target) {
    try {
        if (!target?.guild || String(target.guild.id) !== String(ALLOWED_GUILD_ID || '')) return;
        const cfg = await syncHomePublicGameSettings(false);
        const site = homeSharedSiteConfig || await publicSharedStore.getGlobalConfig();
        if (!cfg || publicSharedStore.isPremium(cfg) || site?.premiumPromo?.enabled === false) return;
        const userId = String(target.user?.id || target.author?.id || '');
        if (!userId) return;
        const chance = Math.max(0, Math.min(100, Number(site?.premiumPromo?.chancePercent ?? 40)));
        if (chance <= 0 || Math.random() * 100 > chance) return;
        const key = `${target.guild.id}:${userId}`;
        const now = Date.now();
        const cooldown = Math.max(1, Number(site?.premiumPromo?.cooldownMinutes || 10)) * 60000;
        if (now - Number(homePremiumPromoSeen.get(key) || 0) < cooldown) return;
        homePremiumPromoSeen.set(key, now);
        const text = String(site?.premiumPromo?.text || '💎 اشترك في ZOMBI Premium وافتح مميزات وألعاب أكثر.').slice(0, 500);
        const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
        const components = base ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💎 Premium').setURL(`${base}/premium`))] : [];
        const timer = setTimeout(async () => {
            try {
                if (target.isChatInputCommand?.()) {
                    const payload = { content: text, components, flags: 64 };
                    if (target.replied || target.deferred) await target.followUp(payload);
                    else await target.reply(payload);
                } else if (target.reply) {
                    const msg = await target.reply({ content: text, components, allowedMentions: { repliedUser: false } });
                    const del = setTimeout(() => msg?.delete?.().catch(() => {}), 15000); del.unref?.();
                }
            } catch {}
        }, 1200);
        timer.unref?.();
    } catch {}
}

// ==========================================================
// FILES
// ==========================================================

const ECONOMY_FILE =
    path.join(
        __dirname,
        'economy.json'
    );

const SHOP_FILE =
    path.join(
        __dirname,
        'shop.json'
    );

// ==========================================================
// DATA
// ==========================================================

let economy = {};

let shopProducts = {};

let homeEconomySnapshotHash = '';
let homeGangSnapshotHash = '';

function dashboardApplyAmount(current, action, amount) {
    const value = Math.max(0, Math.round(Number(current) || 0));
    const delta = Math.max(0, Math.round(Number(amount) || 0));
    if (action === 'add') return value + delta;
    if (action === 'remove') return Math.max(0, value - delta);
    return delta;
}

function readJsonFileSafe(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw.trim() ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

async function consumeHomeEconomyAdminOps(guildId) {
    const raw = await publicSharedStore.data(guildId, 'home-economy-admin-ops.json', []);
    const pending = Array.isArray(raw) ? raw.filter(item => !item?.appliedAt) : [];
    if (!pending.length) return false;

    let economyChanged = false;
    let bankChanged = false;
    const retry = [];
    for (const op of pending) {
        try {
            const userId = String(op?.userId || '');
            if (!/^\d{15,25}$/.test(userId)) continue;
            const action = ['set', 'add', 'remove'].includes(String(op?.action)) ? String(op.action) : 'set';
            const amount = Math.max(0, Math.round(Number(op?.amount) || 0));
            if (String(op?.account) === 'bank') {
                const bankUser = getBankUser(userId);
                bankUser.bank = dashboardApplyAmount(bankUser.bank, action, amount);
                bankChanged = true;
            } else {
                const walletUser = getUser(userId);
                walletUser.balance = dashboardApplyAmount(walletUser.balance, action, amount);
                economyChanged = true;
            }
        } catch (error) {
            retry.push({ ...op, lastError: String(error?.message || error).slice(0, 200) });
        }
    }
    if (economyChanged) saveEconomy();
    if (bankChanged) saveBank();
    await publicSharedStore.saveData(guildId, 'home-economy-admin-ops.json', retry.slice(-50));
    return economyChanged || bankChanged;
}

async function publishHomeEconomySnapshot(guildId) {
    const bankRaw = readJsonFileSafe(path.join(__dirname, 'bank', 'data', 'bank.json'), {});
    const levelsRaw = readJsonFileSafe(path.join(__dirname, 'levels', 'data', 'levels.json'), {});
    const ids = new Set([
        ...Object.keys(economy || {}),
        ...Object.keys(bankRaw || {}),
        ...Object.keys(levelsRaw || {})
    ]);
    const snapshot = {};
    for (const userId of ids) {
        const wallet = economy?.[userId] || {};
        const bankUser = bankRaw?.[userId] || {};
        const levelUser = levelsRaw?.[userId] || {};
        snapshot[userId] = {
            ...wallet,
            balance: Number(wallet.balance || 0),
            bankBalance: Number(bankUser.bank || 0),
            xp: Number(levelUser.xp || 0),
            level: Number(levelUser.level || 0)
        };
    }
    const hash = JSON.stringify(snapshot);
    if (hash === homeEconomySnapshotHash) return false;
    await publicSharedStore.saveData(guildId, 'economy.json', snapshot);
    homeEconomySnapshotHash = hash;
    return true;
}

async function consumeHomeGangAdminOps(guildId) {
    const raw = await publicSharedStore.data(guildId, 'home-gang-admin-ops.json', []);
    const pending = Array.isArray(raw) ? raw.filter(item => !item?.appliedAt) : [];
    if (!pending.length) return false;
    const retry = [];
    let changed = false;
    const guild = client?.guilds?.cache?.get(guildId) || null;
    for (const op of pending) {
        try {
            const gangId = String(op?.gangId || '');
            const gang = gangSystem.getGangById?.(gangId) || null;
            if (op?.action === 'delete') {
                if (gang) await gangSystem.dashboardDeleteGang?.(guild, gangId);
                changed = true;
                continue;
            }
            if (!gang) continue;
            if (op?.action === 'bank') {
                gang.vault = Math.max(0, Math.round(Number(op?.amount) || 0));
                changed = true;
            } else if (op?.action === 'reset-mission') {
                gang.lastMissionAt = 0;
                changed = true;
            }
        } catch (error) {
            retry.push({ ...op, lastError: String(error?.message || error).slice(0, 200) });
        }
    }
    if (changed) gangSystem.saveGangs?.();
    await publicSharedStore.saveData(guildId, 'home-gang-admin-ops.json', retry.slice(-50));
    return changed;
}

async function publishHomeGangSnapshot(guildId) {
    const gangs = {};
    const membership = {};
    for (const gang of gangSystem.getAllGangs?.() || []) {
        const members = Array.isArray(gang.memberIds) ? gang.memberIds.map(String) : [];
        const deputies = Array.isArray(gang.deputyIds) ? gang.deputyIds.map(String) : [];
        gangs[String(gang.id)] = {
            id: String(gang.id),
            name: String(gang.name || 'Gang'),
            leaderId: String(gang.bossId || ''),
            bossId: String(gang.bossId || ''),
            deputies,
            deputyIds: deputies,
            members,
            memberIds: members,
            bank: Number(gang.vault || 0),
            vault: Number(gang.vault || 0),
            reputation: Number(gang.reputation || 0),
            level: Number(gang.level || 1),
            roleId: String(gang.roleId || ''),
            channelId: String(gang.channelId || ''),
            lastMissionAt: Number(gang.lastMissionAt || 0),
            activeMission: gang.activeMission || null,
            missionsCompleted: Number(gang.stats?.missionsWon || 0),
            missionsFailed: Number(gang.stats?.missionsFailed || 0),
            robberiesWon: Number(gang.stats?.robberiesWon || 0),
            robberiesFailed: Number(gang.stats?.robberiesFailed || 0)
        };
        for (const userId of members) membership[userId] = String(gang.id);
    }
    const snapshot = { gangs, membership, source: 'legacy-home', updatedAt: Date.now() };
    const comparable = { gangs, membership, source: 'legacy-home' };
    const hash = JSON.stringify(comparable);
    if (hash === homeGangSnapshotHash) return false;
    await publicSharedStore.saveData(guildId, 'gangs-public.json', snapshot);
    homeGangSnapshotHash = hash;
    return true;
}

async function syncHomeLiveDashboardData(guildId) {
    try {
        await consumeHomeEconomyAdminOps(guildId);
        await consumeHomeGangAdminOps(guildId);
        await publishHomeEconomySnapshot(guildId);
        await publishHomeGangSnapshot(guildId);
    } catch (error) {
        console.warn('⚠️ تعذر مزامنة بيانات السيرفر الأساسي الحية مع Dashboard:', error?.message || error);
    }
}

// ==========================================================
// ACTIVE GAMES
// ==========================================================

const activeGames =
    new Map();

const rpsGames =
    new Map();

const wheelGames =
    new Map();

const mafiaGames =
    new Map();

const rouletteGames =
    new Map();

// ==========================================================
// COOLDOWNS
// ==========================================================

const messageCooldowns =
    new Map();

const transferCooldowns =
    new Map();

const voiceRewardSessions =
    new Map();


// ==========================================================
// 🎙️ VOICE REWARD CHANNEL DETECTION
// أي روم صوتي في السيرفر يعطي نقاط تلقائيًا
// ==========================================================

function isRewardVoiceChannel(channel) {
    return Boolean(
        channel &&
        channel.isVoiceBased?.()
    );
}

// ==========================================================
// CLIENT
// ==========================================================

const client =
    new Client({

        partials: [require("discord.js").Partials.Message, require("discord.js").Partials.Channel],
        intents: [

            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildModeration,

            GatewayIntentBits.GuildMembers,

            GatewayIntentBits.GuildMessages,

            GatewayIntentBits.MessageContent,

            GatewayIntentBits.GuildVoiceStates,

            GatewayIntentBits.DirectMessages

        ]

    });

// ==========================================================
// PUBLIC MULTI-SERVER CORE
// ==========================================================

require('./public/operations').install(client);
require('./public/serverLogs').install(client);

publicSystem.init(client, {
    getHomeGuildId: () => ALLOWED_GUILD_ID
});

// ==========================================================
// INIT SYSTEMS
// ==========================================================

initVoiceRooms(
    client
);

initLevels(
    client
);

initBank(
    client,
    {
        bankChannelId:
            process.env.BANK_CHANNEL_ID
    }
);

gangSystem.initGangSystem(
    client,
    {
        getConfig: () => dashboardConfig,
        getBankUser,
        saveBank
    }
);

bankRobbery.initBankRobbery(
    client,
    {
        getConfig: () => dashboardConfig,
        gangSystem,
        getBankUser,
        saveBank,
        onAvailabilityChange:
            setRobberyAvailability
    }
);

ticketSystem.init(client, {
    getGuildId: () => dashboardConfig.discord.allowedGuildId
});

rolePanel.initRolePanel(client, {
    getConfig: () => dashboardConfig
});

nameChangeSystem.init(client, {
    getGuildId: () => dashboardConfig.discord.allowedGuildId
});

zomStore.initZomStore(client, {
    getConfig: () => dashboardConfig,
    getEconomy: () => economy,
    getUser,
    saveEconomy,
    getShop: () => shopProducts,
    saveShop
});

citySystemsInitialized = true;

// ==========================================================
// HELPERS
// ==========================================================

function sleep(
    ms
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}

// ==========================================================
// ⏱️ GLOBAL GAME ROUND TIMEOUT - 25 SECONDS
// ==========================================================

const GAME_ROUND_TIMEOUT_SECONDS = 25;
const GAME_ROUND_TIMEOUT_MS =
    GAME_ROUND_TIMEOUT_SECONDS * 1000;

function getGameRule(type) {
    const settings = dashboardConfig?.games?.quickGameSettings?.[type] || {};
    return {
        rounds: Math.max(1, Math.min(25, Number(settings.rounds || dashboardConfig?.games?.quickRounds || 5))),
        roundTimeSeconds: Math.max(5, Math.min(180, Number(settings.roundTimeSeconds || GAME_ROUND_TIMEOUT_SECONDS))),
        winnerReward: Math.max(0, Number(settings.winnerReward ?? 300))
    };
}

function gameRoundSeconds(game) {
    return Math.max(5, Number(game?.roundTimeSeconds || GAME_ROUND_TIMEOUT_SECONDS));
}

function clearQuickGameRoundTimer(
    game
) {

    if (
        game?.roundTimer
    ) {

        clearTimeout(
            game.roundTimer
        );

        game.roundTimer =
            null;

    }

}

function getQuickGameTimeoutAnswer(
    game
) {

    if (
        game.type === 'guess' ||
        game.type === 'closest'
    ) {

        return game.number != null
            ? String(game.number)
            : null;

    }

    return game.answer != null
        ? String(game.answer)
        : null;

}

function armQuickGameRoundTimer(
    guild,
    game
) {

    clearQuickGameRoundTimer(
        game
    );

    const roundNumber =
        game.round;

    game.roundTimer =
        setTimeout(
            async () => {

                const current =
                    activeGames.get(
                        guild.id
                    );

                if (
                    current !== game ||
                    current.resolving ||
                    current.round !== roundNumber
                ) {

                    return;

                }

                current.resolving =
                    true;

                current.roundTimer =
                    null;

                const channel =
                    guild.channels.cache.get(
                        current.channelId
                    );

                let winnerId =
                    null;

                let timeoutText =
                    `⏰ انتهت مهلة **${gameRoundSeconds(current)} ثانية** بدون إجابة صحيحة.`;

                // في لعبة الأقرب: إذا شارك لاعب أو أكثر قبل انتهاء الوقت،
                // يفوز الأقرب من المشاركين بدل ضياع مشاركتهم.
                if (
                    current.type === 'closest' &&
                    Array.isArray(current.answers) &&
                    current.answers.length > 0
                ) {

                    const winner =
                        [
                            ...current.answers
                        ].sort(
                            (a, b) =>
                                Math.abs(
                                    a.number - current.number
                                )
                                -
                                Math.abs(
                                    b.number - current.number
                                )
                        )[0];

                    winnerId =
                        winner.userId;

                    timeoutText =
                        `⏰ انتهت مهلة **${gameRoundSeconds(current)} ثانية**.\n` +
                        `🎯 الرقم كان **${current.number}**، والأقرب من المشاركين هو <@${winner.userId}> بإجابة **${winner.number}**.`;

                } else {

                    const answer =
                        getQuickGameTimeoutAnswer(
                            current
                        );

                    if (
                        answer
                    ) {

                        timeoutText +=
                            `\n✅ الإجابة: **${answer}**`;

                    }

                }

                if (
                    channel
                ) {

                    await channel.send(
                        timeoutText +
                        '\n➡️ الانتقال للجولة التالية...'
                    ).catch(
                        () => {}
                    );

                }

                await nextGameRound(
                    guild,
                    winnerId
                ).catch(
                    error =>
                        console.error(
                            '❌ خطأ في مؤقت الجولة:',
                            error
                        )
                );

            },
            gameRoundSeconds(game) * 1000
        );

}

// ==========================================================
// RANDOM ITEM
// ==========================================================

function randomItem(
    array
) {

    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];

}

// ==========================================================
// SHUFFLE ARRAY
// ==========================================================

function shuffleArray(
    array
) {

    const cloned =
        [
            ...array
        ];

    for (
        let i =
            cloned.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            cloned[i],
            cloned[j]
        ] =
        [
            cloned[j],
            cloned[i]
        ];

    }

    return cloned;

}

// ==========================================================
// FORMAT ZOM
// ==========================================================

function formatZom(
    number
) {

    return Number(
        number || 0
    )
        .toLocaleString(
            'en-US'
        );

}

// ==========================================================
// FORMAT DURATION
// ==========================================================

function formatDuration(
    ms
) {

    const totalSeconds =
        Math.max(
            0,
            Math.ceil(
                ms /
                1000
            )
        );

    const days =
        Math.floor(
            totalSeconds /
            86400
        );

    const hours =
        Math.floor(
            (
                totalSeconds %
                86400
            ) /
            3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );

    const seconds =
        totalSeconds %
        60;

    const parts = [];

    if (
        days
    ) {

        parts.push(
            `${days} يوم`
        );

    }

    if (
        hours
    ) {

        parts.push(
            `${hours} ساعة`
        );

    }

    if (
        minutes
    ) {

        parts.push(
            `${minutes} دقيقة`
        );

    }

    if (
        !parts.length ||
        seconds
    ) {

        parts.push(
            `${seconds} ثانية`
        );

    }

    return parts
        .slice(
            0,
            2
        )
        .join(
            ' و '
        );

}

// ==========================================================
// NORMALIZE ANSWER
// ==========================================================

function normalizeAnswer(
    text
) {

    return String(
        text || ''
    )
        .trim()
        .toLowerCase()

        .replace(
            /[أإآ]/g,
            'ا'
        )

        .replace(
            /ة/g,
            'ه'
        )

        .replace(
            /ى/g,
            'ي'
        )

        .replace(
            /[ًٌٍَُِّْـ]/g,
            ''
        )

        .replace(
            /\s+/g,
            ' '
        );

}

// ==========================================================
// CLEAN PRODUCT NAME
// ==========================================================

function cleanProductName(
    name
) {

    return String(
        name || ''
    )

        .replace(
            /[^\p{L}\p{N}\s\-_]/gu,
            ''
        )

        .trim()

        .substring(
            0,
            60
        ) ||

        'منتج';

}

// ==========================================================
// PRODUCT ID
// ==========================================================

function createProductId() {

    return (
        `product_${Date.now()}_` +
        Math.floor(
            Math.random() *
            9999
        )
    );

}

// ==========================================================
// ALLOWED GUILD
// ==========================================================

function isAllowedGuild(
    guild
) {

    return Boolean(

        guild &&

        guild.id ===
        ALLOWED_GUILD_ID

    );

}

// ==========================================================
// ADMIN CHECK
// ==========================================================

function isAdmin(
    member
) {

    return Boolean(

        member
            ?.permissions
            ?.has(
                PermissionFlagsBits
                    .Administrator
            )

        ||

        member
            ?.permissions
            ?.has(
                PermissionFlagsBits
                    .ManageGuild
            )

    );

}

// ==========================================================
// USER DATA STRUCTURE
// ==========================================================

function ensureUserShape(
    user = {}
) {

    return {

        balance:
            Number(
                user.balance ||
                0
            ),

        messageCount:
            Number(
                user.messageCount ||
                0
            ),

        lastSalary:
            Number(
                user.lastSalary ||
                0
            ),

        lastDaily:
            Number(
                user.lastDaily ||
                0
            ),

        lastVoiceReward:
            Number(
                user.lastVoiceReward ||
                0
            ),

        voiceTime:
            Number(
                user.voiceTime ||
                0
            ),

        purchases:
            Array.isArray(
                user.purchases
            )
                ?
                user.purchases
                :
                []

    };

}

// ==========================================================
// GET USER
// ==========================================================

function getUser(
    userId
) {

    economy[
        userId
    ] =
        ensureUserShape(
            economy[
                userId
            ]
        );

    return economy[
        userId
    ];

}

// ==========================================================
// SAFE JSON WRITE
// ==========================================================

function safeWriteJson(
    filePath,
    data
) {

    const tempPath =
        `${filePath}.tmp`;

    try {

        fs.writeFileSync(

            tempPath,

            JSON.stringify(
                data,
                null,
                4
            ),

            'utf8'

        );

        try {

            fs.renameSync(
                tempPath,
                filePath
            );

        } catch {

            fs.writeFileSync(

                filePath,

                JSON.stringify(
                    data,
                    null,
                    4
                ),

                'utf8'

            );

            if (
                fs.existsSync(
                    tempPath
                )
            ) {

                fs.unlinkSync(
                    tempPath
                );

            }

        }

        return true;

    } catch (
        error
    ) {

        console.error(
            `❌ فشل حفظ ${path.basename(filePath)}:`,
            error
        );

        return false;

    }

}

// ==========================================================
// SAVE ECONOMY
// ==========================================================

function saveEconomy() {

    safeWriteJson(
        ECONOMY_FILE,
        economy
    );

}

// ==========================================================
// LOAD ECONOMY
// ==========================================================

function loadEconomy() {

    try {

        if (
            !fs.existsSync(
                ECONOMY_FILE
            )
        ) {

            economy = {};

            saveEconomy();

            return;

        }

        const parsed =
            JSON.parse(

                fs.readFileSync(
                    ECONOMY_FILE,
                    'utf8'
                )

            );

        economy = {};

        for (
            const [
                userId,
                data
            ]
            of
            Object.entries(
                parsed || {}
            )
        ) {

            economy[
                userId
            ] =
                ensureUserShape(
                    data
                );

        }

    } catch (
        error
    ) {

        console.error(
            '❌ خطأ بتحميل الاقتصاد:',
            error
        );

        economy = {};

    }

}

// ==========================================================
// SAVE SHOP
// ==========================================================

function saveShop() {

    safeWriteJson(
        SHOP_FILE,
        shopProducts
    );

}

// ==========================================================
// LOAD SHOP
// ==========================================================

function loadShop() {

    try {

        if (
            !fs.existsSync(
                SHOP_FILE
            )
        ) {

            shopProducts =
                {};

            saveShop();

            return;

        }

        shopProducts =
            JSON.parse(

                fs.readFileSync(
                    SHOP_FILE,
                    'utf8'
                )

            ) || {};

    } catch (
        error
    ) {

        console.error(
            '❌ خطأ بتحميل المتجر:',
            error
        );

        shopProducts =
            {};

    }

}

// ==========================================================
// ADD ZOM
// ==========================================================

function addZom(
    userId,
    amount
) {

    const user =
        getUser(
            userId
        );

    user.balance +=
        Number(
            amount || 0
        );

    saveEconomy();

}

// ==========================================================
// REGISTER GAME
// ==========================================================

function registerGame(
    guildId,
    game
) {

    activeGames.set(
        guildId,
        game
    );

}

// ==========================================================
// UNREGISTER GAME
// ==========================================================

function unregisterGame(
    guildId
) {

    const game =
        activeGames.get(
            guildId
        );

    clearQuickGameRoundTimer(
        game
    );

    activeGames.delete(
        guildId
    );

}

// ==========================================================
// SAFE INTERACTION REPLY
// ==========================================================

async function safeReply(
    interaction,
    payload
) {

    try {

        if (
            interaction.deferred ||
            interaction.replied
        ) {

            return await interaction.followUp(
                payload
            );

        }

        return await interaction.reply(
            payload
        );

    } catch (
        error
    ) {

        console.error(
            '❌ فشل إرسال الرد:',
            error
        );

        return null;

    }

}

// ==========================================================
// LOAD DATA
// ==========================================================

loadEconomy();

loadShop();

// ==========================================================
// WEBSITE DISABLED ON LUNAFY
// الموقع يعمل على استضافة منفصلة؛ هذه العملية للبوت فقط.
// ==========================================================

// ==========================================================
// SLASH COMMANDS
// ==========================================================

const commands = [

    new SlashCommandBuilder()

        .setName(
            'balance'
        )

        .setDescription(
            'عرض رصيدك أو رصيد مستخدم آخر'
        )

        .addUserOption(
            option =>
                option

                    .setName(
                        'user'
                    )

                    .setDescription(
                        'المستخدم'
                    )

                    .setRequired(
                        false
                    )
        ),

    new SlashCommandBuilder()

        .setName(
            'daily'
        )

        .setDescription(
            'استلام المكافأة اليومية'
        ),

    new SlashCommandBuilder()

        .setName(
            'pay'
        )

        .setDescription(
            'تحويل ZOM إلى مستخدم'
        )

        .addUserOption(
            option =>
                option

                    .setName(
                        'user'
                    )

                    .setDescription(
                        'المستخدم'
                    )

                    .setRequired(
                        true
                    )
        )

        .addIntegerOption(
            option =>
                option

                    .setName(
                        'amount'
                    )

                    .setDescription(
                        'المبلغ'
                    )

                    .setMinValue(
                        1
                    )

                    .setRequired(
                        true
                    )
        ),

    new SlashCommandBuilder()

        .setName(
            'rank'
        )

        .setDescription(
            'عرض ترتيبك'
        ),

    new SlashCommandBuilder()

        .setName(
            'leaderboard'
        )

        .setDescription(
            'عرض قائمة الأغنى'
        ),

    new SlashCommandBuilder()

        .setName(
            'inventory'
        )

        .setDescription(
            'عرض مشترياتك'
        ),

    new SlashCommandBuilder()

        .setName(
            'store'
        )

        .setDescription(
            'فتح متجر ZOM'
        ),

    new SlashCommandBuilder()

        .setName(
            'profile'
        )

        .setDescription(
            'عرض ملفك الاقتصادي'
        )

        .addUserOption(
            option =>
                option

                    .setName(
                        'user'
                    )

                    .setDescription(
                        'المستخدم'
                    )

                    .setRequired(
                        false
                    )
        ),

    new SlashCommandBuilder()

        .setName(
            'ping'
        )

        .setDescription(
            'عرض سرعة استجابة البوت'
        ),

    new SlashCommandBuilder()

        .setName(
            'help'
        )

        .setDescription(
            'عرض قائمة أوامر ZOM'
        ),
    new SlashCommandBuilder()
        .setName('games')
        .setDescription('ألعاب ZOM')
        .addStringOption(option =>
            option
                .setName('game')
                .setDescription('اختر اللعبة')
                .setRequired(false)
                .addChoices(
                    { name: 'Quiz | أسئلة', value: 'quiz' },
                    { name: 'Guess | تخمين', value: 'guess' },
                    { name: 'Speed | سرعة', value: 'speed' },
                    { name: 'Scramble | ترتيب', value: 'scramble' },
                    { name: 'Math | حساب', value: 'math' },
                    { name: 'True / False | صح وخطأ', value: 'truefalse' },
                    { name: 'Closest | الأقرب', value: 'closest' },
                    { name: 'Word | الكلمة', value: 'word' },
                    { name: 'RPS | حجر ورق مقص', value: 'rps' },
                    { name: 'Wheel | عجلة الحظ', value: 'wheel' },
                    { name: 'Daily Game | اليومي', value: 'daily' },
                    { name: 'Mafia | مافيا', value: 'mafia' },
                    { name: 'Roulette | روليت', value: 'roulette' },
                    { name: 'Chairs | كراسي', value: 'chairs' },
                    { name: 'Killer | من القاتل', value: 'killer' }
                )
        ),

    new SlashCommandBuilder()
        .setName('admin')
        .setDescription('أوامر الإدارة')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // ==================================================
        // 🎮 لوحة الألعاب
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('games')
                .setDescription('فتح لوحة الألعاب')
        )

        // ==================================================
        // 🧹 حذف الرسائل
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('clear')
                .setDescription('حذف الرسائل')
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('عدد الرسائل')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )

        // ==================================================
        // 👢 Kick
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('kick')
                .setDescription('طرد عضو')

                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('سبب الطرد')
                        .setRequired(false)
                )
        )

        // ==================================================
        // 🔨 Ban
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('ban')
                .setDescription('حظر عضو')

                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('سبب الحظر')
                        .setRequired(false)
                )
        )

        // ==================================================
        // 🔒 Lock
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('lock')
                .setDescription('قفل القناة')
        )

        // ==================================================
        // 🔓 Unlock
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('unlock')
                .setDescription('فتح القناة')
        )

        // ==================================================
        // 🛒 إضافة رتبة للمتجر
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('addrole')
                .setDescription('إضافة رتبة للمتجر')

                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('الرتبة')
                        .setRequired(true)
                )

                .addIntegerOption(option =>
                    option
                        .setName('price')
                        .setDescription('السعر')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // ==================================================
        // 🗑️ حذف رتبة
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('removerole')
                .setDescription('حذف رتبة من المتجر')

                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('الرتبة')
                        .setRequired(true)
                )
        )

        // ==================================================
        // 💰 تعديل السعر
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('setprice')
                .setDescription('تعديل سعر رتبة')

                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('الرتبة')
                        .setRequired(true)
                )

                .addIntegerOption(option =>
                    option
                        .setName('price')
                        .setDescription('السعر الجديد')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // ==================================================
        // ➕ إضافة ZOM
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('addzom')
                .setDescription('إضافة ZOM لعضو')

                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(true)
                )

                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('الكمية')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // ==================================================
        // ➖ خصم ZOM
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('removezom')
                .setDescription('خصم ZOM من عضو')

                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(true)
                )

                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('الكمية')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        // ==================================================
        // 🔄 تصفير ZOM
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('resetzom')
                .setDescription('تصفير ZOM لعضو')

                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(true)
                )
        )

        // ==================================================
        // 🛑 إيقاف الألعاب
        // ==================================================

        .addSubcommand(sub =>
            sub
                .setName('stopgame')
                .setDescription(
                    'إيقاف الألعاب النشطة في السيرفر'
                )
        )

].map(
    command =>
        command.toJSON()
);

// ==========================================================
// 🎮 GAME PANEL
// ==========================================================

function createGamesPanel() {

    const embed =
        new EmbedBuilder()

            .setTitle(
                '🎮 ألعاب ZOM'
            )

            .setDescription(
                'اختر اللعبة التي تريد تشغيلها.\n\n' +

                '🎯 وقت الجولة وعدد الجولات والجائزة النهائية يتم تحديدها من **Dashboard** لكل لعبة.\n' +
                '⭐ فوز الجولة = **نقطة**، والجائزة تُصرف للفائز النهائي فقط.\n' +

                '🎭 المافيا والروليت لها نظام مستقل.\n' +

                '🪑 الكراسي و 🔪 من القاتل ما زالت موجودة.\n\n' +

                '🛑 لإيقاف اللعبة استخدم زر **إيقاف اللعبة** أو `#ايقاف` أو `/ايقاف`.\n' +
                '👑 المضيف والرتب المسموحة والإدارة يستطيعون الإيقاف.'
            )

            .setColor(
                0x3498DB
            )

            .setFooter({
                text:
                    'ZOM Games System'
            });

    // ======================================================
    // الصف الأول
    // ======================================================

    const row1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        'game_quiz'
                    )
                    .setLabel(
                        'أسئلة'
                    )
                    .setEmoji(
                        '🧠'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_guess'
                    )
                    .setLabel(
                        'تخمين'
                    )
                    .setEmoji(
                        '🔢'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_rps'
                    )
                    .setLabel(
                        'حجر ورق'
                    )
                    .setEmoji(
                        '✂️'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_speed'
                    )
                    .setLabel(
                        'سرعة'
                    )
                    .setEmoji(
                        '⚡'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_scramble'
                    )
                    .setLabel(
                        'ترتيب'
                    )
                    .setEmoji(
                        '🔤'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    // ======================================================
    // الصف الثاني
    // ======================================================

    const row2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        'game_truefalse'
                    )
                    .setLabel(
                        'صح / خطأ'
                    )
                    .setEmoji(
                        '✅'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_math'
                    )
                    .setLabel(
                        'حساب'
                    )
                    .setEmoji(
                        '➗'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_closest'
                    )
                    .setLabel(
                        'الأقرب'
                    )
                    .setEmoji(
                        '🎯'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_word'
                    )
                    .setLabel(
                        'الكلمة'
                    )
                    .setEmoji(
                        '🔎'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_wheel'
                    )
                    .setLabel(
                        'عجلة الحظ'
                    )
                    .setEmoji(
                        '🎡'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    // ======================================================
    // الصف الثالث
    // ======================================================

    const row3 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        'game_daily'
                    )
                    .setLabel(
                        'اليومي'
                    )
                    .setEmoji(
                        '🏆'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_mafia'
                    )
                    .setLabel(
                        'مافيا'
                    )
                    .setEmoji(
                        '🎭'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_roulette'
                    )
                    .setLabel(
                        'روليت'
                    )
                    .setEmoji(
                        '🎰'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_chairs'
                    )
                    .setLabel(
                        'كراسي'
                    )
                    .setEmoji(
                        '🪑'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'game_killer'
                    )
                    .setLabel(
                        'من القاتل'
                    )
                    .setEmoji(
                        '🔪'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    const row4 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('game_stop')
                    .setLabel('إيقاف اللعبة')
                    .setEmoji('🛑')
                    .setStyle(ButtonStyle.Danger)
            );

    return {

        embeds: [
            embed
        ],

        components: [
            row1,
            row2,
            row3,
            row4
        ]

    };

}

// ==========================================================
// 🎮 أسماء الألعاب
// ==========================================================

function getGameName(
    type
) {

    const names = {

        quiz:
            'أسئلة',

        guess:
            'تخمين',

        rps:
            'حجر ورق مقص',

        speed:
            'سرعة',

        scramble:
            'ترتيب',

        truefalse:
            'صح أو خطأ',

        math:
            'حساب',

        closest:
            'الأقرب',

        word:
            'الكلمة',

        wheel:
            'عجلة الحظ',

        daily:
            'اليومي',

        mafia:
            'مافيا',

        roulette:
            'روليت',

        chairs:
            'الكراسي',

        killer:
            'من القاتل'

    };

    return (
        names[type] ||
        'لعبة'
    );

}

// ==========================================================
// 🎯 إنشاء جولة جديدة
// ==========================================================

function generateRound(
    type
) {

    // ======================================================
    // Quiz
    // ======================================================

    if (
        type === 'quiz'
    ) {

        const item =
            randomItem(
                gameContent().quizQuestions
            );

        return {

            question:
                item.question,

            answer:
                item.answer

        };

    }

    // ======================================================
    // True False
    // ======================================================

    if (
        type === 'truefalse'
    ) {

        const item =
            randomItem(
                gameContent().trueFalseQuestions
            );

        return {

            question:
                `${item.question}\n\n` +
                'اكتب: **صح** أو **خطأ**',

            answer:
                item.answer

        };

    }

    // ======================================================
    // Word / Scramble
    // ======================================================

    if (
        type === 'word' ||
        type === 'scramble'
    ) {

        const item =
            randomItem(
                gameContent().wordQuestions
            );

        return {

            question:
                type === 'word'
                    ?
                    'ما هي الكلمة الصحيحة؟'
                    :
                    'رتب الحروف واكتب الكلمة الصحيحة.',

            answer:
                item.answer,

            scrambled:
                item.scrambled

        };

    }

    // ======================================================
    // Guess
    // ======================================================

    if (
        type === 'guess'
    ) {

        const number =
            Math.floor(
                Math.random() *
                20
            ) + 1;

        return {

            question:
                'خمن رقمًا من 1 إلى 20',

            number

        };

    }

    // ======================================================
    // Math
    // ======================================================

    if (
        type === 'math'
    ) {

        const operations = [
            '+',
            '-',
            '×'
        ];

        const operation =
            randomItem(
                operations
            );

        let a =
            Math.floor(
                Math.random() *
                20
            ) + 1;

        let b =
            Math.floor(
                Math.random() *
                20
            ) + 1;

        let result;

        if (
            operation === '+'
        ) {

            result =
                a + b;

        }

        else if (
            operation === '-'
        ) {

            if (
                b > a
            ) {

                [
                    a,
                    b
                ] =
                [
                    b,
                    a
                ];

            }

            result =
                a - b;

        }

        else {

            a =
                Math.floor(
                    Math.random() *
                    10
                ) + 1;

            b =
                Math.floor(
                    Math.random() *
                    10
                ) + 1;

            result =
                a * b;

        }

        return {

            question:
                `كم يساوي **${a} ${operation} ${b}**؟`,

            answer:
                String(
                    result
                ),

            number:
                result

        };

    }

    // ======================================================
    // Closest
    // ======================================================

    if (
        type === 'closest'
    ) {

        const number =
            Math.floor(
                Math.random() *
                100
            ) + 1;

        return {

            question:
                'أرسل رقمًا من 1 إلى 100، ' +
                'وبعد تسجيل **3 لاعبين مختلفين** يفوز الأقرب.',

            number

        };

    }

    // ======================================================
    // Speed
    // ======================================================

    if (
        type === 'speed'
    ) {

        const answer =
            randomItem(
                gameContent().speedWords
            );

        return {

            question:
                `اكتب الكلمة التالية بسرعة: **${answer}**`,

            answer

        };

    }

    // ======================================================
    // Daily Game
    // ======================================================

    if (
        type === 'daily'
    ) {

        const item =
            randomItem(
                gameContent().dailyQuestions
            );

        return {

            question:
                item.question,

            answer:
                item.answer

        };

    }

    return null;

}

// ==========================================================
// 🎨 Embed الجولة
// ==========================================================

function createRoundEmbed(
    game
) {

    let description =
        `🎯 الجولة **${game.round}/${game.maxRounds}**\n\n`;

    if (
        game.type === 'word' ||
        game.type === 'scramble'
    ) {

        description +=
            `🔤 الحروف: **${game.scrambled}**\n\n`;

    }

    description +=
        `${game.question}\n\n` +
        `⏱️ الوقت: **${gameRoundSeconds(game)} ثانية**\n` +
        `🏆 فوز الجولة = **نقطة واحدة**\n` +
        `💰 جائزة الفائز النهائي: **${formatZom(game.finalReward)} ZOM**`;

    return new EmbedBuilder()

        .setTitle(
            `🎮 ${getGameName(game.type)}`
        )

        .setDescription(
            description
        )

        .setColor(
            0x3498DB
        )

        .setFooter({
            text:
                'اجمع أكبر عدد من النقاط للفوز بالجائزة النهائية'
        });

}

// ==========================================================
// 🎮 بدء الألعاب السريعة
// ==========================================================

async function startGame(
    interaction,
    type
) {

    const guildId =
        interaction.guild.id;

    if (
        activeGames.has(
            guildId
        )
    ) {

        await safeReply(
            interaction,
            {

                content:
                    '❌ توجد لعبة سريعة تعمل حاليًا في هذا السيرفر.',

                ephemeral:
                    true

            }
        );

        return;

    }

    const roundData =
        generateRound(
            type
        );

    if (
        !roundData
    ) {

        await safeReply(
            interaction,
            {

                content:
                    '❌ هذه اللعبة غير موجودة.',

                ephemeral:
                    true

            }
        );

        return;

    }

    const game = {

        type,

        channelId:
            interaction.channel.id,

        round:
            1,

        maxRounds:
            getGameRule(type).rounds,

        roundTimeSeconds:
            getGameRule(type).roundTimeSeconds,

        finalReward:
            getGameRule(type).winnerReward,

        scores:
            {},

        scoreReachedOrder:
            {},

        scoreSequence:
            0,

        answers:
            [],

        answeredUsers:
            new Set(),

        resolving:
            false,

        roundTimer:
            null,

        startedAt:
            Date.now(),

        ...roundData

    };

    registerGame(
        guildId,
        game
    );
    void require('./public/serverLogs').game(interaction,type);

    await interaction.reply({

        embeds: [
            createRoundEmbed(
                game
            )
        ]

    });

    armQuickGameRoundTimer(
        interaction.guild,
        game
    );

}

// ==========================================================
// 🔄 الجولة التالية
// ==========================================================

async function nextGameRound(
    guild,
    winnerId = null
) {
    const game = activeGames.get(guild.id);
    if (!game) return;

    clearQuickGameRoundTimer(game);
    game.resolving = true;

    try {
        const channel = guild.channels.cache.get(game.channelId);

        // فوز الجولة = نقطة فقط، بدون إضافة ZOM.
        if (winnerId) {
            game.scores[winnerId] = Number(game.scores[winnerId] || 0) + 1;
            game.scoreSequence = Number(game.scoreSequence || 0) + 1;
            game.scoreReachedOrder[winnerId] = game.scoreSequence;
        }

        // نهاية اللعبة: نرتب اللاعبين ثم نعطي الجائزة مرة واحدة فقط.
        if (game.round >= game.maxRounds) {
            const scores = Object.entries(game.scores || {})
                .sort((a, b) => {
                    const scoreDiff = Number(b[1]) - Number(a[1]);
                    if (scoreDiff !== 0) return scoreDiff;
                    return Number(game.scoreReachedOrder[a[0]] || 999999) - Number(game.scoreReachedOrder[b[0]] || 999999);
                });

            if (channel) {
                if (!scores.length) {
                    await channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🏁 انتهت اللعبة')
                                .setDescription(
                                    `🎮 اللعبة: **${getGameName(game.type)}**\n` +
                                    `🔄 عدد الجولات: **${game.maxRounds}**\n\n` +
                                    '❌ لم يحصل أي لاعب على نقطة، لذلك لم يتم صرف جائزة.'
                                )
                                .setColor(0x64748B)
                        ]
                    });
                } else {
                    const winnerIdFinal = scores[0][0];
                    const winnerScore = Number(scores[0][1]);
                    addZom(winnerIdFinal, game.finalReward);
                    const winner = getUser(winnerIdFinal);
                    const scoreText = scores.slice(0, 10)
                        .map(([userId, score], index) => `${index + 1}. <@${userId}> — **${score} نقطة**`)
                        .join('\n');

                    await channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🏆 النتيجة النهائية')
                                .setDescription(
                                    `🎮 اللعبة: **${getGameName(game.type)}**\n` +
                                    `🔄 عدد الجولات: **${game.maxRounds}**\n` +
                                    `⏱️ وقت الجولة: **${gameRoundSeconds(game)} ثانية**\n\n` +
                                    `🥇 **الفائز النهائي:** <@${winnerIdFinal}>\n` +
                                    `⭐ **مجموع النقاط:** ${winnerScore}\n\n` +
                                    `📊 **الترتيب:**\n${scoreText}\n\n` +
                                    `💰 **الجائزة النهائية:** ${formatZom(game.finalReward)} ZOM\n` +
                                    `💳 **رصيد الفائز:** ${formatZom(winner.balance)} ZOM`
                                )
                                .setColor(0xF59E0B)
                                .setFooter({ text: 'ZOM Games • الجائزة تُصرف مرة واحدة فقط بعد نهاية اللعبة' })
                        ]
                    });
                }
            }

            unregisterGame(guild.id);
            return;
        }

        game.round++;
        game.answers = [];
        game.answeredUsers = new Set();

        const roundData = generateRound(game.type);
        if (!roundData || !channel) {
            unregisterGame(guild.id);
            return;
        }

        Object.assign(game, roundData);
        await sleep(1200);

        await channel.send({ embeds: [createRoundEmbed(game)] });
        game.resolving = false;
        armQuickGameRoundTimer(guild, game);
    } catch (error) {
        console.error('❌ خطأ بالانتقال للجولة التالية:', error);
        unregisterGame(guild.id);
    }
}

// ==========================================================
// 🪨📄✂️ حجر ورق مقص
// ==========================================================

const rpsChoices = [

    'rock',

    'paper',

    'scissors'

];

// ==========================================================
// اسم الاختيار
// ==========================================================

function getRpsName(
    choice
) {

    const names = {

        rock:
            '🪨 حجر',

        paper:
            '📄 ورق',

        scissors:
            '✂️ مقص'

    };

    return (
        names[
            choice
        ] ||
        choice
    );

}

// ==========================================================
// تحديد الفائز
// ==========================================================

function getRpsWinner(
    player,
    bot
) {

    if (
        player === bot
    ) {

        return 'draw';

    }

    if (

        (
            player === 'rock' &&
            bot === 'scissors'
        )

        ||

        (
            player === 'paper' &&
            bot === 'rock'
        )

        ||

        (
            player === 'scissors' &&
            bot === 'paper'
        )

    ) {

        return 'player';

    }

    return 'bot';

}

// ==========================================================
// أزرار RPS
// ==========================================================

function createRpsButtons(
    disabled = false
) {

    return new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'rps_rock'
                )

                .setLabel(
                    'حجر'
                )

                .setEmoji(
                    '🪨'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

                .setDisabled(
                    disabled
                ),

            new ButtonBuilder()

                .setCustomId(
                    'rps_paper'
                )

                .setLabel(
                    'ورق'
                )

                .setEmoji(
                    '📄'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

                .setDisabled(
                    disabled
                ),

            new ButtonBuilder()

                .setCustomId(
                    'rps_scissors'
                )

                .setLabel(
                    'مقص'
                )

                .setEmoji(
                    '✂️'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

                .setDisabled(
                    disabled
                )

        );

}

// ==========================================================
// ⏱️ مؤقت جولات RPS
// ==========================================================

function clearRpsRoundTimer(
    game
) {

    if (
        game?.roundTimer
    ) {

        clearTimeout(
            game.roundTimer
        );

        game.roundTimer =
            null;

    }

}

function getRpsFinalText(
    game
) {

    if (
        game.playerScore >
        game.botScore
    ) {

        if (
            game.playerId
        ) {

            addZom(
                game.playerId,
                game.finalReward
            );

            return (
                `🏆 <@${game.playerId}> هو الفائز!\n` +
                `💰 ربح **${formatZom(game.finalReward)} ZOM**`
            );

        }

        return '🏆 اللاعب فاز بالمباراة.';

    }

    if (
        game.botScore >
        game.playerScore
    ) {

        return '🤖 البوت فاز بالمباراة.';

    }

    return '🤝 انتهت المباراة بالتعادل.';

}

function armRpsRoundTimer(
    guild,
    game
) {

    clearRpsRoundTimer(
        game
    );

    const roundNumber =
        game.round;

    game.roundTimer =
        setTimeout(
            async () => {

                const current =
                    rpsGames.get(
                        guild.id
                    );

                if (
                    current !== game ||
                    current.resolving ||
                    current.round !== roundNumber
                ) {

                    return;

                }

                current.resolving =
                    true;

                current.roundTimer =
                    null;

                const channel =
                    guild.channels.cache.get(
                        current.channelId
                    );

                const message =
                    channel && current.messageId
                        ? await channel.messages.fetch(
                            current.messageId
                        ).catch(
                            () => null
                        )
                        : null;

                if (
                    !message
                ) {

                    rpsGames.delete(
                        guild.id
                    );

                    return;

                }

                if (
                    current.round >=
                    current.maxRounds
                ) {

                    const winnerText =
                        getRpsFinalText(
                            current
                        );

                    rpsGames.delete(
                        guild.id
                    );

                    await message.edit({

                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    '🏁 نهاية حجر ورق مقص'
                                )
                                .setDescription(
                                    `⏰ انتهت مهلة **${gameRoundSeconds(current)} ثانية** بدون اختيار.\n\n` +
                                    '📊 النتيجة النهائية:\n' +
                                    `🧑 **${current.playerScore}** - **${current.botScore}** 🤖\n\n` +
                                    winnerText
                                )
                                .setColor(
                                    0x2ECC71
                                )
                        ],

                        components:
                            []

                    }).catch(
                        () => {}
                    );

                    return;

                }

                current.round++;

                await message.edit({

                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                '🪨📄✂️ حجر ورق مقص'
                            )
                            .setDescription(
                                `⏰ انتهت مهلة **${gameRoundSeconds(current)} ثانية** بدون اختيار.\n` +
                                'لم تُحتسب نقطة لأي طرف.\n\n' +
                                `📊 النتيجة: **${current.playerScore} - ${current.botScore}**\n\n` +
                                `🎯 الجولة القادمة: **${current.round}/${current.maxRounds}**\n` +
                                `⏱️ لديك **${gameRoundSeconds(current)} ثانية** للاختيار.`
                            )
                            .setColor(
                                0x3498DB
                            )
                    ],

                    components: [
                        createRpsButtons()
                    ]

                }).catch(
                    () => {}
                );

                current.resolving =
                    false;

                armRpsRoundTimer(
                    guild,
                    current
                );

            },
            gameRoundSeconds(game) * 1000
        );

}

// ==========================================================
// بدء RPS
// ==========================================================

async function startRpsGame(
    interaction
) {

    const guildId =
        interaction.guild.id;

    if (
        rpsGames.has(
            guildId
        )
    ) {

        await interaction.reply({

            content:
                '❌ توجد لعبة حجر ورق مقص بالفعل.',

            ephemeral:
                true

        });

        return;

    }

    void require('./public/serverLogs').game(interaction,'حجر ورق مقص','فتح لعبة');
    rpsGames.set(
        guildId,
        {

            playerId:
                null,

            channelId:
                interaction.channel.id,

            round:
                1,

            maxRounds:
                getGameRule('rps').rounds,

            roundTimeSeconds:
                getGameRule('rps').roundTimeSeconds,

            finalReward:
                getGameRule('rps').winnerReward,

            playerScore:
                0,

            botScore:
                0,

            resolving:
                false,

            roundTimer:
                null,

            messageId:
                null

        }
    );

    await interaction.reply({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🪨📄✂️ حجر ورق مقص'
                )

                .setDescription(
                    'اختر حركتك للجولة الأولى.\n\n' +
                    '👤 أول شخص يضغط أحد الخيارات يصبح لاعب المباراة.\n' +
                    `⏱️ لديك **${getGameRule('rps').roundTimeSeconds} ثانية** للاختيار.`
                )

                .setColor(
                    0x3498DB
                )

        ],

        components: [
            createRpsButtons()
        ]

    });

    const game =
        rpsGames.get(
            guildId
        );

    const replyMessage =
        await interaction.fetchReply()
            .catch(
                () => null
            );

    if (
        game &&
        replyMessage
    ) {

        game.messageId =
            replyMessage.id;

        armRpsRoundTimer(
            interaction.guild,
            game
        );

    }

}

// ==========================================================
// معالجة RPS
// ==========================================================

async function handleRpsButton(
    interaction
) {

    const game =
        rpsGames.get(
            interaction.guild.id
        );

    if (
        !game
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد لعبة حجر ورق مقص نشطة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.channelId !==
        interaction.channel.id
    ) {

        await interaction.reply({

            content:
                '❌ هذه اللعبة ليست في هذه القناة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.resolving
    ) {

        await interaction.reply({

            content:
                '⏳ يتم الانتقال للجولة التالية، حاول بعد لحظة.',

            ephemeral:
                true

        }).catch(
            () => {}
        );

        return;

    }

    // ======================================================
    // أول لاعب يضغط يصبح صاحب اللعبة
    // ======================================================

    if (

        game.playerId &&

        game.playerId !==
        interaction.user.id

    ) {

        await interaction.reply({

            content:
                '❌ هذه المباراة أصبحت مخصصة للاعب آخر.',

            ephemeral:
                true

        });

        return;

    }

    game.playerId =
        interaction.user.id;

    const playerChoice =
        interaction.customId.replace(
            'rps_',
            ''
        );

    if (
        !rpsChoices.includes(
            playerChoice
        )
    ) {

        await interaction.reply({

            content:
                '❌ اختيار غير صالح.',

            ephemeral:
                true

        });

        return;

    }

    game.resolving =
        true;

    clearRpsRoundTimer(
        game
    );

    const botChoice =
        randomItem(
            rpsChoices
        );

    const result =
        getRpsWinner(
            playerChoice,
            botChoice
        );

    if (
        result ===
        'player'
    ) {

        game.playerScore++;

    }

    if (
        result ===
        'bot'
    ) {

        game.botScore++;

    }

    let resultText;

    if (
        result ===
        'player'
    ) {

        resultText =
            '🏆 فزت بهذه الجولة!';

    }

    else if (
        result ===
        'bot'
    ) {

        resultText =
            '🤖 البوت فاز بهذه الجولة.';

    }

    else {

        resultText =
            '🤝 تعادل!';

    }

    // ======================================================
    // نهاية 5 جولات
    // ======================================================

    if (
        game.round >=
        game.maxRounds
    ) {

        let winnerText;

        if (
            game.playerScore >
            game.botScore
        ) {

            addZom(
                interaction.user.id,
                game.finalReward
            );

            winnerText =
                '🏆 أنت الفائز!\n' +
                `💰 ربحت **${formatZom(game.finalReward)} ZOM**`;

        }

        else if (
            game.botScore >
            game.playerScore
        ) {

            winnerText =
                '🤖 البوت فاز بالمباراة.';

        }

        else {

            winnerText =
                '🤝 انتهت المباراة بالتعادل.';

        }

        clearRpsRoundTimer(
            game
        );

        rpsGames.delete(
            interaction.guild.id
        );

        await interaction.update({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏁 نهاية حجر ورق مقص'
                    )

                    .setDescription(

                        `🧑 اختيارك: **${getRpsName(playerChoice)}**\n` +

                        `🤖 اختيار البوت: **${getRpsName(botChoice)}**\n\n` +

                        `${resultText}\n\n` +

                        '📊 النتيجة النهائية:\n' +

                        `🧑 **${game.playerScore}** - **${game.botScore}** 🤖\n\n` +

                        winnerText

                    )

                    .setColor(
                        0x2ECC71
                    )

            ],

            components:
                []

        });

        return;

    }

    // ======================================================
    // الجولة التالية
    // ======================================================

    game.round++;

    await interaction.update({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🪨📄✂️ حجر ورق مقص'
                )

                .setDescription(

                    `🧑 اختيارك: **${getRpsName(playerChoice)}**\n` +

                    `🤖 اختيار البوت: **${getRpsName(botChoice)}**\n\n` +

                    `${resultText}\n\n` +

                    `📊 النتيجة: **${game.playerScore} - ${game.botScore}**\n\n` +

                    `🎯 الجولة القادمة: **${game.round}/${game.maxRounds}**\n` +
                    `⏱️ لديك **${gameRoundSeconds(game)} ثانية** للاختيار.`

                )

                .setColor(
                    0x3498DB
                )

        ],

        components: [
            createRpsButtons()
        ]

    });

    game.resolving =
        false;

    armRpsRoundTimer(
        interaction.guild,
        game
    );

}

// ==========================================================
// 🎡 عجلة الحظ
// ==========================================================

function createWheelButton(
    disabled = false
) {

    return new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'wheel_spin'
                )

                .setLabel(
                    'لف العجلة'
                )

                .setEmoji(
                    '🎡'
                )

                .setStyle(
                    ButtonStyle.Success
                )

                .setDisabled(
                    disabled
                )

        );

}

// ==========================================================
// بدء عجلة الحظ
// ==========================================================

async function startWheel(
    interaction
) {

    const guildId =
        interaction.guild.id;

    if (
        wheelGames.has(
            guildId
        )
    ) {

        await interaction.reply({

            content:
                '❌ توجد عجلة حظ مفتوحة بالفعل.',

            ephemeral:
                true

        });

        return;

    }

    void require('./public/serverLogs').game(interaction,'عجلة الحظ','فتح لعبة');
    wheelGames.set(
        guildId,
        {

            channelId:
                interaction.channel.id,

            spinning:
                false,

            timeout:
                null,

            messageId:
                null,

            createdAt:
                Date.now()

        }
    );

    await interaction.reply({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🎡 عجلة الحظ'
                )

                .setDescription(

                    'اضغط **لف العجلة**.\n\n' +

                    '👤 أول شخص يضغط الزر يحصل على نتيجة العجلة.\n' +
                    `⏱️ أمامكم **${GAME_ROUND_TIMEOUT_SECONDS} ثانية** للضغط.\n` +

                    `💰 الجوائز: **${WHEEL_REWARDS.map(formatZom).join(' / ')} ZOM**`

                )

                .setColor(
                    0xF1C40F
                )

        ],

        components: [
            createWheelButton()
        ]

    });

    const game =
        wheelGames.get(
            guildId
        );

    const replyMessage =
        await interaction.fetchReply()
            .catch(
                () => null
            );

    if (
        game &&
        replyMessage
    ) {

        game.messageId =
            replyMessage.id;

        game.timeout =
            setTimeout(
                async () => {

                    const current =
                        wheelGames.get(
                            guildId
                        );

                    if (
                        current !== game ||
                        current.spinning
                    ) {

                        return;

                    }

                    wheelGames.delete(
                        guildId
                    );

                    await replyMessage.edit({

                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    '⏰ انتهى وقت عجلة الحظ'
                                )
                                .setDescription(
                                    `لم يضغط أحد خلال **${GAME_ROUND_TIMEOUT_SECONDS} ثانية**، لذلك تم إغلاق الجولة.`
                                )
                                .setColor(
                                    0x95A5A6
                                )
                        ],

                        components:
                            []

                    }).catch(
                        () => {}
                    );

                },
                GAME_ROUND_TIMEOUT_MS
            );

    }

}

// ==========================================================
// دوران عجلة الحظ
// ==========================================================

async function handleWheelSpin(
    interaction
) {

    const game =
        wheelGames.get(
            interaction.guild.id
        );

    if (
        !game
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد عجلة حظ نشطة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.channelId !==
        interaction.channel.id
    ) {

        await interaction.reply({

            content:
                '❌ هذه العجلة ليست في هذه القناة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.spinning
    ) {

        await interaction.reply({

            content:
                '⏳ العجلة تدور بالفعل.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.timeout
    ) {

        clearTimeout(
            game.timeout
        );

        game.timeout =
            null;

    }

    game.spinning =
        true;

    // ======================================================
    // تعطيل الزر
    // ======================================================

    await interaction.update({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🎡 عجلة الحظ'
                )

                .setDescription(
                    `🎡 ${interaction.user} بدأ تدوير العجلة...`
                )

                .setColor(
                    0xE67E22
                )

        ],

        components: [
            createWheelButton(
                true
            )
        ]

    });

    // ======================================================
    // Animation
    // ======================================================

    const frames = [

        '🎡 تدوووور...',

        '✨ مستمرة...',

        '🔥 اقتربت...',

        '🎯 آخر لفة...',

        '🛑 توقفت!'

    ];

    for (
        let i = 0;
        i < frames.length;
        i++
    ) {

        await sleep(
            650
        );

        await interaction.message.edit({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🎡 عجلة الحظ'
                    )

                    .setDescription(

                        `${frames[i]}\n\n` +

                        `👤 اللاعب: ${interaction.user}`

                    )

                    .setColor(

                        i ===
                        frames.length - 1

                            ?

                            0xF1C40F

                            :

                            0xE67E22

                    )

            ],

            components: [

                createWheelButton(
                    true
                )

            ]

        }).catch(
            () => {}
        );

    }

    // ======================================================
    // الجائزة
    // ======================================================

    const reward =
        randomItem(
            WHEEL_REWARDS
        );

    addZom(
        interaction.user.id,
        reward
    );

    wheelGames.delete(
        interaction.guild.id
    );

    // ======================================================
    // النتيجة
    // ======================================================

    await interaction.message.edit({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🎉 نتيجة عجلة الحظ'
                )

                .setDescription(

                    `🏆 ${interaction.user} فاز بـ **${formatZom(reward)} ZOM**!\n\n` +

                    `💰 رصيدك الجديد: **${formatZom(
                        getUser(
                            interaction.user.id
                        ).balance
                    )} ZOM**`

                )

                .setColor(
                    0x2ECC71
                )

        ],

        components:
            []

    }).catch(
        () => {}
    );

}
// ==========================================================
// 🎭 MAFIA
// ==========================================================

function createMafiaLobbyButtons() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(
                    'mafia_join'
                )
                .setLabel(
                    'انضم'
                )
                .setEmoji(
                    '🎮'
                )
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    'mafia_leave'
                )
                .setLabel(
                    'مغادرة'
                )
                .setEmoji(
                    '🚪'
                )
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    'mafia_start'
                )
                .setLabel(
                    'بدء'
                )
                .setEmoji(
                    '▶️'
                )
                .setStyle(
                    ButtonStyle.Danger
                ),

            new ButtonBuilder()
                .setCustomId(
                    'mafia_cancel'
                )
                .setLabel(
                    'إلغاء'
                )
                .setEmoji(
                    '✖️'
                )
                .setStyle(
                    ButtonStyle.Secondary
                )

        );

}

// ==========================================================
// 🎭 رسالة انتظار المافيا
// ==========================================================

function buildMafiaLobbyEmbed(
    game
) {

    return new EmbedBuilder()

        .setTitle(
            '🎭 لعبة المافيا'
        )

        .setDescription(

            `👑 المضيف: <@${game.hostId}>\n\n` +

            `👥 اللاعبون: **${game.players.length}/${MAFIA_MAX_PLAYERS}**\n\n` +

            (
                game.players.length

                    ?

                    game.players
                        .map(
                            (id, i) =>
                                `**${i + 1}.** <@${id}>`
                        )
                        .join(
                            '\n'
                        )

                    :

                    'لا يوجد لاعبون.'
            )

            +

            `\n\n📌 الحد الأدنى للبدء: **${MAFIA_MIN_PLAYERS} لاعبين**`

        )

        .setColor(
            0x8E44AD
        );

}

// ==========================================================
// 🎭 إنشاء لعبة مافيا
// ==========================================================

async function createMafia(
    interaction
) {

    const guildId =
        interaction.guild.id;

    if (
        mafiaGames.has(
            guildId
        )
    ) {

        await interaction.reply({

            content:
                '❌ توجد لعبة مافيا بالفعل.',

            ephemeral:
                true

        });

        return;

    }

    const game = {

        guildId,

        channelId:
            interaction.channel.id,

        hostId:
            interaction.user.id,

        players: [
            interaction.user.id
        ],

        roles:
            {},

        alive:
            new Set(),

        phase:
            'lobby',

        round:
            1,

        votes:
            {},

        nightAction:
            {},

        timers:
            []

    };

    void require('./public/serverLogs').game(interaction,'مافيا','فتح لعبة');
    mafiaGames.set(
        guildId,
        game
    );

    await interaction.reply({

        embeds: [
            buildMafiaLobbyEmbed(
                game
            )
        ],

        components: [
            createMafiaLobbyButtons()
        ]

    });

}

// ==========================================================
// 🎭 تحديث غرفة انتظار المافيا
// ==========================================================

async function updateMafiaLobby(
    interaction,
    game
) {

    await interaction.message.edit({

        embeds: [
            buildMafiaLobbyEmbed(
                game
            )
        ],

        components: [
            createMafiaLobbyButtons()
        ]

    }).catch(
        () => {}
    );

}

// ==========================================================
// ➕ الانضمام للمافيا
// ==========================================================

async function handleMafiaJoin(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild.id
        );

    if (
        !game ||
        game.phase !== 'lobby'
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد غرفة مافيا قابلة للانضمام.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.players.includes(
            interaction.user.id
        )
    ) {

        await interaction.reply({

            content:
                '⚠️ أنت منضم بالفعل.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.players.length >=
        MAFIA_MAX_PLAYERS
    ) {

        await interaction.reply({

            content:
                '❌ وصلت اللعبة إلى الحد الأقصى.',

            ephemeral:
                true

        });

        return;

    }

    game.players.push(
        interaction.user.id
    );

    await interaction.reply({

        content:
            '✅ تم انضمامك للمافيا.',

        ephemeral:
            true

    });

    await updateMafiaLobby(
        interaction,
        game
    );

}

// ==========================================================
// 🚪 مغادرة المافيا
// ==========================================================

async function handleMafiaLeave(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild.id
        );

    if (
        !game ||
        game.phase !== 'lobby'
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد غرفة مافيا قابلة للمغادرة.',

            ephemeral:
                true

        });

        return;

    }

    const index =
        game.players.indexOf(
            interaction.user.id
        );

    if (
        index === -1
    ) {

        await interaction.reply({

            content:
                '⚠️ أنت لست داخل اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    game.players.splice(
        index,
        1
    );

    // ======================================================
    // لا يوجد لاعبين
    // ======================================================

    if (
        !game.players.length
    ) {

        mafiaGames.delete(
            interaction.guild.id
        );

        await interaction.update({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🎭 المافيا'
                    )

                    .setDescription(
                        '❌ تم إغلاق اللعبة لعدم وجود لاعبين.'
                    )

                    .setColor(
                        0x95A5A6
                    )

            ],

            components:
                []

        });

        return;

    }

    // ======================================================
    // نقل المضيف
    // ======================================================

    if (
        game.hostId ===
        interaction.user.id
    ) {

        game.hostId =
            game.players[0];

    }

    await interaction.reply({

        content:
            '🚪 غادرت لعبة المافيا.',

        ephemeral:
            true

    });

    await updateMafiaLobby(
        interaction,
        game
    );

}

// ==========================================================
// 🎭 توزيع أدوار المافيا
// ==========================================================

function assignMafiaRoles(
    players
) {

    const shuffled =
        shuffleArray(
            players
        );

    const roles = {};

    roles[
        shuffled[0]
    ] =
        'mafia';

    roles[
        shuffled[1]
    ] =
        'doctor';

    roles[
        shuffled[2]
    ] =
        'detective';

    for (
        const userId of
        shuffled.slice(
            3
        )
    ) {

        roles[
            userId
        ] =
            'citizen';

    }

    return roles;

}

// ==========================================================
// 🎭 أسماء الأدوار
// ==========================================================

function getMafiaRoleName(
    role
) {

    const names = {

        mafia:
            '🔪 مافيا',

        doctor:
            '🩺 طبيب',

        detective:
            '🕵️ محقق',

        citizen:
            '👤 مواطن'

    };

    return (
        names[
            role
        ] ||
        '👤 غير معروف'
    );

}

// ==========================================================
// 📩 إرسال الأدوار بالخاص
// ==========================================================

async function sendMafiaRoles(
    guild,
    game
) {

    for (
        const userId of
        game.players
    ) {

        const member =
            await guild.members
                .fetch(
                    userId
                )
                .catch(
                    () => null
                );

        if (
            !member
        ) {
            continue;
        }

        await member.send({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🎭 دورك في المافيا'
                    )

                    .setDescription(

                        `دورك هو: **${getMafiaRoleName(
                            game.roles[
                                userId
                            ]
                        )}**\n\n` +

                        '🤫 لا تكشف دورك للاعبين.'

                    )

                    .setColor(
                        0x8E44AD
                    )

            ]

        }).catch(
            () => {}
        );

    }

}

// ==========================================================
// ▶️ بدء المافيا
// ==========================================================

async function handleMafiaStart(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild.id
        );

    if (
        !game ||
        game.phase !== 'lobby'
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد غرفة مافيا جاهزة.',

            ephemeral:
                true

        });

        return;

    }

    // ======================================================
    // المضيف أو الإدارة
    // ======================================================

    if (

        interaction.user.id !==
        game.hostId

        &&

        !isAdmin(
            interaction.member
        )

    ) {

        await interaction.reply({

            content:
                '❌ فقط المضيف أو الإدارة يستطيع بدء اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.players.length <
        MAFIA_MIN_PLAYERS
    ) {

        await interaction.reply({

            content:
                `❌ تحتاج إلى **${MAFIA_MIN_PLAYERS} لاعبين** على الأقل.`,

            ephemeral:
                true

        });

        return;

    }

    // ======================================================
    // توزيع الأدوار
    // ======================================================

    game.roles =
        assignMafiaRoles(
            game.players
        );

    game.alive =
        new Set(
            game.players
        );

    game.phase =
        'night';

    game.round =
        1;

    game.votes =
        {};

    game.nightAction =
        {};

    await interaction.update({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🎭 بدأت المافيا'
                )

                .setDescription(

                    `👥 عدد اللاعبين: **${game.players.length}**\n\n` +

                    '📩 تم إرسال الأدوار بالخاص قدر الإمكان.\n' +

                    '🌙 يبدأ الليل الآن.'

                )

                .setColor(
                    0x2C3E50
                )

        ],

        components:
            []

    });

    await sendMafiaRoles(
        interaction.guild,
        game
    );

    await sleep(
        1500
    );

    await mafiaNight(
        interaction.guild
    );

}

// ==========================================================
// 🌙 زر تنفيذ الدور
// ==========================================================

function createMafiaActionButton() {

    return new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'mafia_action'
                )

                .setLabel(
                    'نفّذ دورك'
                )

                .setEmoji(
                    '🎭'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

        );

}

// ==========================================================
// 🌙 ليلة المافيا
// ==========================================================

async function mafiaNight(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game ||
        game.phase !== 'night'
    ) {
        return;
    }

    game.nightAction =
        {};

    const channel =
        guild.channels.cache.get(
            game.channelId
        );

    if (
        !channel
    ) {

        mafiaGames.delete(
            guild.id
        );

        return;

    }

    await channel.send({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    `🌙 الليل ${game.round}`
                )

                .setDescription(

                    'أصحاب الأدوار الخاصة يستخدمون زر **نفّذ دورك**.\n\n' +

                    '🔪 المافيا تختار هدفًا.\n' +

                    '🩺 الطبيب يحمي لاعبًا.\n' +

                    '🕵️ المحقق يحقق مع لاعب.\n\n' +

                    '⏳ إذا لم تكتمل الأدوار خلال 25 ثانية ينتهي الليل تلقائيًا.'

                )

                .setColor(
                    0x2C3E50
                )

        ],

        components: [
            createMafiaActionButton()
        ]

    });

    const currentRound =
        game.round;

    const timer =
        setTimeout(
            () => {

                const current =
                    mafiaGames.get(
                        guild.id
                    );

                if (

                    current &&

                    current.phase ===
                    'night' &&

                    current.round ===
                    currentRound

                ) {

                    resolveMafiaNight(
                        guild
                    ).catch(
                        console.error
                    );

                }

            },
            GAME_ROUND_TIMEOUT_MS
        );

    game.timers.push(
        timer
    );

}

// ==========================================================
// 🎭 تنفيذ دور اللاعب
// ==========================================================

async function handleMafiaAction(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild.id
        );

    if (
        !game ||
        game.phase !== 'night'
    ) {

        await interaction.reply({

            content:
                '❌ ليس هناك ليل مافيا نشط الآن.',

            ephemeral:
                true

        });

        return;

    }

    const userId =
        interaction.user.id;

    if (
        !game.alive.has(
            userId
        )
    ) {

        await interaction.reply({

            content:
                '❌ أنت خارج اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    const role =
        game.roles[
            userId
        ];

    if (
        ![
            'mafia',
            'doctor',
            'detective'
        ].includes(
            role
        )
    ) {

        await interaction.reply({

            content:
                '👤 دورك لا يملك حركة ليلية.',

            ephemeral:
                true

        });

        return;

    }

    let candidates =
        [
            ...game.alive
        ];

    // ======================================================
    // المافيا لا تقتل نفسها
    // ======================================================

    if (
        role === 'mafia'
    ) {

        candidates =
            candidates.filter(
                id =>
                    id !== userId &&
                    game.roles[id] !==
                    'mafia'
            );

    }

    // ======================================================
    // المحقق لا يحقق مع نفسه
    // ======================================================

    if (
        role === 'detective'
    ) {

        candidates =
            candidates.filter(
                id =>
                    id !== userId
            );

    }

    if (
        !candidates.length
    ) {

        await interaction.reply({

            content:
                '❌ لا يوجد هدف متاح.',

            ephemeral:
                true

        });

        return;

    }

    let customId;

    if (
        role === 'mafia'
    ) {

        customId =
            'mafia_mafia_select';

    }

    else if (
        role === 'doctor'
    ) {

        customId =
            'mafia_doctor_select';

    }

    else {

        customId =
            'mafia_detective_select';

    }

    const menu =
        new StringSelectMenuBuilder()

            .setCustomId(
                customId
            )

            .setPlaceholder(
                'اختر لاعبًا'
            )

            .addOptions(

                candidates
                    .slice(
                        0,
                        25
                    )
                    .map(
                        id => {

                            const member =
                                interaction.guild
                                    .members
                                    .cache
                                    .get(
                                        id
                                    );

                            return {

                                label:
                                    (
                                        member?.displayName ||

                                        member?.user?.username ||

                                        'لاعب'
                                    )
                                        .slice(
                                            0,
                                            100
                                        ),

                                value:
                                    id,

                                description:
                                    `اختيار ${member?.user?.username || 'اللاعب'}`
                                        .slice(
                                            0,
                                            100
                                        )

                            };

                        }
                    )

            );

    await interaction.reply({

        content:
            `🎭 دورك: **${getMafiaRoleName(role)}**`,

        components: [

            new ActionRowBuilder()
                .addComponents(
                    menu
                )

        ],

        ephemeral:
            true

    });

}

// ==========================================================
// 🎭 معالجة اختيار دور المافيا
// ==========================================================

async function handleMafiaSelect(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild?.id
        );

    if (
        !game
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد لعبة مافيا نشطة.',

            ephemeral:
                true

        });

        return;

    }

    const userId =
        interaction.user.id;

    if (
        !game.alive.has(
            userId
        )
    ) {

        await interaction.reply({

            content:
                '❌ أنت خارج اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.phase !==
        'night'
    ) {

        await interaction.reply({

            content:
                '❌ ليس وقت الليل حاليًا.',

            ephemeral:
                true

        });

        return;

    }

    const selectedId =
        interaction.values?.[0];

    if (

        !selectedId ||

        !game.alive.has(
            selectedId
        )

    ) {

        await interaction.reply({

            content:
                '❌ اللاعب المختار غير متاح.',

            ephemeral:
                true

        });

        return;

    }

    const role =
        game.roles[
            userId
        ];

    const targetRole =
        game.roles[
            selectedId
        ];

    // ======================================================
    // 🔪 المافيا
    // ======================================================

    if (
        interaction.customId ===
        'mafia_mafia_select'
    ) {

        if (
            role !== 'mafia'
        ) {

            await interaction.reply({

                content:
                    '❌ هذا الاختيار ليس متاحًا لك.',

                ephemeral:
                    true

            });

            return;

        }

        if (
            targetRole ===
            'mafia'
        ) {

            await interaction.reply({

                content:
                    '❌ لا تستطيع استهداف المافيا.',

                ephemeral:
                    true

            });

            return;

        }

        game.nightAction.mafia =
            selectedId;

        await interaction.update({

            content:
                `🔪 تم اختيار <@${selectedId}> كهدف.`,

            components:
                []

        });

        checkMafiaNightComplete(
            interaction.guild
        );

        return;

    }

    // ======================================================
    // 🩺 الطبيب
    // ======================================================

    if (
        interaction.customId ===
        'mafia_doctor_select'
    ) {

        if (
            role !== 'doctor'
        ) {

            await interaction.reply({

                content:
                    '❌ هذا الاختيار ليس متاحًا لك.',

                ephemeral:
                    true

            });

            return;

        }

        game.nightAction.doctor =
            selectedId;

        await interaction.update({

            content:
                `🩺 تم اختيار <@${selectedId}> للحماية.`,

            components:
                []

        });

        checkMafiaNightComplete(
            interaction.guild
        );

        return;

    }

    // ======================================================
    // 🕵️ المحقق
    // ======================================================

    if (
        interaction.customId ===
        'mafia_detective_select'
    ) {

        if (
            role !== 'detective'
        ) {

            await interaction.reply({

                content:
                    '❌ هذا الاختيار ليس متاحًا لك.',

                ephemeral:
                    true

            });

            return;

        }

        game.nightAction.detective =
            selectedId;

        const result =
            targetRole === 'mafia'

                ?

                '🔴 هذا اللاعب من المافيا.'

                :

                '🟢 هذا اللاعب ليس من المافيا.';

        await interaction.update({

            content:
                `🕵️ نتيجة التحقيق:\n\n${result}`,

            components:
                []

        });

        checkMafiaNightComplete(
            interaction.guild
        );

    }

}

// ==========================================================
// 🌙 التحقق من انتهاء الليل
// ==========================================================

function checkMafiaNightComplete(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game ||
        game.phase !== 'night'
    ) {

        return;

    }

    const mafiaAlive =
        game.players.some(
            id =>
                game.alive.has(
                    id
                ) &&
                game.roles[id] ===
                'mafia'
        );

    const doctorAlive =
        game.players.some(
            id =>
                game.alive.has(
                    id
                ) &&
                game.roles[id] ===
                'doctor'
        );

    const detectiveAlive =
        game.players.some(
            id =>
                game.alive.has(
                    id
                ) &&
                game.roles[id] ===
                'detective'
        );

    const complete =

        (
            !mafiaAlive ||

            Boolean(
                game.nightAction.mafia
            )
        )

        &&

        (
            !doctorAlive ||

            Boolean(
                game.nightAction.doctor
            )
        )

        &&

        (
            !detectiveAlive ||

            Boolean(
                game.nightAction.detective
            )
        );

    if (
        complete
    ) {

        resolveMafiaNight(
            guild
        ).catch(
            console.error
        );

    }

}

// ==========================================================
// ⏱️ حذف مؤقتات المافيا
// ==========================================================

function clearMafiaTimers(
    game
) {

    for (
        const timer of
        game.timers || []
    ) {

        clearTimeout(
            timer
        );

    }

    game.timers =
        [];

}

// ==========================================================
// 🌙 نتيجة الليل
// ==========================================================

async function resolveMafiaNight(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game ||
        game.phase !== 'night'
    ) {

        return;

    }

    game.phase =
        'resolving';

    clearMafiaTimers(
        game
    );

    const target =
        game.nightAction.mafia ||
        null;

    const protectedPlayer =
        game.nightAction.doctor ||
        null;

    let killedPlayer =
        null;

    if (

        target &&

        target !==
        protectedPlayer &&

        game.alive.has(
            target
        )

    ) {

        killedPlayer =
            target;

        game.alive.delete(
            target
        );

    }

    const channel =
        guild.channels.cache.get(
            game.channelId
        );

    if (
        channel
    ) {

        await channel.send({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🌅 انتهت الليلة'
                    )

                    .setDescription(

                        killedPlayer

                            ?

                            (
                                `🌙 انتهت الليلة **${game.round}**.\n\n` +

                                `💀 تم العثور على <@${killedPlayer}> مقتولًا.\n\n` +

                                '☀️ سيبدأ النهار الآن.'
                            )

                            :

                            (
                                `🌙 انتهت الليلة **${game.round}**.\n\n` +

                                '🛡️ لم يمت أي لاعب هذه الليلة.\n\n' +

                                '☀️ سيبدأ النهار الآن.'
                            )

                    )

                    .setColor(
                        0xE67E22
                    )

            ]

        });

    }

    if (
        checkMafiaWinner(
            guild
        )
    ) {

        return;

    }

    game.phase =
        'day';

    game.votes =
        {};

    await startMafiaDay(
        guild
    );

}

// ==========================================================
// ☀️ نهار المافيا
// ==========================================================

async function startMafiaDay(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game ||
        game.phase !== 'day'
    ) {

        return;

    }

    const channel =
        guild.channels.cache.get(
            game.channelId
        );

    if (
        !channel
    ) {

        mafiaGames.delete(
            guild.id
        );

        return;

    }

    const alivePlayers =
        [
            ...game.alive
        ];

    const rows =
        [];

    for (
        let i = 0;
        i < alivePlayers.length;
        i += 5
    ) {

        const buttons =
            alivePlayers

                .slice(
                    i,
                    i + 5
                )

                .map(
                    playerId => {

                        const member =
                            guild.members
                                .cache
                                .get(
                                    playerId
                                );

                        const label =
                            member?.displayName ||

                            member?.user?.username ||

                            'لاعب';

                        return new ButtonBuilder()

                            .setCustomId(
                                `mafia_vote_${playerId}`
                            )

                            .setLabel(
                                label.slice(
                                    0,
                                    80
                                )
                            )

                            .setEmoji(
                                '🗳️'
                            )

                            .setStyle(
                                ButtonStyle.Secondary
                            );

                    }
                );

        rows.push(

            new ActionRowBuilder()
                .addComponents(
                    buttons
                )

        );

    }

    await channel.send({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    `☀️ النهار ${game.round}`
                )

                .setDescription(

                    '👥 اللاعبون الأحياء:\n\n' +

                    alivePlayers

                        .map(
                            (id, index) =>
                                `**${index + 1}.** <@${id}>`
                        )

                        .join(
                            '\n'
                        )

                    +

                    '\n\n🗳️ اختر لاعبًا للطرد. لديك **25 ثانية**.'

                )

                .setColor(
                    0xF1C40F
                )

        ],

        components:
            rows.slice(
                0,
                5
            )

    });

    const currentRound =
        game.round;

    const timer =
        setTimeout(
            () => {

                const current =
                    mafiaGames.get(
                        guild.id
                    );

                if (

                    current &&

                    current.phase ===
                    'day' &&

                    current.round ===
                    currentRound

                ) {

                    finishMafiaDay(
                        guild
                    ).catch(
                        console.error
                    );

                }

            },
            GAME_ROUND_TIMEOUT_MS
        );

    game.timers.push(
        timer
    );

}

// ==========================================================
// 🗳️ تصويت المافيا
// ==========================================================

async function handleMafiaVote(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild?.id
        );

    if (
        !game
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد لعبة مافيا.',

            ephemeral:
                true

        });

        return;

    }

    if (
        game.phase !== 'day'
    ) {

        await interaction.reply({

            content:
                '❌ التصويت غير متاح حاليًا.',

            ephemeral:
                true

        });

        return;

    }

    const voterId =
        interaction.user.id;

    if (
        !game.alive.has(
            voterId
        )
    ) {

        await interaction.reply({

            content:
                '❌ أنت خارج اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    const targetId =
        interaction.customId.replace(
            'mafia_vote_',
            ''
        );

    if (
        !game.alive.has(
            targetId
        )
    ) {

        await interaction.reply({

            content:
                '❌ هذا اللاعب لم يعد حيًا.',

            ephemeral:
                true

        });

        return;

    }

    game.votes[
        voterId
    ] =
        targetId;

    await interaction.reply({

        content:
            `🗳️ تم تسجيل تصويتك ضد <@${targetId}>.`,

        ephemeral:
            true

    });

    const allVoted =
        [
            ...game.alive
        ].every(
            id =>
                game.votes[
                    id
                ]
        );

    if (
        allVoted
    ) {

        await finishMafiaDay(
            interaction.guild
        );

    }

}

// ==========================================================
// 🗳️ إنهاء نهار المافيا
// ==========================================================

async function finishMafiaDay(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game ||
        game.phase !== 'day'
    ) {

        return;

    }

    game.phase =
        'resolving';

    clearMafiaTimers(
        game
    );

    const voteCounts =
        {};

    for (
        const targetId of
        Object.values(
            game.votes
        )
    ) {

        voteCounts[
            targetId
        ] =
            (
                voteCounts[
                    targetId
                ] ||
                0
            ) +
            1;

    }

    const entries =
        Object.entries(
            voteCounts
        )
            .sort(
                (a, b) =>
                    b[1] -
                    a[1]
            );

    let eliminated =
        null;

    if (
        entries.length >
        0
    ) {

        const highest =
            entries[0][1];

        const top =
            entries.filter(
                entry =>
                    entry[1] ===
                    highest
            );

        if (
            top.length ===
            1
        ) {

            eliminated =
                top[0][0];

        }

    }

    const channel =
        guild.channels.cache.get(
            game.channelId
        );

    // ======================================================
    // تم طرد لاعب
    // ======================================================

    if (
        eliminated
    ) {

        game.alive.delete(
            eliminated
        );

        if (
            channel
        ) {

            await channel.send({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            '🗳️ نتيجة التصويت'
                        )

                        .setDescription(

                            `🚪 تم طرد <@${eliminated}>.\n\n` +

                            `🎭 دوره كان: **${getMafiaRoleName(
                                game.roles[
                                    eliminated
                                ]
                            )}**`

                        )

                        .setColor(
                            0xE74C3C
                        )

                ]

            });

        }

    }

    // ======================================================
    // تعادل
    // ======================================================

    else if (
        channel
    ) {

        await channel.send({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🗳️ نتيجة التصويت'
                    )

                    .setDescription(
                        '🤝 لم يتم طرد أي لاعب بسبب التعادل أو عدم كفاية الأصوات.'
                    )

                    .setColor(
                        0x95A5A6
                    )

            ]

        });

    }

    if (
        checkMafiaWinner(
            guild
        )
    ) {

        return;

    }

    game.round++;

    game.phase =
        'night';

    game.nightAction =
        {};

    game.votes =
        {};

    await sleep(
        1500
    );

    await mafiaNight(
        guild
    );

}

// ==========================================================
// 🏆 فائز المافيا
// ==========================================================

function checkMafiaWinner(
    guild
) {

    const game =
        mafiaGames.get(
            guild.id
        );

    if (
        !game
    ) {

        return true;

    }

    const alive =
        [
            ...game.alive
        ];

    const mafiaAlive =
        alive.filter(
            id =>
                game.roles[
                    id
                ] ===
                'mafia'
        );

    const citizensAlive =
        alive.filter(
            id =>
                game.roles[
                    id
                ] !==
                'mafia'
        );

    let winner =
        null;

    // ======================================================
    // المواطنين فازوا
    // ======================================================

    if (
        mafiaAlive.length ===
        0
    ) {

        winner =
            'citizens';

    }

    // ======================================================
    // المافيا فازت
    // ======================================================

    else if (
        mafiaAlive.length >=
        citizensAlive.length
    ) {

        winner =
            'mafia';

    }

    if (
        !winner
    ) {

        return false;

    }

    const channel =
        guild.channels.cache.get(
            game.channelId
        );

    clearMafiaTimers(
        game
    );

    if (
        channel
    ) {

        channel.send({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏆 انتهت لعبة المافيا'
                    )

                    .setDescription(

                        (
                            winner === 'mafia'

                                ?

                                '🔪 **المافيا فازت!**'

                                :

                                '🟢 **المواطنون فازوا!**'
                        )

                        +

                        '\n\n🎭 الأدوار النهائية:\n\n'

                        +

                        game.players
                            .map(
                                id =>
                                    `<@${id}> — ${getMafiaRoleName(
                                        game.roles[
                                            id
                                        ]
                                    )}`
                            )
                            .join(
                                '\n'
                            )

                    )

                    .setColor(

                        winner ===
                        'mafia'

                            ?

                            0x992D22

                            :

                            0x2ECC71

                    )

            ]

        }).catch(
            () => {}
        );

    }

    mafiaGames.delete(
        guild.id
    );

    return true;

}

// ==========================================================
// ❌ إلغاء المافيا
// ==========================================================

async function cancelMafia(
    interaction
) {

    const game =
        mafiaGames.get(
            interaction.guild?.id
        );

    if (
        !game
    ) {

        await interaction.reply({

            content:
                '❌ لا توجد لعبة مافيا.',

            ephemeral:
                true

        });

        return;

    }

    if (

        interaction.user.id !==
        game.hostId

        &&

        !isAdmin(
            interaction.member
        )

    ) {

        await interaction.reply({

            content:
                '❌ فقط المضيف أو الإدارة يستطيع إلغاء اللعبة.',

            ephemeral:
                true

        });

        return;

    }

    clearMafiaTimers(
        game
    );

    mafiaGames.delete(
        interaction.guild.id
    );

    await interaction.update({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '❌ تم إلغاء المافيا'
                )

                .setDescription(
                    'تم إلغاء اللعبة بنجاح.'
                )

                .setColor(
                    0xE74C3C
                )

        ],

        components:
            []

    });

}

// ==========================================================
// 🎰 ROULETTE - نظام الإجراءات + ZOM
// ==========================================================

function getRouletteTurnSeconds() {
    return Math.max(
        10,
        Math.min(
            120,
            Number(ROULETTE_TURN_SECONDS || 25)
        )
    );
}

function getRouletteTurnMs() {
    return getRouletteTurnSeconds() * 1000;
}

function getRouletteMaxPlayers() {
    return Math.min(
        25,
        Math.max(
            2,
            Number(ROULETTE_MAX_PLAYERS || 25)
        )
    );
}

function clearRouletteTimers(game) {
    if (!game) return;

    if (game.actionTimer) {
        clearTimeout(game.actionTimer);
        game.actionTimer = null;
    }

    if (game.nextTimer) {
        clearTimeout(game.nextTimer);
        game.nextTimer = null;
    }
}

function createRouletteButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('roulette_join')
                .setLabel('انضم')
                .setEmoji('🎮')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('roulette_leave')
                .setLabel('مغادرة')
                .setEmoji('🚪')
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId('roulette_start')
                .setLabel('بدء')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Danger)
        );
}

function buildRouletteLobbyEmbed(game) {
    const maxPlayers = getRouletteMaxPlayers();

    return new EmbedBuilder()
        .setTitle('🎰 لعبة الروليت')
        .setDescription(
            `👤 المضيف: <@${game.hostId}>\n\n` +
            `👥 عدد اللاعبين: **${game.players.length}/${maxPlayers}**\n\n` +
            (
                game.players.length
                    ? game.players
                        .map((id, index) => `**${index + 1}.** <@${id}>`)
                        .join('\n')
                    : 'لا يوجد لاعبون.'
            ) +
            '\n\n🎮 اضغط **انضم** للمشاركة.\n' +
            '▶️ المضيف أو الإدارة يضغط **بدء** لبدء اللعبة.'
        )
        .setColor(0xC0392B)
        .setFooter({ text: 'Roulette • ZOM System' });
}

function getRouletteMemberName(guild, userId) {
    return guild.members.cache.get(userId)?.user?.username || 'لاعب';
}


function shortenRouletteWheelName(name, maxLength = 12) {
    const chars = Array.from(String(name || 'لاعب'));
    return chars.length > maxLength
        ? `${chars.slice(0, Math.max(1, maxLength - 1)).join('')}…`
        : chars.join('');
}

function normalizeRouletteAngle(angle) {
    const full = Math.PI * 2;
    return ((angle % full) + full) % full;
}

async function getRouletteAvatarImage(guild, userId) {
    if (!loadImage) return null;

    let member = guild.members.cache.get(userId) || null;

    if (!member) {
        member = await guild.members
            .fetch(userId)
            .catch(() => null);
    }

    const avatarUrl = member?.user?.displayAvatarURL?.({
        extension: 'png',
        size: 256,
        forceStatic: true
    });

    if (!avatarUrl) return null;

    return loadImage(avatarUrl).catch(() => null);
}

function drawRouletteWheelFrame({
    ctx,
    width,
    height,
    names,
    selectedIndex,
    selectedName,
    avatarImage,
    rotation,
    revealAvatar = 0,
    finalFrame = false
}) {
    const cx = width / 2;
    const cy = height / 2 + 8;
    const radius = Math.min(width, height) * 0.405;
    const count = Math.max(1, names.length);
    const arc = (Math.PI * 2) / count;

    const palette = [
        '#E74C3C',
        '#8E44AD',
        '#3498DB',
        '#16A085',
        '#F39C12',
        '#D35400',
        '#2C3E50',
        '#27AE60'
    ];

    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createRadialGradient(
        cx, cy, radius * 0.15,
        cx, cy, radius * 1.4
    );
    bg.addColorStop(0, '#242424');
    bg.addColorStop(1, '#080808');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 28;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < count; i++) {
        const start = rotation + (i * arc);
        const end = start + arc;
        const centerAngle = start + (arc / 2);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();

        ctx.fillStyle = palette[i % palette.length];
        ctx.fill();

        if (finalFrame && i === selectedIndex) {
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#FFD700';
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        }

        ctx.stroke();
        ctx.restore();

        const label = shortenRouletteWheelName(
            names[i],
            count > 18 ? 9 : 12
        );

        const fontSize = count <= 8
            ? 22
            : count <= 14
                ? 18
                : count <= 20
                    ? 15
                    : 13;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(centerAngle);
        ctx.translate(radius * 0.69, 0);

        const angle = normalizeRouletteAngle(centerAngle);

        if (
            angle > Math.PI / 2 &&
            angle < (Math.PI * 3) / 2
        ) {
            ctx.rotate(Math.PI);
        }

        ctx.font = `700 ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeText(label, 0, 0, radius * 0.42);
        ctx.fillText(label, 0, 0, radius * 0.42);
        ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy - radius - 5);
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(-23, -18);
    ctx.lineTo(23, -18);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111111';
    ctx.stroke();
    ctx.restore();

    const centerRadius = Math.max(58, radius * 0.26);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius + 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0B0B';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    if (avatarImage && revealAvatar > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, revealAvatar));
        ctx.beginPath();
        ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
        ctx.clip();

        const scale =
            (centerRadius * 2) /
            Math.min(
                avatarImage.width,
                avatarImage.height
            );

        const drawW =
            avatarImage.width * scale;

        const drawH =
            avatarImage.height * scale;

        ctx.drawImage(
            avatarImage,
            cx - drawW / 2,
            cy - drawH / 2,
            drawW,
            drawH
        );

        ctx.restore();
    } else {
        ctx.fillStyle = '#161616';
        ctx.beginPath();
        ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '800 27px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ZOM', cx, cy - 10);

        ctx.font = '700 18px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('ROULETTE', cx, cy + 20);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();

    if (finalFrame) {
        const selectedLabel =
            shortenRouletteWheelName(
                selectedName,
                20
            );

        ctx.save();
        ctx.font = '800 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = '#FFD700';
        ctx.strokeText(
            `🎯 ${selectedLabel}`,
            cx,
            height - 28
        );
        ctx.fillText(
            `🎯 ${selectedLabel}`,
            cx,
            height - 28
        );
        ctx.restore();
    }
}

async function createRouletteSpinGif(
    guild,
    game,
    selectedPlayer
) {
    if (
        !createCanvas ||
        !GIFEncoder
    ) {
        return null;
    }

    try {
        const width = 640;
        const height = 640;
        const players = [...game.players];
        const selectedIndex =
            players.indexOf(selectedPlayer);

        if (
            selectedIndex < 0 ||
            !players.length
        ) {
            return null;
        }

        await Promise.all(
            players.map(
                userId =>
                    guild.members.cache.has(userId)
                        ? Promise.resolve()
                        : guild.members
                            .fetch(userId)
                            .catch(() => null)
            )
        );

        const names =
            players.map(
                userId =>
                    getRouletteMemberName(
                        guild,
                        userId
                    )
            );

        const selectedName =
            getRouletteMemberName(
                guild,
                selectedPlayer
            );

        const avatarImage =
            await getRouletteAvatarImage(
                guild,
                selectedPlayer
            );

        const canvas =
            createCanvas(
                width,
                height
            );

        const ctx =
            canvas.getContext('2d');

        const encoder =
            new GIFEncoder(
                width,
                height
            );

        const chunks = [];
        const stream =
            encoder.createReadStream();

        const streamDone =
            new Promise(
                (resolve, reject) => {
                    stream.on(
                        'data',
                        chunk =>
                            chunks.push(chunk)
                    );

                    stream.on(
                        'end',
                        resolve
                    );

                    stream.on(
                        'error',
                        reject
                    );
                }
            );

        encoder.start();
        encoder.setRepeat(-1);
        encoder.setQuality(12);

        const count =
            players.length;

        const arc =
            (Math.PI * 2) / count;

        const targetBase =
            (-Math.PI / 2) -
            (selectedIndex * arc) -
            (arc / 2);

        const startRotation = 0;
        let finalRotation =
            targetBase;

        while (
            finalRotation <
            startRotation +
            (Math.PI * 2 * 6)
        ) {
            finalRotation +=
                Math.PI * 2;
        }

        const frameCount = 38;

        for (
            let i = 0;
            i < frameCount;
            i++
        ) {
            const t =
                i /
                (frameCount - 1);

            const easeOut =
                1 -
                Math.pow(
                    1 - t,
                    3
                );

            const rotation =
                startRotation +
                (
                    (
                        finalRotation -
                        startRotation
                    ) *
                    easeOut
                );

            const revealAvatar =
                t <= 0.78
                    ? 0
                    : Math.min(
                        1,
                        (t - 0.78) / 0.22
                    );

            const finalFrame =
                i ===
                frameCount - 1;

            drawRouletteWheelFrame({
                ctx,
                width,
                height,
                names,
                selectedIndex,
                selectedName,
                avatarImage,
                rotation,
                revealAvatar,
                finalFrame
            });

            encoder.setDelay(
                finalFrame
                    ? 850
                    : 70
            );

            encoder.addFrame(ctx);
        }

        encoder.finish();
        await streamDone;

        return Buffer.concat(chunks);

    } catch (error) {
        console.error(
            '❌ فشل إنشاء GIF عجلة الروليت:',
            error
        );

        return null;
    }
}


function roulettePlayerOptions(guild, userIds, description = 'اضغط لاختيار اللاعب') {
    return userIds
        .slice(0, 25)
        .map(userId => ({
            label: getRouletteMemberName(guild, userId).slice(0, 100),
            description: description.slice(0, 100),
            value: userId,
            emoji: '👤'
        }));
}

function isRouletteLinked(game, userId) {
    return game.links.some(pair => pair.includes(userId));
}

function createRouletteActionRows(game) {
    const noDead = !game.deadPlayers.length;
    const noLinks = !game.links.length;
    const atMax = game.players.length >= getRouletteMaxPlayers();
    const cannotDouble = game.players.length < 3;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roulette_action_kick')
            .setLabel('طرد لاعب')
            .setEmoji('👢')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId('roulette_action_random')
            .setLabel('طرد عشوائي')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('roulette_action_leave_turn')
            .setLabel('انسحاب')
            .setEmoji('🚪')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roulette_action_revive')
            .setLabel('إنعاش لاعب')
            .setEmoji('💎')
            .setStyle(ButtonStyle.Success)
            .setDisabled(noDead),

        new ButtonBuilder()
            .setCustomId('roulette_action_link')
            .setLabel('ربط لاعبين')
            .setEmoji('🔗')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('roulette_action_protect')
            .setLabel('حماية لاعب')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Success)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roulette_action_freeze')
            .setLabel('تجميد لاعب')
            .setEmoji('🧊')
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId('roulette_action_double')
            .setLabel('قتل لاعبين')
            .setEmoji('💀')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(cannotDouble),

        new ButtonBuilder()
            .setCustomId('roulette_action_curse')
            .setLabel('سحر لاعب')
            .setEmoji('🪄')
            .setStyle(ButtonStyle.Danger)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roulette_action_unlink')
            .setLabel('فك الربط')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(noLinks),

        new ButtonBuilder()
            .setCustomId('roulette_action_add')
            .setLabel('إضافة لاعب')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success)
            .setDisabled(atMax)
    );

    return [row1, row2, row3, row4];
}

function buildRouletteActionEmbed(game, guild) {
    const actor = game.selectedPlayer;
    const actorData = getUser(actor);
    const member = guild.members.cache.get(actor);

    const embed = new EmbedBuilder()
        .setTitle('🎰 دور الروليت')
        .setDescription(
            `🎯 الدور على <@${actor}>\n` +
            `👥 اللاعبين: **${game.players.length}/${getRouletteMaxPlayers()}**\n` +
            `💰 رصيدك: **${formatZom(actorData.balance)} ZOM**\n\n` +
            '🟢 **الإجراءات المجانية**\n' +
            '👢 **طرد لاعب** — اختر لاعبًا لإخراجه من اللعبة.\n' +
            '🎲 **طرد عشوائي** — يخرج لاعب عشوائي من اللعبة.\n' +
            '🚪 **انسحاب** — تخرج من اللعبة طوعًا.\n\n' +
            '💎 **الإجراءات المدفوعة**\n' +
            `💎 **إنعاش لاعب** — ${formatZom(getRouletteActionCost('revive'))} ZOM\n` +
            `🔗 **ربط لاعبين** — ${formatZom(getRouletteActionCost('link'))} ZOM\n` +
            `🛡️ **حماية لاعب** — ${formatZom(getRouletteActionCost('protect'))} ZOM\n\n` +
            '💀 **الإجراءات الخاصة**\n' +
            `🧊 **تجميد لاعب** — ${formatZom(getRouletteActionCost('freeze'))} ZOM\n` +
            `💀 **قتل لاعبين** — ${formatZom(getRouletteActionCost('double'))} ZOM\n` +
            `🪄 **سحر لاعب** — ${formatZom(getRouletteActionCost('curse'))} ZOM\n\n` +
            '🔗 **إجراءات أخرى**\n' +
            `🔓 **فك الربط** — ${formatZom(getRouletteActionCost('unlink'))} ZOM\n` +
            `➕ **إضافة لاعب** — ${formatZom(getRouletteActionCost('add'))} ZOM\n\n` +
            `⏳ لديك **${getRouletteTurnSeconds()} ثانية** لاختيار إجراء.`
        )
        .setColor(0xB8860B)
        .setFooter({ text: `الجولة ${game.turnNumber} • Roulette ZOM` });

    const avatar = member?.user?.displayAvatarURL?.({ size: 256 });
    if (avatar) embed.setThumbnail(avatar);

    if (game.wheelImageUrl) {
        embed.setImage(game.wheelImageUrl);
    }

    return embed;
}

function createRouletteBackRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roulette_action_back')
            .setLabel('رجوع للإجراءات')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary)
    );
}

function getRouletteActionCost(action) {
    return Number(ROULETTE_ACTION_COSTS[action] || 0);
}

async function rouletteCheckBalance(interaction, action) {
    const cost = getRouletteActionCost(action);
    if (!cost) return true;

    const user = getUser(interaction.user.id);
    if (user.balance >= cost) return true;

    await interaction.reply({
        content:
            `❌ رصيدك غير كافٍ لتنفيذ هذا الإجراء.\n` +
            `💳 المطلوب: **${formatZom(cost)} ZOM**\n` +
            `💰 رصيدك: **${formatZom(user.balance)} ZOM**`,
        ephemeral: true
    });

    return false;
}

function rouletteSpend(userId, action) {
    const cost = getRouletteActionCost(action);
    if (!cost) return { ok: true, cost: 0, balance: getUser(userId).balance };

    const user = getUser(userId);
    if (user.balance < cost) {
        return { ok: false, cost, balance: user.balance };
    }

    user.balance -= cost;
    saveEconomy();

    return { ok: true, cost, balance: user.balance };
}

function removeRouletteLinksFor(game, userId) {
    game.links = game.links.filter(pair => !pair.includes(userId));
}

function eliminateRoulettePlayers(game, initialTargets, options = {}) {
    const {
        revivable = true,
        useProtection = true,
        cascadeLinks = true
    } = options;

    const queue = [...new Set(initialTargets)];
    const processed = new Set();
    const eliminated = [];
    const protectedPlayers = [];
    const linkedEliminated = [];

    while (queue.length) {
        const userId = queue.shift();
        if (processed.has(userId)) continue;
        processed.add(userId);

        if (!game.players.includes(userId)) continue;

        if (useProtection && game.protectedPlayers[userId]) {
            delete game.protectedPlayers[userId];
            protectedPlayers.push(userId);
            continue;
        }

        const linkedPartners = cascadeLinks
            ? game.links
                .filter(pair => pair.includes(userId))
                .map(pair => pair[0] === userId ? pair[1] : pair[0])
            : [];

        game.players = game.players.filter(id => id !== userId);

        if (revivable && !game.deadPlayers.includes(userId)) {
            game.deadPlayers.push(userId);
        }

        eliminated.push(userId);

        delete game.protectedPlayers[userId];
        delete game.frozenUntil[userId];
        game.cursedPlayers = game.cursedPlayers.filter(id => id !== userId);

        removeRouletteLinksFor(game, userId);

        for (const partner of linkedPartners) {
            if (game.players.includes(partner)) {
                linkedEliminated.push(partner);
                queue.push(partner);
            }
        }
    }

    return {
        eliminated: [...new Set(eliminated)],
        protectedPlayers: [...new Set(protectedPlayers)],
        linkedEliminated: [...new Set(linkedEliminated)]
    };
}

function formatRouletteResult(result) {
    const parts = [];

    if (result.eliminated?.length) {
        parts.push(
            `❌ خرج من اللعبة: ${result.eliminated.map(id => `<@${id}>`).join('، ')}`
        );
    }

    if (result.protectedPlayers?.length) {
        parts.push(
            `🛡️ الحماية أنقذت: ${result.protectedPlayers.map(id => `<@${id}>`).join('، ')}`
        );
    }

    if (!parts.length) {
        parts.push('ℹ️ لم يتم إخراج أي لاعب.');
    }

    return parts.join('\n');
}

async function endRouletteGame(game, message, extraText = '') {
    clearRouletteTimers(game);
    rouletteGames.delete(game.guildId);

    const winner = game.players[0] || null;

    await message.edit({
        embeds: [
            new EmbedBuilder()
                .setTitle(winner ? '🏆 انتهت الروليت' : '🏁 انتهت الروليت')
                .setDescription(
                    (extraText ? `${extraText}\n\n` : '') +
                    (
                        winner
                            ? `🏆 الفائز هو <@${winner}>!\n\n🎉 مبروك للفائز!`
                            : 'لا يوجد فائز في هذه الجولة.'
                    )
                )
                .setColor(winner ? 0x2ECC71 : 0x95A5A6)
        ],
        components: []
    }).catch(() => {});
}

function scheduleRouletteNextTurn(game, guild, message, delay = 2200) {
    if (game.nextTimer) clearTimeout(game.nextTimer);

    game.nextTimer = setTimeout(async () => {
        game.nextTimer = null;

        if (rouletteGames.get(game.guildId) !== game) return;

        try {
            await runRouletteSpin(guild, message, game);
        } catch (error) {
            console.error('❌ خطأ في تشغيل دور الروليت التالي:', error);
        }
    }, delay);
}

async function finishRouletteTurn(interaction, game, text, cost = 0) {
    clearRouletteTimers(game);
    game.pendingAction = null;
    game.phase = 'transition';
    game.started = true;

    const costText = cost
        ? `\n💸 تم خصم **${formatZom(cost)} ZOM**.`
        : '';

    if (game.players.length <= 1) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🏆 انتهت الروليت')
                    .setDescription(
                        `${text}${costText}\n\n` +
                        (
                            game.players[0]
                                ? `🏆 الفائز هو <@${game.players[0]}>!\n\n🎉 مبروك للفائز!`
                                : 'لا يوجد فائز في هذه الجولة.'
                        )
                    )
                    .setColor(game.players[0] ? 0x2ECC71 : 0x95A5A6)
            ],
            components: []
        });

        rouletteGames.delete(game.guildId);
        return;
    }

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setTitle('🎰 نتيجة الإجراء')
                .setDescription(
                    `${text}${costText}\n\n` +
                    `👥 المتبقي: **${game.players.length}** لاعب\n` +
                    '🎡 سيتم تشغيل العجلة تلقائيًا للدور التالي...'
                )
                .setColor(0x3498DB)
        ],
        components: []
    });

    game.selectedPlayer = null;
    scheduleRouletteNextTurn(game, interaction.guild, interaction.message);
}

async function finishRouletteTurnByMessage(game, guild, message, text) {
    clearRouletteTimers(game);
    game.pendingAction = null;
    game.phase = 'transition';

    if (game.players.length <= 1) {
        await endRouletteGame(game, message, text);
        return;
    }

    await message.edit({
        embeds: [
            new EmbedBuilder()
                .setTitle('⏰ انتهى وقت الدور')
                .setDescription(
                    `${text}\n\n` +
                    `👥 المتبقي: **${game.players.length}** لاعب\n` +
                    '🎡 سيتم تشغيل العجلة تلقائيًا للدور التالي...'
                )
                .setColor(0xE67E22)
        ],
        components: []
    }).catch(() => {});

    game.selectedPlayer = null;
    scheduleRouletteNextTurn(game, guild, message);
}

function armRouletteActionTimer(game, guild, message) {
    if (game.actionTimer) clearTimeout(game.actionTimer);

    const turnId = game.turnId;

    game.actionTimer = setTimeout(async () => {
        if (rouletteGames.get(game.guildId) !== game) return;
        if (game.turnId !== turnId) return;
        if (!['action', 'targeting'].includes(game.phase)) return;

        game.actionTimer = null;

        const actor = game.selectedPlayer;
        const candidates = game.players.filter(id => id !== actor);

        if (!candidates.length) {
            await endRouletteGame(game, message, '⏰ انتهى وقت اللاعب.');
            return;
        }

        const target = randomItem(candidates);
        const result = eliminateRoulettePlayers(game, [target]);

        await finishRouletteTurnByMessage(
            game,
            guild,
            message,
            `⏰ انتهت مهلة **${getRouletteTurnSeconds()} ثانية** بدون اختيار إجراء.\n` +
            `🎲 تم تنفيذ **طرد عشوائي** تلقائيًا.\n\n` +
            formatRouletteResult(result)
        );
    }, getRouletteTurnMs());
}

async function runRouletteSpin(guild, message, game) {
    if (rouletteGames.get(game.guildId) !== game) return;

    if (game.players.length <= 1) {
        await endRouletteGame(game, message);
        return;
    }

    clearRouletteTimers(game);
    game.phase = 'spinning';
    game.started = true;
    game.pendingAction = null;
    game.selectedPlayer = null;
    game.turnNumber += 1;
    game.turnId += 1;
    game.wheelImageUrl = '';

    const selectedPlayer =
        randomItem(game.players);

    game.selectedPlayer =
        selectedPlayer;

    let renderedWheel = false;

    const gifBuffer =
        await createRouletteSpinGif(
            guild,
            game,
            selectedPlayer
        );

    if (
        gifBuffer &&
        gifBuffer.length
    ) {
        const fileName =
            `roulette-turn-${game.turnId}.gif`;

        try {
            const edited =
                await message.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                '🎰 عجلة الروليت'
                            )
                            .setDescription(
                                '🎡 **العجلة تدور الآن...**\n\n' +
                                `👥 عدد اللاعبين: **${game.players.length}/${getRouletteMaxPlayers()}**\n` +
                                `🔁 الجولة: **${game.turnNumber}**\n\n` +
                                '🎯 انتظر حتى تتوقف العجلة.'
                            )
                            .setColor(
                                0xE67E22
                            )
                            .setImage(
                                `attachment://${fileName}`
                            )
                    ],
                    components: [],
                    attachments: [],
                    files: [
                        new AttachmentBuilder(
                            gifBuffer,
                            {
                                name: fileName
                            }
                        )
                    ]
                });

            game.wheelImageUrl =
                edited?.attachments
                    ?.first?.()
                    ?.url
                ||
                edited?.attachments
                    ?.find?.(
                        attachment =>
                            attachment.name ===
                            fileName
                    )
                    ?.url
                ||
                '';

            renderedWheel = true;

            await sleep(3450);

        } catch (error) {
            console.error(
                '❌ فشل عرض عجلة الروليت المتحركة:',
                error
            );
        }
    }

    if (!renderedWheel) {
        const spinMessages = [
            '🎡 العجلة تدور...',
            '🎡 العجلة ما زالت تدور...',
            '🎡 السرعة بدأت تخف...',
            '🎡 قربت توقف...',
            '🎯 توقفت العجلة!'
        ];

        for (
            let i = 0;
            i < spinMessages.length;
            i++
        ) {
            if (
                rouletteGames.get(
                    game.guildId
                ) !== game
            ) {
                return;
            }

            await message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            '🎰 عجلة الروليت'
                        )
                        .setDescription(
                            `${spinMessages[i]}\n\n` +
                            `👥 عدد اللاعبين: **${game.players.length}/${getRouletteMaxPlayers()}**\n` +
                            `🔁 الجولة: **${game.turnNumber}**`
                        )
                        .setColor(
                            i ===
                            spinMessages.length - 1
                                ? 0xF1C40F
                                : 0xE67E22
                        )
                ],
                components: [],
                attachments: []
            }).catch(() => {});

            await sleep(650);
        }
    }

    if (
        rouletteGames.get(
            game.guildId
        ) !== game
    ) {
        return;
    }

    const frozenUntil =
        Number(
            game.frozenUntil[
                selectedPlayer
            ] ||
            0
        );

    if (
        frozenUntil >=
        game.turnNumber
    ) {
        game.phase =
            'transition';

        const embed =
            new EmbedBuilder()
                .setTitle(
                    '🧊 لاعب مجمّد'
                )
                .setDescription(
                    `🎯 اختارت العجلة <@${selectedPlayer}>، لكنه **مجمّد**.\n\n` +
                    `⛔ تم إلغاء دوره.\n` +
                    `⏳ التجميد فعال حتى الجولة **${frozenUntil}**.\n\n` +
                    '🎡 سيتم الانتقال تلقائيًا للدور التالي...'
                )
                .setColor(
                    0x3498DB
                );

        if (
            game.wheelImageUrl
        ) {
            embed.setImage(
                game.wheelImageUrl
            );
        }

        await message.edit({
            embeds: [embed],
            components: []
        }).catch(() => {});

        game.selectedPlayer = null;

        scheduleRouletteNextTurn(
            game,
            guild,
            message
        );

        return;
    }

    if (
        game.cursedPlayers.includes(
            selectedPlayer
        )
    ) {
        game.cursedPlayers =
            game.cursedPlayers.filter(
                id =>
                    id !==
                    selectedPlayer
            );

        game.phase =
            'transition';

        const embed =
            new EmbedBuilder()
                .setTitle(
                    '🪄 لاعب مسحور'
                )
                .setDescription(
                    `🎯 اختارت العجلة <@${selectedPlayer}>، لكنه كان **مسحورًا**.\n\n` +
                    '✨ تم استهلاك السحر وإلغاء هذا الدور.\n\n' +
                    '🎡 سيتم الانتقال تلقائيًا للدور التالي...'
                )
                .setColor(
                    0x9B59B6
                );

        if (
            game.wheelImageUrl
        ) {
            embed.setImage(
                game.wheelImageUrl
            );
        }

        await message.edit({
            embeds: [embed],
            components: []
        }).catch(() => {});

        game.selectedPlayer = null;

        scheduleRouletteNextTurn(
            game,
            guild,
            message
        );

        return;
    }

    game.phase = 'action';

    game.actionDeadline =
        Date.now() +
        getRouletteTurnMs();

    await message.edit({
        embeds: [
            buildRouletteActionEmbed(
                game,
                guild
            )
        ],
        components:
            createRouletteActionRows(
                game
            )
    }).catch(() => {});

    armRouletteActionTimer(
        game,
        guild,
        message
    );
}

async function createRoulette(interaction) {
    const guildId = interaction.guild.id;

    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: '❌ تشغيل الروليت متاح للإدارة فقط.',
            ephemeral: true
        });
        return;
    }

    if (!ROULETTE_ENABLED) {
        await interaction.reply({
            content: '⛔ الروليت مغلقة حاليًا من لوحة التحكم.',
            ephemeral: true
        });
        return;
    }

    if (rouletteGames.has(guildId)) {
        await interaction.reply({
            content: '❌ توجد لعبة روليت بالفعل.',
            ephemeral: true
        });
        return;
    }

    const game = {
        guildId,
        channelId: interaction.channel.id,
        hostId: interaction.user.id,
        players: [interaction.user.id],
        everPlayers: [interaction.user.id],
        deadPlayers: [],
        links: [],
        protectedPlayers: {},
        frozenUntil: {},
        cursedPlayers: [],
        phase: 'lobby',
        started: false,
        selectedPlayer: null,
        pendingAction: null,
        turnNumber: 0,
        turnId: 0,
        actionTimer: null,
        nextTimer: null,
        wheelImageUrl: '',
        createdAt: Date.now()
    };

    rouletteGames.set(guildId, game);
    void require('./public/serverLogs').game(interaction,'روليت','فتح لوبي لعبة');

    const sentMessage = await interaction.reply({
        embeds: [buildRouletteLobbyEmbed(game)],
        components: [createRouletteButtons()],
        fetchReply: true
    });

    game.messageId = sentMessage?.id || null;
}

// ==========================================================
// 🎰 تشغيل الروليت من الشات باستخدام #روليت
// ==========================================================

async function createRouletteFromMessage(message) {
    const guildId = message.guild.id;

    if (!isAdmin(message.member)) {
        await message.reply({
            content: '❌ أمر **#روليت** متاح للإدارة فقط.'
        }).catch(() => {});
        return;
    }

    if (!ROULETTE_ENABLED) {
        await message.reply({
            content: '⛔ الروليت مغلقة حاليًا من لوحة التحكم.'
        }).catch(() => {});
        return;
    }

    if (rouletteGames.has(guildId)) {
        await message.reply({
            content: '❌ توجد لعبة روليت بالفعل.'
        }).catch(() => {});
        return;
    }

    const game = {
        guildId,
        channelId: message.channel.id,
        hostId: message.author.id,
        players: [message.author.id],
        everPlayers: [message.author.id],
        deadPlayers: [],
        links: [],
        protectedPlayers: {},
        frozenUntil: {},
        cursedPlayers: [],
        phase: 'lobby',
        started: false,
        selectedPlayer: null,
        pendingAction: null,
        turnNumber: 0,
        turnId: 0,
        actionTimer: null,
        nextTimer: null,
        wheelImageUrl: '',
        createdAt: Date.now()
    };

    rouletteGames.set(guildId, game);
    void require('./public/serverLogs').game(message,'روليت','فتح لوبي لعبة');

    const sentMessage = await message.channel.send({
        embeds: [buildRouletteLobbyEmbed(game)],
        components: [createRouletteButtons()]
    });

    game.messageId = sentMessage?.id || null;
}

async function rouletteJoin(interaction) {
    const game = rouletteGames.get(interaction.guild.id);

    if (!game) {
        await interaction.reply({
            content: '❌ لا توجد لعبة روليت.',
            ephemeral: true
        });
        return;
    }

    if (game.phase !== 'lobby') {
        await interaction.reply({
            content: '❌ اللعبة بدأت بالفعل ولا يمكن الانضمام الآن.',
            ephemeral: true
        });
        return;
    }

    if (game.players.includes(interaction.user.id)) {
        await interaction.reply({
            content: '⚠️ أنت منضم بالفعل.',
            ephemeral: true
        });
        return;
    }

    if (game.players.length >= getRouletteMaxPlayers()) {
        await interaction.reply({
            content: `❌ وصلت اللعبة إلى الحد الأقصى (**${getRouletteMaxPlayers()} لاعب**).`,
            ephemeral: true
        });
        return;
    }

    game.players.push(interaction.user.id);
    if (!game.everPlayers.includes(interaction.user.id)) {
        game.everPlayers.push(interaction.user.id);
    }

    await interaction.reply({
        content:
            `✅ انضممت للروليت!\n` +
            `👥 العدد: **${game.players.length}/${getRouletteMaxPlayers()}**`,
        ephemeral: true
    });

    await updateRouletteMessage(interaction);
}

async function rouletteLeave(interaction) {
    const game = rouletteGames.get(interaction.guild.id);

    if (!game) {
        await interaction.reply({
            content: '❌ لا توجد لعبة روليت.',
            ephemeral: true
        });
        return;
    }

    if (game.phase !== 'lobby') {
        await interaction.reply({
            content: '❌ بعد بدء اللعبة استخدم زر **انسحاب** عندما يأتي دورك.',
            ephemeral: true
        });
        return;
    }

    const index = game.players.indexOf(interaction.user.id);
    if (index === -1) {
        await interaction.reply({
            content: '⚠️ أنت لست مشتركًا.',
            ephemeral: true
        });
        return;
    }

    game.players.splice(index, 1);

    if (!game.players.length) {
        clearRouletteTimers(game);
        rouletteGames.delete(interaction.guild.id);

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎰 الروليت')
                    .setDescription('❌ تم إغلاق الروليت لعدم وجود لاعبين.')
                    .setColor(0x95A5A6)
            ],
            components: []
        });
        return;
    }

    if (game.hostId === interaction.user.id) {
        game.hostId = game.players[0];
    }

    await interaction.reply({
        content: '🚪 غادرت لعبة الروليت.',
        ephemeral: true
    });

    await updateRouletteMessage(interaction);
}

async function updateRouletteMessage(interaction) {
    const game = rouletteGames.get(interaction.guild.id);
    if (!game || game.phase !== 'lobby') return;

    await interaction.message.edit({
        embeds: [buildRouletteLobbyEmbed(game)],
        components: [createRouletteButtons()]
    }).catch(() => {});
}

async function rouletteStart(interaction) {
    const game = rouletteGames.get(interaction.guild.id);

    if (!game) {
        await interaction.reply({
            content: '❌ لا توجد لعبة روليت.',
            ephemeral: true
        });
        return;
    }

    if (
        game.hostId !== interaction.user.id &&
        !isAdmin(interaction.member)
    ) {
        await interaction.reply({
            content: '❌ فقط صاحب اللعبة أو الإدارة يستطيع بدء الروليت.',
            ephemeral: true
        });
        return;
    }

    if (game.phase !== 'lobby') {
        await interaction.reply({
            content: '❌ اللعبة بدأت بالفعل.',
            ephemeral: true
        });
        return;
    }

    if (game.players.length < 2) {
        await interaction.reply({
            content: '❌ تحتاج الروليت إلى لاعبين على الأقل.',
            ephemeral: true
        });
        return;
    }

    game.phase = 'spinning';
    game.started = true;

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setTitle('🎰 عجلة الروليت')
                .setDescription(
                    '🎡 **بدأت اللعبة!**\n\n' +
                    `👥 عدد اللاعبين: **${game.players.length}/${getRouletteMaxPlayers()}**\n\n` +
                    '⏳ جاري تشغيل العجلة...'
                )
                .setColor(0xE67E22)
        ],
        components: []
    });

    await runRouletteSpin(interaction.guild, interaction.message, game);
}

async function validateRouletteActor(interaction) {
    const game = rouletteGames.get(interaction.guild.id);

    if (!game) {
        await interaction.reply({
            content: '❌ لا توجد لعبة روليت نشطة.',
            ephemeral: true
        });
        return null;
    }

    if (!['action', 'targeting'].includes(game.phase)) {
        await interaction.reply({
            content: '❌ لا يوجد دور ينتظر اختيار إجراء الآن.',
            ephemeral: true
        });
        return null;
    }

    if (interaction.user.id !== game.selectedPlayer) {
        await interaction.reply({
            content: `❌ هذا الدور خاص بـ <@${game.selectedPlayer}> فقط.`,
            ephemeral: true
        });
        return null;
    }

    return game;
}

async function showRouletteTargetMenu(interaction, game, action) {
    const cost = getRouletteActionCost(action);

    if (cost && !(await rouletteCheckBalance(interaction, action))) {
        return;
    }

    let menu = null;
    let title = '🎯 اختر اللاعب';
    let description = cost
        ? `💳 تكلفة الإجراء: **${formatZom(cost)} ZOM**\n` +
          'لن يتم الخصم إلا بعد نجاح تنفيذ الإجراء.'
        : 'اختر الهدف لتنفيذ الإجراء.';

    if (action === 'kick') {
        const ids = game.players.filter(id => id !== game.selectedPlayer);
        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_kick')
            .setPlaceholder('👢 اختر لاعبًا لطرده')
            .addOptions(roulettePlayerOptions(interaction.guild, ids, 'إخراج اللاعب من الروليت'));
    }

    if (action === 'revive') {
        if (!game.deadPlayers.length) {
            await interaction.reply({
                content: '❌ لا يوجد لاعب ميت يمكن إنعاشه.',
                ephemeral: true
            });
            return;
        }

        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_revive')
            .setPlaceholder('💎 اختر لاعبًا لإنعاشه')
            .addOptions(roulettePlayerOptions(interaction.guild, game.deadPlayers, 'إرجاع اللاعب إلى اللعبة'));
    }

    if (action === 'link') {
        if (game.players.length < 2) {
            await interaction.reply({
                content: '❌ لا يوجد عدد كافٍ من اللاعبين للربط.',
                ephemeral: true
            });
            return;
        }

        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_link')
            .setPlaceholder('🔗 اختر لاعبين للربط')
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(roulettePlayerOptions(interaction.guild, game.players, 'اختيار للربط'));
    }

    if (action === 'protect') {
        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_protect')
            .setPlaceholder('🛡️ اختر لاعبًا لحمايته')
            .addOptions(roulettePlayerOptions(interaction.guild, game.players, 'حماية من عملية إخراج واحدة'));
    }

    if (action === 'freeze') {
        const ids = game.players.filter(id => id !== game.selectedPlayer);
        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_freeze')
            .setPlaceholder('🧊 اختر لاعبًا لتجميده')
            .addOptions(roulettePlayerOptions(interaction.guild, ids, 'تجميد اللاعب لمدة 3 أدوار'));
    }

    if (action === 'double') {
        const ids = game.players.filter(id => id !== game.selectedPlayer);
        if (ids.length < 2) {
            await interaction.reply({
                content: '❌ تحتاج إلى لاعبين آخرين على الأقل لتنفيذ هذا الإجراء.',
                ephemeral: true
            });
            return;
        }

        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_double')
            .setPlaceholder('💀 اختر لاعبين لإخراجهما')
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(roulettePlayerOptions(interaction.guild, ids, 'إخراج اللاعب بنفس الدور'));
    }

    if (action === 'curse') {
        const ids = game.players.filter(id => id !== game.selectedPlayer);
        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_curse')
            .setPlaceholder('🪄 اختر لاعبًا لسحره')
            .addOptions(roulettePlayerOptions(interaction.guild, ids, 'إلغاء دوره القادم عند اختياره'));
    }

    if (action === 'unlink') {
        if (!game.links.length) {
            await interaction.reply({
                content: '❌ لا يوجد ربط حاليًا.',
                ephemeral: true
            });
            return;
        }

        const options = game.links.slice(0, 25).map(([a, b]) => ({
            label: `${getRouletteMemberName(interaction.guild, a)} ↔ ${getRouletteMemberName(interaction.guild, b)}`.slice(0, 100),
            description: 'فك هذا الربط'.slice(0, 100),
            value: `${a}:${b}`,
            emoji: '🔓'
        }));

        menu = new StringSelectMenuBuilder()
            .setCustomId('roulette_target_unlink')
            .setPlaceholder('🔓 اختر الربط الذي تريد فكه')
            .addOptions(options);
    }

    if (action === 'add') {
        if (game.players.length >= getRouletteMaxPlayers()) {
            await interaction.reply({
                content: '❌ اللعبة وصلت للحد الأقصى من اللاعبين.',
                ephemeral: true
            });
            return;
        }

        title = '➕ إضافة لاعب';
        menu = new UserSelectMenuBuilder()
            .setCustomId('roulette_target_add')
            .setPlaceholder('➕ اختر عضوًا جديدًا لإضافته')
            .setMinValues(1)
            .setMaxValues(1);
    }

    if (!menu) {
        await interaction.reply({
            content: '❌ تعذر تجهيز هذا الإجراء.',
            ephemeral: true
        });
        return;
    }

    game.phase = 'targeting';
    game.pendingAction = action;

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setTitle(title)
                .setDescription(
                    `${description}\n\n` +
                    `🎯 صاحب الدور: <@${game.selectedPlayer}>\n` +
                    `⏳ الوقت المتبقي محسوب من مهلة **${getRouletteTurnSeconds()} ثانية**.`
                )
                .setColor(0x5865F2)
        ],
        components: [
            new ActionRowBuilder().addComponents(menu),
            createRouletteBackRow()
        ]
    });
}

async function handleRouletteActionButton(interaction) {
    const game = await validateRouletteActor(interaction);
    if (!game) return;

    const action = interaction.customId.replace('roulette_action_', '');

    if (action === 'back') {
        game.phase = 'action';
        game.pendingAction = null;

        await interaction.update({
            embeds: [buildRouletteActionEmbed(game, interaction.guild)],
            components: createRouletteActionRows(game)
        });
        return;
    }

    if (game.phase !== 'action') {
        await interaction.reply({
            content: '❌ أكمل الاختيار الحالي أو اضغط **رجوع للإجراءات**.',
            ephemeral: true
        });
        return;
    }

    if (action === 'random') {
        const candidates = game.players.filter(id => id !== game.selectedPlayer);
        if (!candidates.length) {
            await interaction.reply({
                content: '❌ لا يوجد لاعب آخر يمكن طرده.',
                ephemeral: true
            });
            return;
        }

        const target = randomItem(candidates);
        const result = eliminateRoulettePlayers(game, [target]);

        await finishRouletteTurn(
            interaction,
            game,
            `🎲 تم اختيار لاعب عشوائي.\n\n${formatRouletteResult(result)}`
        );
        return;
    }

    if (action === 'leave_turn') {
        const actor = game.selectedPlayer;
        const linkedPairsBefore = game.links.filter(pair => pair.includes(actor));

        eliminateRoulettePlayers(
            game,
            [actor],
            {
                revivable: false,
                useProtection: false,
                cascadeLinks: false
            }
        );

        // الانسحاب لا يقتل اللاعب المرتبط معه؛ يتم فقط فك أي ربط له.
        if (linkedPairsBefore.length) {
            removeRouletteLinksFor(game, actor);
        }

        await finishRouletteTurn(
            interaction,
            game,
            `🚪 انسحب <@${actor}> من الروليت طوعًا.`
        );
        return;
    }

    const menuActions = [
        'kick',
        'revive',
        'link',
        'protect',
        'freeze',
        'double',
        'curse',
        'unlink',
        'add'
    ];

    if (menuActions.includes(action)) {
        await showRouletteTargetMenu(interaction, game, action);
        return;
    }

    await interaction.reply({
        content: '❌ الإجراء غير معروف.',
        ephemeral: true
    });
}

async function restoreRouletteActionPanelAfterFailure(interaction, game, message) {
    game.phase = 'action';
    game.pendingAction = null;

    await message.edit({
        embeds: [buildRouletteActionEmbed(game, interaction.guild)],
        components: createRouletteActionRows(game)
    }).catch(() => {});
}

async function handleRouletteTargetSelect(interaction) {
    const game = await validateRouletteActor(interaction);
    if (!game) return;

    if (game.phase !== 'targeting') {
        await interaction.reply({
            content: '❌ لا يوجد اختيار هدف نشط الآن.',
            ephemeral: true
        });
        return;
    }

    const action = interaction.customId.replace('roulette_target_', '');
    if (game.pendingAction !== action) {
        await interaction.reply({
            content: '❌ هذا الاختيار قديم أو لم يعد صالحًا.',
            ephemeral: true
        });
        return;
    }

    const values = interaction.values || [];
    let resultText = '';

    // ---------------------- طرد لاعب ----------------------
    if (action === 'kick') {
        const target = values[0];
        if (!target || !game.players.includes(target) || target === game.selectedPlayer) {
            await interaction.reply({ content: '❌ اختيار اللاعب غير صالح.', ephemeral: true });
            return;
        }

        const result = eliminateRoulettePlayers(game, [target]);
        await finishRouletteTurn(
            interaction,
            game,
            `👢 تم تنفيذ **طرد لاعب**.\n\n${formatRouletteResult(result)}`
        );
        return;
    }

    // ---------------------- إنعاش ----------------------
    if (action === 'revive') {
        const target = values[0];
        if (!target || !game.deadPlayers.includes(target)) {
            await interaction.reply({ content: '❌ هذا اللاعب غير متاح للإنعاش.', ephemeral: true });
            return;
        }

        if (game.players.length >= getRouletteMaxPlayers()) {
            await interaction.reply({ content: '❌ لا يمكن الإنعاش لأن اللعبة ممتلئة.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({
                content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`,
                ephemeral: true
            });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.deadPlayers = game.deadPlayers.filter(id => id !== target);
        game.players.push(target);

        resultText = `💎 تم إنعاش <@${target}> وإعادته إلى اللعبة.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- ربط لاعبين ----------------------
    if (action === 'link') {
        const [a, b] = values;
        if (!a || !b || a === b || !game.players.includes(a) || !game.players.includes(b)) {
            await interaction.reply({ content: '❌ يجب اختيار لاعبين صالحين.', ephemeral: true });
            return;
        }

        if (isRouletteLinked(game, a) || isRouletteLinked(game, b)) {
            await interaction.reply({
                content: '❌ أحد اللاعبين مرتبط مسبقًا. فك الربط أولًا.',
                ephemeral: true
            });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.links.push([a, b]);
        resultText = `🔗 تم ربط <@${a}> مع <@${b}>. إذا خرج أحدهما سيخرج الآخر معه.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- حماية ----------------------
    if (action === 'protect') {
        const target = values[0];
        if (!target || !game.players.includes(target)) {
            await interaction.reply({ content: '❌ اختيار اللاعب غير صالح.', ephemeral: true });
            return;
        }

        if (game.protectedPlayers[target]) {
            await interaction.reply({ content: '⚠️ هذا اللاعب محمي بالفعل.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.protectedPlayers[target] = true;
        resultText = `🛡️ حصل <@${target}> على حماية من **عملية إخراج واحدة**.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- تجميد ----------------------
    if (action === 'freeze') {
        const target = values[0];
        if (!target || !game.players.includes(target) || target === game.selectedPlayer) {
            await interaction.reply({ content: '❌ اختيار اللاعب غير صالح.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.frozenUntil[target] = game.turnNumber + 3;
        resultText = `🧊 تم تجميد <@${target}> لمدة **3 أدوار قادمة**.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- قتل لاعبين ----------------------
    if (action === 'double') {
        const [a, b] = values;
        if (
            !a || !b || a === b ||
            a === game.selectedPlayer || b === game.selectedPlayer ||
            !game.players.includes(a) || !game.players.includes(b)
        ) {
            await interaction.reply({ content: '❌ يجب اختيار لاعبين آخرين صالحين.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        const result = eliminateRoulettePlayers(game, [a, b]);
        resultText = `💀 تم تنفيذ **قتل لاعبين**.\n\n${formatRouletteResult(result)}`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- سحر ----------------------
    if (action === 'curse') {
        const target = values[0];
        if (!target || !game.players.includes(target) || target === game.selectedPlayer) {
            await interaction.reply({ content: '❌ اختيار اللاعب غير صالح.', ephemeral: true });
            return;
        }

        if (game.cursedPlayers.includes(target)) {
            await interaction.reply({ content: '⚠️ هذا اللاعب مسحور بالفعل.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.cursedPlayers.push(target);
        resultText = `🪄 تم سحر <@${target}>. سيتم إلغاء دوره القادم عندما تختاره العجلة.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    // ---------------------- فك الربط ----------------------
    if (action === 'unlink') {
        const value = values[0] || '';
        const [a, b] = value.split(':');
        const pairIndex = game.links.findIndex(
            pair =>
                (pair[0] === a && pair[1] === b) ||
                (pair[0] === b && pair[1] === a)
        );

        if (pairIndex === -1) {
            await interaction.reply({ content: '❌ هذا الربط لم يعد موجودًا.', ephemeral: true });
            return;
        }

        const spend = rouletteSpend(interaction.user.id, action);
        if (!spend.ok) {
            await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`, ephemeral: true });
            await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
            return;
        }

        game.links.splice(pairIndex, 1);
        resultText = `🔓 تم فك الربط بين <@${a}> و <@${b}>.`;
        await finishRouletteTurn(interaction, game, resultText, spend.cost);
        return;
    }

    await interaction.reply({
        content: '❌ هذا الإجراء غير معروف.',
        ephemeral: true
    });
}

async function handleRouletteAddUserSelect(interaction) {
    const game = await validateRouletteActor(interaction);
    if (!game) return;

    if (game.phase !== 'targeting' || game.pendingAction !== 'add') {
        await interaction.reply({
            content: '❌ لا يوجد إجراء إضافة لاعب نشط الآن.',
            ephemeral: true
        });
        return;
    }

    const targetId = interaction.values?.[0];
    if (!targetId) {
        await interaction.reply({ content: '❌ لم يتم اختيار عضو.', ephemeral: true });
        return;
    }

    const member = await interaction.guild.members.fetch(targetId).catch(() => null);

    if (!member || member.user.bot) {
        await interaction.reply({
            content: '❌ لا يمكن إضافة هذا الحساب إلى الروليت.',
            ephemeral: true
        });
        return;
    }

    if (game.players.length >= getRouletteMaxPlayers()) {
        await interaction.reply({
            content: '❌ اللعبة وصلت للحد الأقصى من اللاعبين.',
            ephemeral: true
        });
        return;
    }

    if (
        game.players.includes(targetId) ||
        game.deadPlayers.includes(targetId) ||
        game.everPlayers.includes(targetId)
    ) {
        await interaction.reply({
            content:
                '❌ يجب اختيار عضو **لم يشارك في هذه اللعبة من قبل**.\n' +
                'إذا كان اللاعب قد خرج، استخدم **إنعاش لاعب** بدلًا من الإضافة.',
            ephemeral: true
        });
        return;
    }

    const spend = rouletteSpend(interaction.user.id, 'add');
    if (!spend.ok) {
        await interaction.reply({
            content: `❌ رصيدك غير كافٍ. تحتاج **${formatZom(spend.cost)} ZOM**.`,
            ephemeral: true
        });
        await restoreRouletteActionPanelAfterFailure(interaction, game, interaction.message);
        return;
    }

    game.players.push(targetId);
    game.everPlayers.push(targetId);

    await finishRouletteTurn(
        interaction,
        game,
        `➕ تمت إضافة <@${targetId}> إلى الروليت بنجاح.`,
        spend.cost
    );
}

// ==========================================================
// 🌐 ROULETTE DASHBOARD CONTROL
// ==========================================================

function getRouletteDashboardStatus() {
    const game = rouletteGames.get(ALLOWED_GUILD_ID);

    if (!game) {
        return {
            enabled: Boolean(ROULETTE_ENABLED),
            active: false,
            players: 0,
            maxPlayers: getRouletteMaxPlayers(),
            turnSeconds: getRouletteTurnSeconds(),
            phase: 'idle'
        };
    }

    return {
        enabled: Boolean(ROULETTE_ENABLED),
        active: true,
        players: game.players.length,
        maxPlayers: getRouletteMaxPlayers(),
        turnSeconds: getRouletteTurnSeconds(),
        phase: game.phase,
        channelId: game.channelId,
        hostId: game.hostId,
        selectedPlayer: game.selectedPlayer || null,
        turnNumber: Number(game.turnNumber || 0)
    };
}

async function stopActiveRouletteFromDashboard() {
    const game = rouletteGames.get(ALLOWED_GUILD_ID);

    if (!game) {
        return getRouletteDashboardStatus();
    }

    clearRouletteTimers(game);
    rouletteGames.delete(ALLOWED_GUILD_ID);

    const guild = client.guilds.cache.get(ALLOWED_GUILD_ID);
    const channel = guild?.channels.cache.get(game.channelId);

    if (channel && game.messageId) {
        const rouletteMessage = await channel.messages.fetch(game.messageId).catch(() => null);
        if (rouletteMessage) {
            await rouletteMessage.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🛑 تم إيقاف الروليت')
                        .setDescription('تم إيقاف اللعبة من **لوحة التحكم** بواسطة الإدارة.')
                        .setColor(0xE74C3C)
                ],
                components: []
            }).catch(() => {});
        }
    }

    if (channel) {
        await channel.send('🛑 تم إيقاف لعبة الروليت من لوحة التحكم.').catch(() => {});
    }

    return getRouletteDashboardStatus();
}

// ==========================================================
// 🛒 STORE
// ==========================================================

async function showStore(source) {

    const products =
        Object.values(
            shopProducts
        );

    if (
        !products.length
    ) {

        await source.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🛒 متجر ZOM'
                    )

                    .setDescription(
                        '❌ المتجر فارغ حاليًا.'
                    )

                    .setColor(
                        0x95A5A6
                    )

            ]

        });

        return;

    }

    const displayedProducts =
        products.slice(
            0,
            25
        );

    const options =
        displayedProducts.map(
            product => ({

                label:
                    String(
                        product.name ||
                        'منتج'
                    )
                        .substring(
                            0,
                            100
                        ),

                description:
                    `السعر: ${formatZom(product.price)} ZOM`
                        .substring(
                            0,
                            100
                        ),

                value:
                    String(
                        product.id
                    )

            })
        );

    const menu =
        new StringSelectMenuBuilder()

            .setCustomId(
                'store_select'
            )

            .setPlaceholder(
                'اختر منتجًا للشراء'
            )

            .addOptions(
                options
            );

    await source.reply({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🛒 متجر ZOM'
                )

                .setDescription(

                    displayedProducts

                        .map(
                            product =>
                                `🛍️ **${product.name}** — 💰 **${formatZom(product.price)} ZOM**`
                        )

                        .join(
                            '\n'
                        )

                    +

                    (
                        products.length >
                        25

                            ?

                            `\n\n⚠️ يتم عرض أول **25** منتجًا من أصل **${products.length}**.`

                            :

                            ''
                    )

                )

                .setColor(
                    0x3498DB
                )

                .setFooter({

                    text:
                        'اختر المنتج من القائمة بالأسفل'

                })

        ],

        components: [

            new ActionRowBuilder()
                .addComponents(
                    menu
                )

        ]

    });

}

// ==========================================================
// 🛒 شراء منتج
// ==========================================================

async function buyProduct(
    interaction
) {

    await interaction.deferReply({

        ephemeral:
            true

    }).catch(
        () => null
    );

    try {

        const productId =
            interaction.values?.[0];

        if (
            !productId
        ) {

            await interaction.editReply({

                content:
                    '❌ لم يتم تحديد المنتج.'

            });

            return;

        }

        const product =
            shopProducts[
                productId
            ];

        if (
            !product
        ) {

            await interaction.editReply({

                content:
                    '❌ المنتج غير موجود.'

            });

            return;

        }

        const user =
            getUser(
                interaction.user.id
            );

        const price =
            Number(
                product.price
            );

        if (

            !Number.isFinite(
                price
            )

            ||

            price <= 0

        ) {

            await interaction.editReply({

                content:
                    '❌ سعر المنتج غير صالح.'

            });

            return;

        }

        if (
            user.balance <
            price
        ) {

            await interaction.editReply({

                content:

                    '❌ رصيدك غير كافٍ.\n\n' +

                    `💰 رصيدك: **${formatZom(user.balance)} ZOM**\n` +

                    `🏷️ السعر: **${formatZom(price)} ZOM**`

            });

            return;

        }

        // ==================================================
        // 🎭 شراء رتبة
        // ==================================================

        if (
            product.type ===
            'role'
        ) {

            const role =
                interaction.guild
                    ?.roles
                    .cache
                    .get(
                        String(
                            product.roleId
                        )
                    );

            if (
                !role
            ) {

                await interaction.editReply({

                    content:
                        '❌ الرتبة لم تعد موجودة في السيرفر.'

                });

                return;

            }

            const member =
                await interaction.guild
                    .members
                    .fetch(
                        interaction.user.id
                    )
                    .catch(
                        () => null
                    );

            if (
                !member
            ) {

                await interaction.editReply({

                    content:
                        '❌ تعذر الوصول إلى عضويتك بالسيرفر.'

                });

                return;

            }

            if (
                member.roles.cache.has(
                    role.id
                )
            ) {

                await interaction.editReply({

                    content:
                        '⚠️ أنت تملك هذه الرتبة بالفعل.'

                });

                return;

            }

            // ==================================================
            // التأكد من أن البوت يستطيع إعطاء الرتبة
            // ==================================================

            if (
                !role.editable
            ) {

                await interaction.editReply({

                    content:

                        '❌ البوت لا يستطيع إعطاء هذه الرتبة.\n\n' +

                        'تأكد أن رتبة البوت أعلى من رتبة المتجر.'

                });

                return;

            }

            // ==================================================
            // إعطاء الرتبة أولًا
            // ثم الخصم بعد نجاح العملية
            // ==================================================

            await member.roles.add(

                role,

                `شراء من متجر ZOM: ${product.name}`

            );

            user.balance -=
                price;

            user.purchases.push({

                productId:
                    product.id,

                name:
                    product.name,

                price,

                purchasedAt:
                    Date.now()

            });

            saveEconomy();

            await interaction.editReply({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            '✅ تمت عملية الشراء'
                        )

                        .setDescription(

                            `🎁 المنتج: **${product.name}**\n\n` +

                            `🎭 الرتبة: **${role.name}**\n\n` +

                            `💰 السعر: **${formatZom(price)} ZOM**\n\n` +

                            `💵 رصيدك الجديد: **${formatZom(user.balance)} ZOM**`

                        )

                        .setColor(
                            0x2ECC71
                        )

                ]

            });

            return;

        }

        // ==================================================
        // نوع منتج غير مدعوم
        // ==================================================

        await interaction.editReply({

            content:
                `❌ نوع المنتج غير مدعوم: **${product.type || 'غير محدد'}**`

        });

    } catch (
        error
    ) {

        console.error(
            '❌ خطأ أثناء شراء المنتج:',
            error
        );

        await interaction.editReply({

            content:

                '❌ حدث خطأ أثناء تنفيذ عملية الشراء.\n' +

                'راجع CMD لمعرفة تفاصيل الخطأ.'

        }).catch(
            () => {}
        );

    }

}

// ==========================================================
// 💰 ECONOMY SLASH COMMANDS
// ==========================================================

async function handleEconomyCommand(
    interaction
) {

    const command =
        interaction.commandName;

    const userId =
        interaction.user.id;

    const user =
        getUser(
            userId
        );

    // ======================================================
    // 💰 /balance
    // ======================================================

    if (
        command ===
        'balance'
    ) {

        const target =
            interaction.options
                .getUser(
                    'user'
                )

            ||

            interaction.user;

        const targetUser =
            getUser(
                target.id
            );

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '💰 رصيد ZOM'
                    )

                    .setDescription(

                        `👤 المستخدم: <@${target.id}>\n\n` +

                        `💵 الرصيد: **${formatZom(targetUser.balance)} ZOM**`

                    )

                    .setColor(
                        0xF1C40F
                    )

            ]

        });

        return;

    }

    // ======================================================
    // 🎁 /daily
    // ======================================================

    if (
        command ===
        'daily'
    ) {

        const now =
            Date.now();

        const remaining =

            DAILY_COOLDOWN

            -

            (
                now -
                Number(
                    user.lastDaily ||
                    0
                )
            );

        if (
            remaining >
            0
        ) {

            await interaction.reply({

                content:
                    `⏳ يمكنك استلام مكافأة الـ Daily بعد **${formatDuration(remaining)}**.`,

                ephemeral:
                    true

            });

            return;

        }

        user.balance +=
            DAILY_REWARD;

        user.lastDaily =
            now;

        saveEconomy();

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🎁 Daily'
                    )

                    .setDescription(

                        '🎉 حصلت على مكافأتك اليومية!\n\n' +

                        `💰 المكافأة: **${formatZom(DAILY_REWARD)} ZOM**\n` +

                        `💵 رصيدك الجديد: **${formatZom(user.balance)} ZOM**`

                    )

                    .setColor(
                        0x2ECC71
                    )

            ]

        });

        return;

    }

    // ======================================================
    // 💸 /pay
    // ======================================================

    if (
        command ===
        'pay'
    ) {

        const target =
            interaction.options
                .getUser(
                    'user'
                );

        const amount =
            interaction.options
                .getInteger(
                    'amount'
                );

        if (
            !target
        ) {

            await interaction.reply({

                content:
                    '❌ يجب تحديد المستخدم.',

                ephemeral:
                    true

            });

            return;

        }

        // ==================================================
        // منع التحويل للبوت
        // ==================================================

        if (
            target.bot
        ) {

            await interaction.reply({

                content:
                    '❌ لا يمكنك تحويل ZOM إلى بوت.',

                ephemeral:
                    true

            });

            return;

        }

        // ==================================================
        // منع التحويل لنفسك
        // ==================================================

        if (
            target.id ===
            userId
        ) {

            await interaction.reply({

                content:
                    '❌ لا يمكنك تحويل المال إلى نفسك.',

                ephemeral:
                    true

            });

            return;

        }

        // ==================================================
        // التحقق من المبلغ
        // ==================================================

        if (

            !Number.isInteger(
                amount
            )

            ||

            amount <= 0

        ) {

            await interaction.reply({

                content:
                    '❌ قيمة التحويل غير صالحة.',

                ephemeral:
                    true

            });

            return;

        }

        // ==================================================
        // حماية Spam
        // ==================================================

        const lastTransfer =
            transferCooldowns.get(
                userId
            ) ||
            0;

        if (
            Date.now() -
            lastTransfer <
            5000
        ) {

            await interaction.reply({

                content:
                    '⏳ انتظر قليلًا قبل إجراء تحويل آخر.',

                ephemeral:
                    true

            });

            return;

        }

        // ==================================================
        // الرصيد
        // ==================================================

        if (
            user.balance <
            amount
        ) {

            await interaction.reply({

                content:

                    '❌ رصيدك غير كافٍ.\n' +

                    `💰 رصيدك: **${formatZom(user.balance)} ZOM**`,

                ephemeral:
                    true

            });

            return;

        }

        const receiver =
            getUser(
                target.id
            );

        user.balance -=
            amount;

        receiver.balance +=
            amount;

        transferCooldowns.set(
            userId,
            Date.now()
        );

        saveEconomy();

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '💸 تحويل ZOM'
                    )

                    .setDescription(

                        `👤 المرسل: <@${userId}>\n` +

                        `👤 المستلم: <@${target.id}>\n\n` +

                        `💰 المبلغ: **${formatZom(amount)} ZOM**\n\n` +

                        `💳 رصيدك الجديد: **${formatZom(user.balance)} ZOM**`

                    )

                    .setColor(
                        0x3498DB
                    )

            ]

        });

        return;

    }

    // ======================================================
    // 🏆 /rank
    // ======================================================

    if (
        command ===
        'rank'
    ) {

        const sorted =
            Object.entries(
                economy
            )

                .sort(
                    (a, b) =>

                        Number(
                            b[1]
                                ?.balance ||
                            0
                        )

                        -

                        Number(
                            a[1]
                                ?.balance ||
                            0
                        )
                );

        const position =

            sorted.findIndex(

                ([id]) =>
                    id ===
                    userId

            )

            +

            1;

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏆 رتبتك في الاقتصاد'
                    )

                    .setDescription(

                        `👤 المستخدم: <@${userId}>\n\n` +

                        `📊 الترتيب: **${
                            position
                                ?
                                `#${position}`
                                :
                                'غير مصنف'
                        }**\n` +

                        `💰 الرصيد: **${formatZom(user.balance)} ZOM**`

                    )

                    .setColor(
                        0x9B59B6
                    )

            ]

        });

        return;

    }

    // ======================================================
    // 🏆 /leaderboard
    // ======================================================

    if (
        command ===
        'leaderboard'
    ) {

        const sorted =
            Object.entries(
                economy
            )

                .sort(
                    (a, b) =>

                        Number(
                            b[1]
                                ?.balance ||
                            0
                        )

                        -

                        Number(
                            a[1]
                                ?.balance ||
                            0
                        )
                )

                .slice(
                    0,
                    10
                );

        if (
            !sorted.length
        ) {

            await interaction.reply({

                content:
                    '❌ لا توجد بيانات اقتصاد حاليًا.'

            });

            return;

        }

        const description =

            sorted

                .map(

                    (
                        [
                            id,
                            data
                        ],
                        index
                    ) =>

                        `**${index + 1}.** <@${id}> — 💰 **${formatZom(data.balance || 0)} ZOM**`

                )

                .join(
                    '\n'
                );

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏆 ZOM Leaderboard'
                    )

                    .setDescription(
                        description
                    )

                    .setColor(
                        0xF1C40F
                    )

            ]

        });

        return;

    }

    // ======================================================
    // 🎒 /inventory
    // ======================================================

    if (
        command ===
        'inventory'
    ) {

        const items =
            user.purchases;

        if (
            !items.length
        ) {

            await interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            '🎒 Inventory'
                        )

                        .setDescription(
                            '🎒 لا تملك أي مشتريات حاليًا.'
                        )

                        .setColor(
                            0x95A5A6
                        )

                ]

            });

            return;

        }

        const description =

            items

                .slice(
                    -20
                )

                .reverse()

                .map(

                    (
                        item,
                        index
                    ) =>

                        `**${index + 1}.** ${item.name || 'منتج'} — 💰 ${formatZom(item.price || 0)} ZOM`

                )

                .join(
                    '\n'
                );

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🎒 Inventory'
                    )

                    .setDescription(
                        description
                    )

                    .setColor(
                        0x3498DB
                    )

            ]

        });

        return;

    }

}

// ==========================================================
// ⚙️ UTILITY COMMANDS
// ==========================================================

async function handleUtilityCommand(
    interaction
) {

    // ======================================================
    // 🏓 /ping
    // ======================================================

    if (
        interaction.commandName ===
        'ping'
    ) {

        const apiPing =
            Math.round(
                client.ws.ping
            );

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏓 Pong!'
                    )

                    .setDescription(

                        `📡 WebSocket: **${apiPing}ms**\n` +

                        `⏱️ Uptime: **${formatDuration(client.uptime || 0)}**`

                    )

                    .setColor(
                        0x2ECC71
                    )

            ],

            ephemeral:
                true

        });

        return true;

    }

    // ======================================================
    // 👤 /profile
    // ======================================================

    if (
        interaction.commandName ===
        'profile'
    ) {

        const target =
            interaction.options
                .getUser(
                    'user'
                )

            ||

            interaction.user;

        const targetData =
            getUser(
                target.id
            );

        const sorted =
            Object.entries(
                economy
            )

                .sort(
                    (a, b) =>

                        Number(
                            b[1]
                                ?.balance ||
                            0
                        )

                        -

                        Number(
                            a[1]
                                ?.balance ||
                            0
                        )
                );

        const position =

            sorted.findIndex(

                ([id]) =>
                    id ===
                    target.id

            )

            +

            1;

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        `👤 ملف ${target.username}`
                    )

                    .setThumbnail(

                        target.displayAvatarURL({

                            size:
                                256

                        })

                    )

                    .addFields(

                        {

                            name:
                                '💰 الرصيد',

                            value:
                                `${formatZom(targetData.balance)} ZOM`,

                            inline:
                                true

                        },

                        {

                            name:
                                '🏆 الترتيب',

                            value:

                                position

                                    ?

                                    `#${position}`

                                    :

                                    'غير مصنف',

                            inline:
                                true

                        },

                        {

                            name:
                                '🎒 المشتريات',

                            value:
                                String(
                                    targetData
                                        .purchases
                                        .length
                                ),

                            inline:
                                true

                        },

                        {

                            name:
                                '💬 تقدم مكافأة الرسائل',

                            value:
                                `${targetData.messageCount}/${MESSAGE_EVERY}`,

                            inline:
                                true

                        }

                    )

                    .setColor(
                        0x5865F2
                    )

            ]

        });

        return true;

    }

    // ======================================================
    // 📚 /help
    // ======================================================

    if (
        interaction.commandName ===
        'help'
    ) {

        await interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '📚 أوامر ZOM'
                    )

                    .setDescription(

                        '**💰 الاقتصاد**\n' +

                        '`/balance` `/daily` `/pay` `/rank` `/leaderboard` `/inventory` `/profile`\n\n' +

                        '**🛒 المتجر**\n' +

                        '`/store` أو اكتب `متجر`\n\n' +

                        '**🎮 الألعاب**\n' +

                        '`/games` أو لوحة `/admin games`\n\n' +

                        '**🛡️ الإدارة**\n' +

                        '`/admin` لإدارة الشات، الأعضاء، المتجر، ZOM والألعاب.\n\n' +

                        '**⚙️ أدوات**\n' +

                        '`/ping` `/help`\n\n' +

                        '**📝 الأوامر الكتابية القديمة محفوظة**\n' +

                        '`zom` `تحويل @عضو 100` `توب` `إضافةزوم` `خصمزوم` `تصفيرزوم` `!كراسي` `من القاتل` `خط` `ق` `ف` `إيقاف`'

                    )

                    .setColor(
                        0x5865F2
                    )

                    .setFooter({

                        text:
                            'ZOM Professional Bot'

                    })

            ],

            ephemeral:
                true

        });

        return true;

    }

    return false;

}

// ==========================================================
// 🛑 STOP ALL GAMES
// ==========================================================

async function stopAllGuildGames(guild, channelId = null, userId = null) {
    const stopped = [];

    if (activeGames.has(guild.id)) {
        stopped.push(
            getGameName(activeGames.get(guild.id).type)
        );

        unregisterGame(guild.id);
    }

    if (rpsGames.has(guild.id)) {
        const rpsGame = rpsGames.get(guild.id);
        clearRpsRoundTimer(rpsGame);
        stopped.push('حجر ورق مقص');
        rpsGames.delete(guild.id);
    }

    if (wheelGames.has(guild.id)) {
        const wheelGame = wheelGames.get(guild.id);
        if (wheelGame?.timeout) {
            clearTimeout(wheelGame.timeout);
            wheelGame.timeout = null;
        }
        stopped.push('عجلة الحظ');
        wheelGames.delete(guild.id);
    }

    if (rouletteGames.has(guild.id)) {
        const rouletteGame = rouletteGames.get(guild.id);
        clearRouletteTimers(rouletteGame);
        stopped.push('الروليت');
        rouletteGames.delete(guild.id);
    }

    if (mafiaGames.has(guild.id)) {
        const game = mafiaGames.get(guild.id);

        clearMafiaTimers(game);
        stopped.push('المافيا');
        mafiaGames.delete(guild.id);
    }

    if (channelId) {
        try {
            const chairsStopped =
                await stopChairsGame(channelId, userId);

            if (chairsStopped) {
                stopped.push('الكراسي');
            }
        } catch {}

        try {
            const killerStopped =
                await stopKillerGame(channelId);

            if (killerStopped) {
                stopped.push('من القاتل');
            }
        } catch {}
    }

    return [...new Set(stopped)];
}

// ==========================================================
// ADMIN
// ==========================================================

async function handleAdminCommand(interaction) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content:
                '❌ ليس لديك صلاحية استخدام هذا الأمر.',
            ephemeral: true
        });
        return;
    }

    const subcommand =
        interaction.options.getSubcommand();

    if (subcommand === 'games') {
        await interaction.reply(createGamesPanel());
        return;
    }

    if (subcommand === 'clear') {
        const amount =
            interaction.options.getInteger('amount');

        if (
            !interaction.channel ||
            !interaction.channel.isTextBased()
        ) {
            await interaction.reply({
                content:
                    '❌ لا يمكن حذف الرسائل هنا.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });

        try {
            const deleted =
                await interaction.channel.bulkDelete(
                    amount,
                    true
                );

            await interaction.editReply({
                content:
                    `🧹 تم حذف **${deleted.size}** رسالة.`
            });
        } catch (error) {
            console.error(
                '❌ خطأ في حذف الرسائل:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ حدث خطأ أثناء حذف الرسائل.'
            }).catch(() => {});
        }

        return;
    }

    if (subcommand === 'kick') {
        const user =
            interaction.options.getUser('user');

        const reason =
            interaction.options.getString('reason') ||
            `تم الطرد بواسطة ${interaction.user.tag}`;

        const member =
            await interaction.guild.members
                .fetch(user.id)
                .catch(() => null);

        if (!member) {
            await interaction.reply({
                content:
                    '❌ لم أتمكن من العثور على العضو.',
                ephemeral: true
            });
            return;
        }

        if (!member.kickable) {
            await interaction.reply({
                content:
                    '❌ لا أستطيع طرد هذا العضو. تأكد من ترتيب الرتب والصلاحيات.',
                ephemeral: true
            });
            return;
        }

        await member.kick(reason);

        await interaction.reply({
            content:
                `👢 تم طرد <@${user.id}> بنجاح.\n` +
                `📝 السبب: **${reason}**`
        });

        return;
    }

    if (subcommand === 'ban') {
        const user =
            interaction.options.getUser('user');

        const reason =
            interaction.options.getString('reason') ||
            `تم الحظر بواسطة ${interaction.user.tag}`;

        const member =
            await interaction.guild.members
                .fetch(user.id)
                .catch(() => null);

        if (member && !member.bannable) {
            await interaction.reply({
                content:
                    '❌ لا أستطيع حظر هذا العضو.',
                ephemeral: true
            });
            return;
        }

        await interaction.guild.members.ban(
            user.id,
            { reason }
        );

        await interaction.reply({
            content:
                `🔨 تم حظر <@${user.id}> بنجاح.\n` +
                `📝 السبب: **${reason}**`
        });

        return;
    }

    if (subcommand === 'lock') {
        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        await interaction.reply({
            content: '🔒 تم قفل الشات.'
        });

        return;
    }

    if (subcommand === 'unlock') {
        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: null
            }
        );

        await interaction.reply({
            content: '🔓 تم فتح الشات.'
        });

        return;
    }

    if (subcommand === 'addrole') {
        const role =
            interaction.options.getRole('role');

        const price =
            interaction.options.getInteger('price');

        const existing =
            Object.values(shopProducts).find(
                item =>
                    item.type === 'role' &&
                    item.roleId === role.id
            );

        if (existing) {
            await interaction.reply({
                content:
                    '⚠️ هذه الرتبة موجودة بالفعل في المتجر.\n' +
                    'استخدم `/admin setprice` لتعديل سعرها.',
                ephemeral: true
            });
            return;
        }

        const productId = createProductId();

        shopProducts[productId] = {
            id: productId,
            type: 'role',
            roleId: role.id,
            name: cleanProductName(role.name),
            price,
            createdAt: Date.now()
        };

        saveShop();

        await interaction.reply({
            content:
                `🛒 تمت إضافة الرتبة **${role.name}** إلى المتجر ` +
                `بسعر **${formatZom(price)} ZOM**.`
        });

        return;
    }

    if (subcommand === 'removerole') {
        const role =
            interaction.options.getRole('role');

        const product =
            Object.values(shopProducts).find(
                item =>
                    item.type === 'role' &&
                    item.roleId === role.id
            );

        if (!product) {
            await interaction.reply({
                content:
                    '❌ هذه الرتبة غير موجودة في المتجر.',
                ephemeral: true
            });
            return;
        }

        delete shopProducts[product.id];
        saveShop();

        await interaction.reply({
            content:
                `🗑️ تم حذف الرتبة **${role.name}** من المتجر.`
        });

        return;
    }

    if (subcommand === 'setprice') {
        const role =
            interaction.options.getRole('role');

        const price =
            interaction.options.getInteger('price');

        const product =
            Object.values(shopProducts).find(
                item =>
                    item.type === 'role' &&
                    item.roleId === role.id
            );

        if (!product) {
            await interaction.reply({
                content:
                    '❌ هذه الرتبة غير موجودة في المتجر.',
                ephemeral: true
            });
            return;
        }

        product.price = price;
        saveShop();

        await interaction.reply({
            content:
                `💰 تم تعديل سعر **${role.name}** إلى ` +
                `**${formatZom(price)} ZOM**.`
        });

        return;
    }

    if (
        subcommand === 'addzom' ||
        subcommand === 'removezom' ||
        subcommand === 'resetzom'
    ) {
        const target =
            interaction.options.getUser('user');

        const targetUser =
            getUser(target.id);

        if (subcommand === 'resetzom') {
            targetUser.balance = 0;
            saveEconomy();

            await interaction.reply({
                content:
                    `✅ تم تصفير رصيد <@${target.id}>.`
            });

            return;
        }

        const amount =
            interaction.options.getInteger('amount');

        if (subcommand === 'addzom') {
            targetUser.balance += amount;
        } else {
            targetUser.balance = Math.max(
                0,
                targetUser.balance - amount
            );
        }

        saveEconomy();

        await interaction.reply({
            content:
                `${subcommand === 'addzom' ? '✅ تمت إضافة' : '✅ تم خصم'} ` +
                `**${formatZom(amount)} ZOM** ` +
                `${subcommand === 'addzom' ? 'إلى' : 'من'} <@${target.id}>.\n` +
                `💰 الرصيد الحالي: **${formatZom(targetUser.balance)} ZOM**`
        });

        return;
    }

    if (subcommand === 'stopgame') {
        const stopped =
            await stopAllGuildGames(
                interaction.guild,
                interaction.channel.id,
                interaction.user.id
            );

        await interaction.reply({
            content:
                stopped.length
                    ? `🛑 تم إيقاف: **${stopped.join('، ')}**`
                    : '❌ لا توجد ألعاب نشطة حاليًا.',
            ephemeral: true
        });
    }
}

// ==========================================================
// CHAIRS / KILLER WRAPPERS
// ==========================================================

async function startChairs(interaction) {
    try {
        await createChairsGame(interaction);
    } catch (error) {
        console.error(
            '❌ خطأ في تشغيل لعبة الكراسي:',
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '❌ تعذر تشغيل لعبة الكراسي.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

async function startKiller(interaction) {
    try {
        await startKillerGame(interaction);
    } catch (error) {
        console.error(
            '❌ خطأ في تشغيل لعبة القاتل:',
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '❌ تعذر تشغيل لعبة القاتل.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

// ==========================================================
// /games ROUTER
// ==========================================================

async function handleGamesCommand(interaction) {
    await syncHomePublicGameSettings(true);
    if(!homeCanStartGames(interaction.member))return interaction.reply({content:'❌ تشغيل الألعاب غير مسموح لك. اختر الرتب المسموحة من Dashboard.',flags:64});

    const game =
        interaction.options.getString('game');

    if (!game) {
        await interaction.reply(createGamesPanel());
        return;
    }

    if (!homeGameEnabled(game)) {
        await interaction.reply({
            content: '❌ هذه اللعبة معطلة من Dashboard.',
            ephemeral: true
        });
        return;
    }

    if (game === 'rps') {
        await startRpsGame(interaction);
        return;
    }

    if (game === 'wheel') {
        await startWheel(interaction);
        return;
    }

    if (game === 'mafia') {
        await createMafia(interaction);
        return;
    }

    if (game === 'roulette') {
        await createRoulette(interaction);
        return;
    }

    if (game === 'chairs') {
        await startChairs(interaction);
        return;
    }

    if (game === 'killer') {
        await startKiller(interaction);
        return;
    }

    await startGame(interaction, game);
}

// ==========================================================
// MESSAGE HANDLER
// دمج جميع مستمعات messageCreate في مستمع واحد
// ==========================================================

client.on('messageCreate', async message => {
    try {

        // ==================================================
        // LEGACY HOME-GUILD GATE
        // الرسائل في السيرفرات العامة يعالجها publicSystem فقط.
        // ==================================================

        if (message.author.bot || !message.guild) {
            return;
        }

        if (!isAllowedGuild(message.guild)) {
            return;
        }

        if (await handleRemoveWarningMessage(message)) {
            return;
        }

        if (await handleWarningMessage(message)) {
            return;
        }

        const content =
            message.content.trim();

        // Premium text lock/unlock: ق = قفل، ف = فتح
        // يعمل في السيرفر الأساسي أيضًا، بنفس اشتراك Premium العام.
        if (await publicSystem.handlePremiumTextLock(message)) {
            return;
        }

        // إيقاف الألعاب بصيغة #ايقاف / #وقف في السيرفر الأساسي: يفحص النظام العام والقديم معًا.
        if (['#ايقاف','#إيقاف','#وقف','#stop','#stopgame'].includes(content.toLowerCase())) {
            if (!homeCanStartGames(message.member) && !isAdmin(message.member) && message.guild.ownerId !== message.author.id) {
                await message.reply('❌ إيقاف اللعبة متاح للمضيف/الرتب المسموحة أو إدارة السيرفر.');
                return;
            }
            const publicStopped = await publicSystem.stopGameKey(`${message.guild.id}:${message.channel.id}`).catch(() => []);
            const legacyStopped = await stopAllGuildGames(message.guild, message.channel.id, message.author.id).catch(() => []);
            const stopped = [...new Set([...(publicStopped || []).map(x => typeof x === 'string' ? x : String(x)), ...(legacyStopped || [])])];
            await message.reply(stopped.length ? `🛑 تم إيقاف: **${stopped.join('، ')}**` : 'ℹ️ لا توجد لعبة ZOMBI تعمل في هذا الروم.');
            return;
        }

        // تشغيل كل ألعاب ZOMBI بصيغة #اسم_اللعبة في السيرفر الأساسي أيضًا.
        if (await publicSystem.handleHashGameCommand(message)) {
            return;
        }

        if (looksLikeZombiTextCommand(content)) maybeHomePremiumPromo(message);

        if(content==='-العاب'||content==='-ألعاب') {
            await syncHomePublicGameSettings(true); if(!homeCanStartGames(message.member)) {await message.reply('❌ تشغيل الألعاب غير مسموح لك. اختر الرتب المسموحة من Dashboard.');return;}
            await syncHomePublicGameSettings(true);
            await message.reply(createGamesPanel());return;
        }

        // ==================================================
        // 💰 شات ZOM: رصيد + تحويل فقط
        // ==================================================

        try {
            if (await zomStore.handleMessage(message)) {
                return;
            }
        } catch (error) {
            console.error('❌ خطأ في أوامر شات ZOM:', error);
        }

        // ==================================================
        // 🎰 تشغيل الروليت بأمر #روليت
        // ==================================================

        if (
            content === '#روليت'
        ) {
            await createRouletteFromMessage(
                message
            );
            return;
        }

        // ==================================================
        // 🎙️ إعادة تسمية الرومات المؤقتة
        // ==================================================

        try {

            const renameHandled =
                await handleRenameMessage(
                    message
                );

            if (
                renameHandled
            ) {
                return;
            }

        } catch (
            error
        ) {

            console.error(
                '❌ خطأ في إعادة تسمية الروم:',
                error
            );

        }

        // ==================================================
        // 🏦 أوامر البنك
        // ==================================================

        try {

            if (/^(لوحة$|بنك(?:\s|$)|راتب$|نهب(?:\s|$)|إضافةبنك)/.test(content)) {
                const cfg = await require('./public/sharedStore').getConfig(message.guild.id);
                if(cfg.features?.bank === false) return;
                await require('./public/fullBank').get(message.guild.id,cfg,true);
            }
            if (
                await handleBankCommand(
                    message
                )
            ) {
                return;
            }

        } catch (
            error
        ) {

            console.error(
                '❌ خطأ في أمر البنك:',
                error
            );

        }

        // ==================================================
        // 🏴 العصابات + 🚨 سرقة البنك
        // ==================================================

        try {
            if (
                await gangMissions.handleMissionMessage(
                    message
                )
            ) {
                return;
            }

            if (
                await gangSystem.handleGangCommand(
                    message
                )
            ) {
                return;
            }

            if (
                await bankRobbery.handleRobberyMessage(
                    message
                )
            ) {
                return;
            }
        } catch (error) {
            console.error(
                '❌ خطأ في نظام ZOMBI City:',
                error
            );
        }

        // ==================================================
        // 🏆 نظام Levels
        // ==================================================

        try {

            if (
                await handleLevelCommand(
                    message
                )
            ) {
                return;
            }

            if (
                await handleLevelTop(
                    message
                )
            ) {
                return;
            }

        } catch (
            error
        ) {

            console.error(
                '❌ خطأ في نظام Levels:',
                error
            );

        }

        // ==================================================
        // 🛑 إيقاف الألعاب
        // ==================================================

        if (
            content ===
            'إيقاف'
        ) {

            if (
                !isAdmin(message.member) &&
                !homeCanStartGames(message.member) &&
                message.guild.ownerId !== message.author.id
            ) {

                await message.reply(
                    '❌ إيقاف اللعبة متاح للرتب المسموحة أو إدارة السيرفر.'
                );

                return;

            }

            const stopped =
                await stopAllGuildGames(
                    message.guild,
                    message.channel.id,
                    message.author.id
                );

            await message.reply(

                stopped.length

                    ?

                    `🛑 تم إيقاف: **${stopped.join('، ')}**`

                    :

                    '❌ لا توجد لعبة شغالة حاليًا.'

            );

            return;

        }

        // ==================================================
        // ➕ إضافة ZOM
        // ==================================================

        if (
            content.startsWith(
                'إضافةزوم'
            )
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionsBitField
                            .Flags
                            .Administrator
                    )
            ) {

                await message.reply(
                    '❌ هذا الأمر للإدارة فقط.'
                );

                return;

            }

            const args =
                content.split(
                    /\s+/
                );

            const member =
                message.mentions
                    .members
                    .first();

            const amount =
                Number(
                    args[2]
                );

            if (
                !member
            ) {

                await message.reply(

                    '❌ الاستخدام الصحيح:\n' +

                    '`إضافةزوم @العضو 100`'

                );

                return;

            }

            if (

                !Number.isFinite(
                    amount
                )

                ||

                amount <= 0

            ) {

                await message.reply(
                    '❌ اكتب مبلغًا صحيحًا أكبر من 0.'
                );

                return;

            }

            const user =
                getUser(
                    member.id
                );

            user.balance +=
                amount;

            saveEconomy();

            await message.reply(

                `✅ تمت إضافة **${formatZom(amount)} ZOM** إلى ${member}.\n` +

                `💰 الرصيد الجديد: **${formatZom(user.balance)} ZOM**`

            );

            return;

        }

        // ==================================================
        // ➖ خصم ZOM
        // ==================================================

        if (
            content.startsWith(
                'خصمزوم'
            )
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionsBitField
                            .Flags
                            .Administrator
                    )
            ) {

                await message.reply(
                    '❌ هذا الأمر للإدارة فقط.'
                );

                return;

            }

            const args =
                content.split(
                    /\s+/
                );

            const member =
                message.mentions
                    .members
                    .first();

            const amount =
                Number(
                    args[2]
                );

            if (
                !member
            ) {

                await message.reply(

                    '❌ الاستخدام الصحيح:\n' +

                    '`خصمزوم @العضو 100`'

                );

                return;

            }

            if (

                !Number.isFinite(
                    amount
                )

                ||

                amount <= 0

            ) {

                await message.reply(
                    '❌ اكتب مبلغًا صحيحًا أكبر من 0.'
                );

                return;

            }

            const user =
                getUser(
                    member.id
                );

            user.balance =
                Math.max(

                    0,

                    user.balance -
                    amount

                );

            saveEconomy();

            await message.reply(

                `✅ تم خصم **${formatZom(amount)} ZOM** من ${member}.\n` +

                `💰 الرصيد الجديد: **${formatZom(user.balance)} ZOM**`

            );

            return;

        }

        // ==================================================
        // 🔄 تصفير ZOM
        // ==================================================

        if (
            content.startsWith(
                'تصفيرزوم'
            )
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionsBitField
                            .Flags
                            .Administrator
                    )
            ) {

                await message.reply(
                    '❌ هذا الأمر للإدارة فقط.'
                );

                return;

            }

            const member =
                message.mentions
                    .members
                    .first();

            if (
                !member
            ) {

                await message.reply(

                    '❌ الاستخدام الصحيح:\n' +

                    '`تصفيرزوم @العضو`'

                );

                return;

            }

            const user =
                getUser(
                    member.id
                );

            user.balance =
                0;

            saveEconomy();

            await message.reply(

                `✅ تم تصفير رصيد ${member}.\n` +

                '💰 الرصيد الحالي: **0 ZOM**'

            );

            return;

        }

        // ==================================================
        // 🪑 لعبة الكراسي
        // ==================================================

        if (
            content ===
            '!كراسي'
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionFlagsBits
                            .Administrator
                    )
            ) {

                await message.delete()
                    .catch(
                        () => {}
                    );

                const warning =
                    await message.channel.send(

                        `${message.author} ❌ هذا الأمر مخصص للإدارة فقط.`

                    );

                setTimeout(
                    () => {

                        warning.delete()
                            .catch(
                                () => {}
                            );

                    },
                    3000
                );

                return;

            }

            try {

                await createChairsGame(
                    message
                );

            } catch (
                error
            ) {

                console.error(

                    '❌ خطأ في لعبة الكراسي:',

                    error

                );

                await message.reply(

                    '❌ حدث خطأ أثناء تشغيل لعبة الكراسي.'

                ).catch(
                    () => {}
                );

            }

            return;

        }

        // ==================================================
        // 🔪 من القاتل
        // ==================================================

        if (
            content ===
            'من القاتل'
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionFlagsBits
                            .Administrator
                    )
            ) {

                await message.delete()
                    .catch(
                        () => {}
                    );

                const warning =
                    await message.channel.send(

                        `${message.author} ❌ هذا الأمر مخصص للإدارة فقط.`

                    );

                setTimeout(
                    () => {

                        warning.delete()
                            .catch(
                                () => {}
                            );

                    },
                    3000
                );

                return;

            }

            try {

                await startKillerGame(
                    message
                );

            } catch (
                error
            ) {

                console.error(

                    '❌ خطأ في لعبة من القاتل:',

                    error

                );

                await message.reply(

                    '❌ حدث خطأ أثناء تشغيل لعبة من القاتل.'

                ).catch(
                    () => {}
                );

            }

            return;

        }

        // ==================================================
        // 🎮 الأمر القديم "لعبة"
        // ==================================================

        if (
            content ===
            'لعبة'
        ) {

            await startGame(

                {

                    guild:
                        message.guild,

                    channel:
                        message.channel,

                    user:
                        message.author,

                    reply:
                        async data =>
                            message.reply(
                                data
                            )

                },

                'quiz'

            );

            return;

        }

        // ==================================================
        // ➖ خط
        // ==================================================

        if (
            content ===
            'خط'
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionFlagsBits
                            .Administrator
                    )
            ) {

                await message.delete()
                    .catch(
                        () => {}
                    );

                const warning =
                    await message.channel.send(

                        `${message.author} ❌ هذا الأمر مخصص للإدارة فقط.`

                    );

                setTimeout(
                    () => {

                        warning.delete()
                            .catch(
                                () => {}
                            );

                    },
                    3000
                );

                return;

            }

            try {

                await message.delete()
                    .catch(
                        () => {}
                    );

                const linePath =
                    path.join(

                        __dirname,

                        'line.png'

                    );

                if (
                    !fs.existsSync(
                        linePath
                    )
                ) {

                    console.error(
                        '❌ line.png غير موجود'
                    );

                    return;

                }

                await message.channel.send({

                    files: [
                        linePath
                    ]

                });

            } catch (
                error
            ) {

                console.error(

                    '❌ خطأ بالخط:',

                    error

                );

            }

            return;

        }

        // ==================================================
        // 🔒 قفل
        // ==================================================

        if (
            content ===
            'ق'
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionsBitField
                            .Flags
                            .ManageChannels
                    )
            ) {

                return;

            }

            await message.channel
                .permissionOverwrites
                .edit(

                    message.guild.roles.everyone,

                    {

                        SendMessages:
                            false

                    }

                );

            await message.delete()
                .catch(
                    () => {}
                );

            return;

        }

        // ==================================================
        // 🔓 فتح
        // ==================================================

        if (
            content ===
            'ف'
        ) {

            if (
                !message.member
                    .permissions
                    .has(
                        PermissionsBitField
                            .Flags
                            .ManageChannels
                    )
            ) {

                return;

            }

            await message.channel
                .permissionOverwrites
                .edit(

                    message.guild.roles.everyone,

                    {

                        SendMessages:
                            null

                    }

                );

            await message.delete()
                .catch(
                    () => {}
                );

            return;

        }

        // ==================================================
        // 🎮 إجابات الألعاب السريعة
        // ==================================================

        const active =
            activeGames.get(
                message.guild.id
            );

        if (

            active

            &&

            active.channelId ===
            message.channel.id

            &&

            !active.resolving

        ) {

            // ==================================================
            // 🎯 الأقرب
            // ==================================================

            if (
                active.type ===
                'closest'
            ) {

                const number =
                    Number(
                        content
                    );

                if (

                    Number.isInteger(
                        number
                    )

                    &&

                    number >= 1

                    &&

                    number <= 100

                ) {

                    // اللاعب يشارك مرة واحدة فقط
                    if (
                        active.answeredUsers.has(
                            message.author.id
                        )
                    ) {

                        return;

                    }

                    active.answeredUsers.add(
                        message.author.id
                    );

                    active.answers.push({

                        userId:
                            message.author.id,

                        number

                    });

                    await message.react(
                        '🎯'
                    ).catch(
                        () => {}
                    );

                    // ==========================================
                    // بعد 3 لاعبين
                    // ==========================================

                    if (
                        active.answers.length >=
                        3
                    ) {

                        active.resolving =
                            true;

                        const winner =

                            [
                                ...active.answers
                            ]

                                .sort(

                                    (a, b) =>

                                        Math.abs(
                                            a.number -
                                            active.number
                                        )

                                        -

                                        Math.abs(
                                            b.number -
                                            active.number
                                        )

                                )[0];

                        await message.channel.send(

                            `🏆 الرقم كان **${active.number}**، ` +

                            `والأقرب هو <@${winner.userId}> بإجابة **${winner.number}**!`

                        );

                        await nextGameRound(

                            message.guild,

                            winner.userId

                        );

                    }

                }

                return;

            }

            // ==================================================
            // 🔢 التخمين
            // ==================================================

            if (
                active.type ===
                'guess'
            ) {

                const number =
                    Number(
                        content
                    );

                if (

                    !Number.isInteger(
                        number
                    )

                    ||

                    number < 1

                    ||

                    number > 20

                ) {

                    return;

                }

                if (
                    number ===
                    active.number
                ) {

                    active.resolving =
                        true;

                    await message.channel.send(

                        `🏆 <@${message.author.id}> خمن الرقم الصحيح **${active.number}**!`

                    );

                    await nextGameRound(

                        message.guild,

                        message.author.id

                    );

                }

                return;

            }

            // ==================================================
            // باقي الألعاب النصية
            // ==================================================

            if (

                active.answer

                &&

                normalizeAnswer(
                    content
                )

                ===

                normalizeAnswer(
                    active.answer
                )

            ) {

                active.resolving =
                    true;

                await message.channel.send(

                    `🏆 <@${message.author.id}> أجاب بشكل صحيح!`

                );

                await nextGameRound(

                    message.guild,

                    message.author.id

                );

                return;

            }

        }

        // ==================================================
        // 💬 مكافآت الرسائل
        // ==================================================

        if (
            message.channel.id ===
            MESSAGE_CHANNEL_ID
        ) {

            // منع الرسائل الفارغة جدًا
            if (
                content.length <
                2
            ) {

                return;

            }

            const now =
                Date.now();

            const last =
                messageCooldowns.get(
                    message.author.id
                )
                ||
                0;

            // ==================================================
            // Cooldown للرسائل
            // ==================================================

            if (

                now -
                last

                <

                MESSAGE_REWARD_COOLDOWN

            ) {

                return;

            }

            messageCooldowns.set(

                message.author.id,

                now

            );

            const user =
                getUser(
                    message.author.id
                );

            user.messageCount++;

            // ==================================================
            // وصل للعدد المطلوب
            // ==================================================

            if (
                user.messageCount >=
                MESSAGE_EVERY
            ) {

                const times =
                    Math.floor(

                        user.messageCount

                        /

                        MESSAGE_EVERY

                    );

                const reward =
                    times *
                    MESSAGE_REWARD;

                user.messageCount %= 
                    MESSAGE_EVERY;

                user.balance +=
                    reward;

                saveEconomy();

                // ==================================================
                // Reaction
                // ==================================================

                await message.react(
                    '💰'
                ).catch(
                    () => {}
                );

                // ==================================================
                // رسالة خاصة
                // ==================================================

                await message.author.send(

                    `💬 حصلت على **${formatZom(reward)} ZOM** مقابل نشاطك في الرسائل.\n` +

                    `💰 رصيدك الحالي: **${formatZom(user.balance)} ZOM**`

                ).catch(
                    () => {}
                );

            }

            else {

                saveEconomy();

            }

        }

    } catch (
        error
    ) {

        console.error(

            '❌ Message Handler Error:',

            error

        );

    }

});

// ==========================================================
// 🎙️ VOICE REWARDS
// كل عضو يحتاج أن يبقى المدة كاملة قبل أول مكافأة
// ==========================================================

setInterval(
    () => {

        try {

            const guild =
                client.guilds.cache.get(
                    ALLOWED_GUILD_ID
                );

            if (
                !guild
            ) {

                return;

            }

            const now =
                Date.now();

            const interval =

                VOICE_EVERY_MINUTES

                *

                60

                *

                1000;

            const currentlyEligible =
                new Set();

            let changed =
                false;

            // ==================================================
            // الرومات الصوتية المسموحة
            // ==================================================

            for (
                const channel of
                guild.channels.cache.values()
            ) {

                if (
                    !isRewardVoiceChannel(
                        channel
                    )
                ) {
                    continue;
                }

                // ==================================================
                // الأعضاء داخل الروم
                // ==================================================

                for (
                    const member of
                    channel.members.values()
                ) {

                    if (
                        member.user.bot
                    ) {

                        continue;

                    }

                    currentlyEligible.add(
                        member.id
                    );

                    // ==============================================
                    // أول مرة يدخل
                    // ==============================================

                    if (
                        !voiceRewardSessions.has(
                            member.id
                        )
                    ) {

                        voiceRewardSessions.set(

                            member.id,

                            now

                        );

                        continue;

                    }

                    const lastRewardAt =
                        voiceRewardSessions.get(
                            member.id
                        );

                    // ==============================================
                    // أكمل مدة المكافأة
                    // ==============================================

                    if (

                        now -
                        lastRewardAt

                        >=

                        interval

                    ) {

                        const user =
                            getUser(
                                member.id
                            );

                        user.balance +=
                            VOICE_REWARD;

                        user.lastVoiceReward =
                            now;

                        user.voiceTime +=
                            VOICE_EVERY_MINUTES;

                        voiceRewardSessions.set(

                            member.id,

                            now

                        );

                        // ==============================================
                        // رسالة استلام مكافأة الفويس
                        // ==============================================

                        member.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(
                                        '🎙️ مكافأة الفويس'
                                    )
                                    .setDescription(
                                        `✅ حصلت على **${formatZom(VOICE_REWARD)} ZOM** ` +
                                        `بعد جلوسك **${VOICE_EVERY_MINUTES} دقائق** في الروم الصوتي.\n\n` +
                                        `💰 رصيدك الآن: **${formatZom(user.balance)} ZOM**`
                                    )
                                    .setColor(
                                        0x2ECC71
                                    )
                            ]
                        }).catch(
                            () => {}
                        );

                        changed =
                            true;

                    }

                }

            }

            // ==================================================
            // حذف من خرج من الرومات المسموحة
            // ==================================================

            for (
                const userId of
                voiceRewardSessions.keys()
            ) {

                if (
                    !currentlyEligible.has(
                        userId
                    )
                ) {

                    voiceRewardSessions.delete(
                        userId
                    );

                }

            }

            if (
                changed
            ) {

                saveEconomy();

            }

        } catch (
            error
        ) {

            console.error(

                '❌ Voice Reward Error:',

                error

            );

        }

    },

    60000

);

// ==========================================================
// 🎙️ VOICE STATE UPDATE
// ==========================================================

client.on(

    'voiceStateUpdate',

    async (
        oldState,
        newState
    ) => {

        const voiceGuild = newState.guild || oldState.guild;
        if (!voiceGuild || voiceGuild.id !== ALLOWED_GUILD_ID) {
            return;
        }

        // ==================================================
        // نظام الرومات الصوتية الموجود
        // ==================================================

        try {

            await handleVoiceStateUpdate(

                oldState,

                newState

            );

        } catch (
            error
        ) {

            console.error(

                '❌ خطأ في نظام الرومات الصوتية:',

                error

            );

        }

        // ==================================================
        // مهمات حراسة الفويس الخاصة بالعصابات
        // ==================================================

        try {
            await gangMissions.handleMissionVoiceState(
                oldState,
                newState
            );
        } catch (error) {
            console.error(
                '❌ خطأ في حراسة فويس العصابة:',
                error
            );
        }

        // ==================================================
        // نظام ZOM الصوتي
        // ==================================================

        const member =

            newState.member

            ||

            oldState.member;

        if (

            !member

            ||

            member.user.bot

        ) {

            return;

        }

        const wasEligible =
            isRewardVoiceChannel(
                oldState.channel
            );

        const isEligible =
            isRewardVoiceChannel(
                newState.channel
            );

        // ==================================================
        // دخل روم يعطي ZOM
        // ==================================================

        if (

            !wasEligible

            &&

            isEligible

        ) {

            voiceRewardSessions.set(

                member.id,

                Date.now()

            );

        }

        // ==================================================
        // خرج من روم يعطي ZOM
        // ==================================================

        if (

            wasEligible

            &&

            !isEligible

        ) {

            voiceRewardSessions.delete(
                member.id
            );

        }

    }

);

// ==========================================================
// 🎛️ INTERACTION ROUTER
// ==========================================================

client.on(
    'interactionCreate',
    async interaction => {
        try {

            // ==========================================
            // PUBLIC MULTI-SERVER ROUTER
            // ==========================================

            // /ايقاف و /stopgame في السيرفر الأساسي: يوقف النظام العام والقديم معًا.
            if (
                interaction.isChatInputCommand?.() &&
                String(interaction.guild?.id || '') === String(ALLOWED_GUILD_ID || '') &&
                ['ايقاف','stopgame'].includes(interaction.commandName)
            ) {
                if (!homeCanStartGames(interaction.member) && !isAdmin(interaction.member) && interaction.guild.ownerId !== interaction.user.id) {
                    await interaction.reply({content:'❌ إيقاف اللعبة متاح للمضيف/الرتب المسموحة أو إدارة السيرفر.',ephemeral:true});
                    return;
                }
                await interaction.deferReply({ephemeral:true});
                const publicStopped = await publicSystem.stopGameKey(`${interaction.guild.id}:${interaction.channel.id}`).catch(() => []);
                const legacyStopped = await stopAllGuildGames(interaction.guild, interaction.channel.id, interaction.user.id).catch(() => []);
                const stopped = [...new Set([...(publicStopped || []), ...(legacyStopped || [])])];
                await interaction.editReply(stopped.length ? `🛑 تم إيقاف: **${stopped.join('، ')}**` : 'ℹ️ لا توجد لعبة ZOMBI تعمل في هذا الروم.');
                return;
            }

            // /داشبورد يعمل أيضًا في سيرفر ZOMBI الأساسي.
            if (
                interaction.guild &&
                await publicSystem.handleInteraction(interaction)
            ) {
                return;
            }

            if (interaction.isChatInputCommand?.() && String(interaction.guild?.id || '') === String(ALLOWED_GUILD_ID || '')) {
                maybeHomePremiumPromo(interaction);
            }


            // ==========================================
            // نظام التحذيرات
            // ==========================================

            if (
                await handleWarningButton(interaction)
            ) {
                return;
            }

            if (
                await handleWarningModal(interaction)
            ) {
                return;
            }

            // ==========================================
            // نظام التذاكر
            // ==========================================

            if (
                (interaction.isButton() || interaction.isStringSelectMenu()) &&
                await ticketSystem.handleInteraction(interaction)
            ) {
                return;
            }

            // ==========================================
            // ZOMBI Name Change System
            // ==========================================

            if (
                (interaction.isButton() || interaction.isModalSubmit()) &&
                await nameChangeSystem.handleInteraction(interaction)
            ) {
                return;
            }


            // ==========================================
            // باقي التفاعلات
            // ==========================================

            const customId =
                interaction.customId || '';

            // ==========================================
            // ZOMBI Self Roles / Notification Roles
            // ==========================================

            if (
                interaction.isButton() &&
                customId.startsWith(rolePanel.CUSTOM_ID_PREFIX)
            ) {
                if (await rolePanel.handleInteraction(interaction)) {
                    return;
                }
            }

            // ==================================================
            // ZOM Store: قوائم الرتب + زر الشراء
            // ==================================================

            if (await zomStore.handleInteraction(interaction)) {
                return;
            }

            // ==================================================
            // Slash Commands
            // ==================================================

            if (interaction.isChatInputCommand()) {
                if (
                    interaction.commandName ===
                    'admin'
                ) {
                    await handleAdminCommand(
                        interaction
                    );

                    return;
                }

                if (
                    interaction.commandName ===
                    'store'
                ) {
                    await zomStore.showStore(interaction);
                    return;
                }

                if (
                    interaction.commandName ===
                    'games'
                ) {
                    await handleGamesCommand(
                        interaction
                    );

                    return;
                }

                const economyCommands = [
                    'balance',
                    'daily',
                    'pay',
                    'rank',
                    'leaderboard',
                    'inventory'
                ];

                if (
                    economyCommands.includes(
                        interaction.commandName
                    )
                ) {
                    await handleEconomyCommand(
                        interaction
                    );

                    return;
                }

                if (
                    await handleUtilityCommand(
                        interaction
                    )
                ) {
                    return;
                }

                return;
            }

            // ==================================================
            // ZOMBI City: العصابات والسرقة والمعدات
            // ==================================================

            if (
                customId.startsWith('gang_')
            ) {
                if (
                    await gangSystem.handleGangInteraction(
                        interaction
                    )
                ) {
                    return;
                }
            }

            if (
                customId.startsWith('robbery_') ||
                customId.startsWith('equipment_')
            ) {
                if (
                    await bankRobbery.handleRobberyInteraction(
                        interaction
                    )
                ) {
                    return;
                }
            }

            // ==================================================
            // Bank + Stocks + Trading
            // ==================================================

            if (
                interaction.isButton() ||
                interaction.isStringSelectMenu() ||
                interaction.isModalSubmit()
            ) {
                if (
                    customId.startsWith('bank_') ||
                    customId.startsWith('heist:') ||
                    customId.startsWith('stock_') ||
                    customId.startsWith('trade_')
                ) {
                    await handleBankInteraction(
                        interaction
                    );

                    return;
                }
            }

            // ==================================================
            // /admin games buttons
            // ==================================================

            if (
                interaction.isButton() &&
                customId.startsWith('game_')
            ) {
                await syncHomePublicGameSettings(true);
                if (!homeCanStartGames(interaction.member)) {
                    await interaction.reply({
                        content:
                            '❌ تشغيل الألعاب غير مسموح لك. اختر الرتب المسموحة من Dashboard.',
                        ephemeral: true
                    });

                    return;
                }

                const type =
                    customId.replace(
                        'game_',
                        ''
                    );

                if (type === 'stop') {
                    const publicStopped = await publicSystem.stopGameKey(`${interaction.guild.id}:${interaction.channel.id}`).catch(() => []);
                    const legacyStopped = await stopAllGuildGames(interaction.guild, interaction.channel.id, interaction.user.id).catch(() => []);
                    const stopped = [...new Set([...(publicStopped || []), ...(legacyStopped || [])])];
                    await interaction.reply({content:stopped.length ? `🛑 تم إيقاف: **${stopped.join('، ')}**` : 'ℹ️ لا توجد لعبة ZOMBI تعمل في هذا الروم.',ephemeral:true});
                    return;
                }

                await syncHomePublicGameSettings(true);

                if (!homeGameEnabled(type)) {
                    await interaction.reply({
                        content: '❌ هذه اللعبة معطلة من Dashboard.',
                        ephemeral: true
                    });
                    return;
                }

                if (type === 'wheel') {
                    await startWheel(interaction);
                    return;
                }

                if (type === 'mafia') {
                    await createMafia(interaction);
                    return;
                }

                if (type === 'roulette') {
                    await createRoulette(interaction);
                    return;
                }

                if (type === 'rps') {
                    await startRpsGame(interaction);
                    return;
                }

                if (type === 'chairs') {
                    await startChairs(interaction);
                    return;
                }

                if (type === 'killer') {
                    await startKiller(interaction);
                    return;
                }

                await startGame(
                    interaction,
                    type
                );

                return;
            }

            // ==================================================
            // RPS buttons
            // ==================================================

            if (
                interaction.isButton() &&
                customId.startsWith('rps_')
            ) {
                await handleRpsButton(
                    interaction
                );

                return;
            }

            // ==================================================
            // Wheel
            // ==================================================

            if (
                interaction.isButton() &&
                customId === 'wheel_spin'
            ) {
                await handleWheelSpin(
                    interaction
                );

                return;
            }

            // ==================================================
            // Mafia
            // ==================================================

            if (
                interaction.isButton() &&
                customId === 'mafia_join'
            ) {
                await handleMafiaJoin(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton() &&
                customId === 'mafia_leave'
            ) {
                await handleMafiaLeave(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton() &&
                customId === 'mafia_start'
            ) {
                await handleMafiaStart(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton() &&
                customId === 'mafia_cancel'
            ) {
                await cancelMafia(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton() &&
                customId === 'mafia_action'
            ) {
                await handleMafiaAction(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton() &&
                customId.startsWith(
                    'mafia_vote_'
                )
            ) {
                await handleMafiaVote(
                    interaction
                );

                return;
            }

            if (
                interaction.isStringSelectMenu() &&
                (
                    customId ===
                    'mafia_mafia_select' ||
                    customId ===
                    'mafia_doctor_select' ||
                    customId ===
                    'mafia_detective_select'
                )
            ) {
                await handleMafiaSelect(
                    interaction
                );

                return;
            }

            // ==================================================
            // Roulette
            // ==================================================

            if (
                interaction.isButton() &&
                customId === 'roulette_join'
            ) {
                await rouletteJoin(interaction);
                return;
            }

            if (
                interaction.isButton() &&
                customId === 'roulette_leave'
            ) {
                await rouletteLeave(interaction);
                return;
            }

            if (
                interaction.isButton() &&
                customId === 'roulette_start'
            ) {
                await rouletteStart(interaction);
                return;
            }

            if (
                interaction.isButton() &&
                customId.startsWith('roulette_action_')
            ) {
                await handleRouletteActionButton(interaction);
                return;
            }

            if (
                interaction.isStringSelectMenu() &&
                customId.startsWith('roulette_target_')
            ) {
                await handleRouletteTargetSelect(interaction);
                return;
            }

            if (
                interaction.isUserSelectMenu() &&
                customId === 'roulette_target_add'
            ) {
                await handleRouletteAddUserSelect(interaction);
                return;
            }

            // ==================================================
            // Chairs
            // ==================================================

            if (
                interaction.isButton() &&
                customId.startsWith('chairs:')
            ) {
                await handleChairsInteraction(
                    interaction
                );

                return;
            }

            // ==================================================
            // Killer
            // ==================================================

            if (
                interaction.isButton() &&
                customId.startsWith('killer_')
            ) {
                await handleKillerButton(
                    interaction
                );

                return;
            }

            // ==================================================
            // Voice rooms
            // ==================================================

            if (
                interaction.isButton() ||
                interaction.isModalSubmit()
            ) {
                await handleVoiceRoomInteraction(
                    interaction
                );

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    return;
                }
            }

            if (
                interaction.isStringSelectMenu()
            ) {
                await handleVoiceRoomSelect(
                    interaction
                );

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    return;
                }
            }
        } catch (error) {
            console.error(
                '❌ Discord Interaction Error:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                try {
                    await interaction.followUp({
                        content:
                            '❌ حدث خطأ أثناء تنفيذ العملية.',
                        ephemeral: true
                    });
                } catch {}

                return;
            }

            try {
                await interaction.reply({
                    content:
                        '❌ حدث خطأ أثناء تنفيذ العملية.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error(
                    '❌ Failed to reply:',
                    replyError
                );
            }
        }
    }
);

// ==========================================================
// REGISTER COMMANDS
// ==========================================================

async function registerCommands() {
    // Public multi-server commands: global fallback + per-guild instant registration.
    try {
        const globalResult = await publicSystem.registerGlobalCommands();
        console.log(`🌍 Global public command sync: ${globalResult?.count ?? 0}`);
    } catch (error) {
        console.warn('⚠️ Global public command sync:', error?.message || error);
    }
    // سجل أوامر السيرفر الأساسي بشكل مستقل حتى لو صار خطأ لا يمنع أوامر السيرفرات العامة.
    try {
        const homeGuild = client.guilds.cache.get(ALLOWED_GUILD_ID);
        if (homeGuild) {
            const homeCommands = [
                ...commands.map(command => command.toJSON ? command.toJSON() : command),
                publicSystem.dashboardCommand,
                ...publicSystem.publicCommands.filter(command => ['ايقاف','stopgame','warn','warnings','unwarn'].includes(command.name))
            ];
            const unique = Array.from(
                new Map(homeCommands.map(command => [command.name, command])).values()
            );
            await homeGuild.commands.set(unique);
            console.log(`✅ Home ZOMBI commands: ${unique.length}`);
        } else {
            console.warn(`⚠️ Home guild not found in cache: ${ALLOWED_GUILD_ID}`);
        }
    } catch (error) {
        console.error('❌ فشل تسجيل أوامر السيرفر الأساسي:', error);
    }

    // مهم: لا تعتمد هذه الخطوة على نجاح تسجيل أوامر السيرفر الأساسي.
    try {
        const result = await publicSystem.registerAll();
        console.log(`✅ Public guild command sync: ${result?.ok ?? 0} success / ${result?.failed ?? 0} failed`);
    } catch (error) {
        console.error('❌ فشل تسجيل أوامر السيرفرات العامة:', error);
    }
}

// ==========================================================
// READY
// ==========================================================؟

client.once('clientReady', async () => {
    console.log(
        '=========================================='
    );

    console.log(
        `✅ Logged in as ${client.user.tag}`
    );

    console.log(
        `🏦 ${client.user.username} | ZOM Economy`
    );

    console.log(
        `🌐 Servers: ${client.guilds.cache.size}`
    );

    console.log(
        '=========================================='
    );

    try {
        client.user.setPresence({
            activities: [
                {
                    name:
                        dashboardConfig.system?.presenceText || 'ZOM Economy | /help',
                    type:
                        0
                }
            ],
            status:
                dashboardConfig.system?.presenceStatus || 'online'
        });
    } catch (error) {
        console.error(
            '❌ خطأ في Activity:',
            error
        );
    }

    await registerCommands();

    // Discord قد يتأخر بإتاحة بعض السيرفرات بعد Ready، لذلك نعيد مزامنة أوامر السيرفرات العامة مرتين.
    setTimeout(() => {
        publicSystem.registerAll().catch(error =>
            console.warn('⚠️ Delayed public command sync (8s):', error?.message || error)
        );
    }, 8000).unref?.();
    setTimeout(() => {
        publicSystem.registerAll().catch(error =>
            console.warn('⚠️ Delayed public command sync (25s):', error?.message || error)
        );
    }, 25000).unref?.();
    setTimeout(() => {
        publicSystem.registerGlobalCommands().catch(error =>
            console.warn('⚠️ Delayed global command sync (35s):', error?.message || error)
        );
    }, 35000).unref?.();

    await syncHomePublicGameSettings(true);
    setInterval(() => {
        syncHomePublicGameSettings(true).catch(() => {});
    }, 15000).unref?.();

    try {
        await rolePanel.refreshPanel();
        console.log('🔔 ZOMBI Role Panel Ready');
    } catch (error) {
        console.warn('⚠️ تعذر إرسال/تحديث لوحة رتب ZOMBI:', error?.message || error);
    }

    try {
        const namePanelResult = await nameChangeSystem.refreshPanel();
        if (!namePanelResult?.skipped) {
            console.log('🪪 ZOMBI Name Change Panel Ready');
        }
    } catch (error) {
        console.warn('⚠️ تعذر إرسال/تحديث لوحة تغيير الاسم:', error?.message || error);
    }

    try {
        await zomStore.refreshPanel();
        console.log('🛒 ZOMBI ZOM Store Panel Ready');
    } catch (error) {
        console.warn('⚠️ تعذر إرسال/تحديث لوحة متجر ZOM:', error?.message || error);
    }
});

// ==========================================================
// ERRORS
// ==========================================================

client.on('error', error => {
    console.error(
        '❌ Discord Client Error:',
        error
    );
});

client.on('warn', warning => {
    console.warn(
        '⚠️ Discord Warning:',
        warning
    );
});

process.on(
    'unhandledRejection',
    error => {
        console.error(
            '❌ Unhandled Promise Rejection:',
            error
        );
    }
);

process.on(
    'uncaughtException',
    error => {
        console.error(
            '❌ Uncaught Exception:',
            error
        );
    }
);

// ==========================================================
// GRACEFUL SHUTDOWN
// ==========================================================

function gracefulShutdown(signal) {
    console.log(
        `\n🛑 ${signal} - حفظ البيانات وإغلاق البوت...`
    );

    try {
        saveEconomy();
        saveShop();
        gangSystem.stop();
        bankRobbery.stopBankRobbery();
    } catch {}

    try {
        client.destroy();
    } catch {}

    process.exit(0);
}

process.once(
    'SIGINT',
    () => gracefulShutdown('SIGINT')
);

process.once(
    'SIGTERM',
    () => gracefulShutdown('SIGTERM')
);

// ==========================================================
// LOGIN
// ==========================================================

if (!TOKEN) {
    console.error(
        '❌ لم يتم العثور على TOKEN.\n' +
        'ضع التوكن في متغير البيئة TOKEN ثم شغّل البوت.'
    );

    process.exit(1);
}

client.login(TOKEN).catch(error => {
    console.error(
        '❌ فشل تسجيل دخول البوت:',
        error
    );

    process.exit(1);
});

// ==========================================================
// END OF INDEX.JS
// ==========================================================
