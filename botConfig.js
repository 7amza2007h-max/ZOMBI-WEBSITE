const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'bot-settings.json');

const DEFAULT_CONFIG = {
    system: {
        presenceText: 'ZOM Economy | /help',
        presenceStatus: 'online'
    },
    discord: {
        allowedGuildId: '1470436560456384575',
        storeChannelId: '1541845974383591526',
        messageChannelId: '1470436562226384954',
        voiceChannelIds: ['1470436562524307525']
    },
    zom: {
        channelId: ''
    },
    shopPanel: {
        enabled: true,
        channelId: '1541845974383591526',
        title: 'متجر الرتب',
        description: 'افتح القائمة واختار الرتبة التي تريد معرفة سعرها ومميزاتها، وبعدها اضغط زر الشراء.',
        footer: 'ZOMBI • ZOM Store',
        bannerUrl: '',
        thumbnailUrl: '',
        detailBannerUrl: '',
        accentColor: '#B00020'
    },
    economy: {
        messageEvery: 15,
        messageReward: 10,
        messageRewardCooldownSeconds: 60,
        voiceEveryMinutes: 10,
        voiceReward: 10,
        dailyReward: 500,
        dailyCooldownHours: 24,
        gameReward: 100
    },
    games: {
        quickRounds: 5,
        quickGameSettings: {
            quiz:      { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            guess:     { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            speed:     { rounds: 5, roundTimeSeconds: 15, winnerReward: 300 },
            scramble:  { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            truefalse: { rounds: 5, roundTimeSeconds: 20, winnerReward: 300 },
            math:      { rounds: 5, roundTimeSeconds: 20, winnerReward: 300 },
            closest:   { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            word:      { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            daily:     { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 },
            rps:       { rounds: 5, roundTimeSeconds: 25, winnerReward: 300 }
        },
        wheelRewards: [50, 75, 100, 150, 200, 300],
        rouletteEnabled: true,
        rouletteMaxPlayers: 25,
        rouletteTurnSeconds: 25,
        rouletteActionCosts: {
            revive: 300,
            link: 300,
            protect: 300,
            freeze: 500,
            double: 500,
            curse: 500,
            unlink: 200,
            add: 1000
        },
        mafiaMinPlayers: 4,
        mafiaMaxPlayers: 20
    },
    chairs: {
        minPlayers: 2,
        maxPlayers: 20,
        startCountdownSeconds: 5,
        roundTimeSeconds: 20,
        betweenRoundsMs: 2500,
        winnerReward: 500
    },
    voiceRooms: {
        enabled: true,
        createVoiceChannelId: '1543271928884895754',
        controlTextChannelId: '1535455746299265046',
        categoryId: '1535455743858188349',
        roomName: '🎙️・{username}'
    },
    levels: {
        enabled: true,
        levelUpChannelId: '1543273620996882523',
        xpPerMessage: 10,
        xpCooldownSeconds: 30,
        baseXp: 100,
        xpGrowthPerLevel: 50
    },
    bank: {
        bankChannelId: '1543276583417024632',
        goldValue: 100000,
        salaryCooldownHours: 4,
        maxSalary: 1000,
        tradeProfitPercent: 15,
        tradeSessionMinutes: 5,
        maxLoan: 100000,
        loanInterestPercent: 10,
        companyEmployeeStartSalary: 4000,
        companyEmployeeSalaryIncrease: 500,
        companyLevelUpHours: 24,
        companyOwnerStartSalary: 100000,
        companyOwnerSalaryIncrease: 5000
    },
    warnings: {
        role1Id: '1544159442982014976',
        role2Id: '1544159663451406507',
        role3Id: '1544159697618346095'
    },
    rolePanel: {
        enabled: true,
        channelId: '1545012486162485259',
        title: '🔔 ZOMBI • مركز الإشعارات',
        description: 'اختر الإشعارات التي تريدها من الأزرار بالأسفل. اضغط مرة للحصول على الرتبة، واضغط مرة ثانية لإلغائها.',
        footer: 'اختر إشعاراتك بنفسك',
        roles: [
            {
                roleId: '1545011875333275678',
                label: 'Games Notifications',
                emoji: '🎮',
                style: 'Primary'
            }
        ]
    },
    gangs: {
        maxMembers: 7,
        categoryId: '',
        minMissionParticipants: 2,
        maxMissionSteps: 5,
        puzzleMaxAttempts: 2,
        chatMaxAttempts: 2,
        relayMaxAttempts: 2,
        missionCooldownHours: 4,
        missionDurationMinutes: 30,
        missionRewardMin: 15000,
        missionRewardMax: 35000
    },
    robbery: {
        enabled: false,
        bankChannelId: '1543276583417024632',
        minParticipants: 5,
        mentionMode: 'everyone',
        mentionRoleId: '',
        lobbyMinutes: 10,
        missionMinutes: 15,
        reward: 150000,
        cooldownHours: 24,
        equipmentPrices: {
            mask: 5000,
            laptop: 25000,
            drill: 30000,
            radio: 12000,
            car: 50000
        }
    }
};

let currentConfig = null;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function number(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function integer(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.round(number(value, fallback, min, max));
}

function id(value, fallback = '') {
    const text = String(value ?? '').trim();
    return /^\d{15,25}$/.test(text) ? text : fallback;
}

function str(value, fallback = '', max = 200) {
    const text = String(value ?? '').trim().slice(0, max);
    return text || fallback;
}

function bool(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

function normalizeBotConfig(input = {}) {
    const d = DEFAULT_CONFIG;
    const system = input.system || {};
    const discord = input.discord || {};
    const zom = input.zom || {};
    const shopPanel = input.shopPanel || {};
    const economy = input.economy || {};
    const games = input.games || {};
    const chairs = input.chairs || {};
    const voiceRooms = input.voiceRooms || {};
    const levels = input.levels || {};
    const bank = input.bank || {};
    const warnings = input.warnings || {};
    const rolePanel = input.rolePanel || {};
    const gangs = input.gangs || {};
    const robbery = input.robbery || {};
    const rouletteActionCosts = games.rouletteActionCosts || {};
    const quickGameSettings = games.quickGameSettings || {};
    const equipmentPrices = robbery.equipmentPrices || {};
    const rolePanelRoles = Array.isArray(rolePanel.roles) ? rolePanel.roles : [];
    const allowedRoleButtonStyles = new Set(['Primary', 'Secondary', 'Success', 'Danger']);
    const normalizedRolePanelRoles = [];
    const seenRoleIds = new Set();
    for (const item of rolePanelRoles) {
        const roleId = id(item?.roleId, '');
        if (!roleId || seenRoleIds.has(roleId)) continue;
        seenRoleIds.add(roleId);
        normalizedRolePanelRoles.push({
            roleId,
            label: String(item?.label ?? '').trim().slice(0, 80),
            emoji: String(item?.emoji ?? '').trim().slice(0, 80),
            style: allowedRoleButtonStyles.has(String(item?.style || ''))
                ? String(item.style)
                : 'Primary'
        });
        if (normalizedRolePanelRoles.length >= 25) break;
    }
    const quickGameKeys = ['quiz','guess','speed','scramble','truefalse','math','closest','word','daily','rps'];
    const normalizedQuickGameSettings = {};
    for (const key of quickGameKeys) {
        const src = quickGameSettings[key] || {};
        const fallback = d.games.quickGameSettings[key];
        normalizedQuickGameSettings[key] = {
            rounds: integer(src.rounds, fallback.rounds, 1, 25),
            roundTimeSeconds: integer(src.roundTimeSeconds, fallback.roundTimeSeconds, 5, 180),
            winnerReward: integer(src.winnerReward, fallback.winnerReward, 0, 1000000000)
        };
    }

    const voiceIds = Array.isArray(discord.voiceChannelIds)
        ? discord.voiceChannelIds
        : String(discord.voiceChannelIds || '').split(/[\s,]+/).filter(Boolean);

    const wheel = Array.isArray(games.wheelRewards)
        ? games.wheelRewards
        : String(games.wheelRewards || '').split(/[\s,]+/).filter(Boolean);

    const validStatuses = new Set(['online', 'idle', 'dnd', 'invisible']);
    const presenceStatus = validStatuses.has(String(system.presenceStatus || ''))
        ? String(system.presenceStatus)
        : d.system.presenceStatus;

    const normalized = {
        system: {
            presenceText: str(system.presenceText, d.system.presenceText, 128),
            presenceStatus
        },
        discord: {
            allowedGuildId: id(discord.allowedGuildId, d.discord.allowedGuildId),
            storeChannelId: id(discord.storeChannelId, d.discord.storeChannelId),
            messageChannelId: id(discord.messageChannelId, d.discord.messageChannelId),
            voiceChannelIds: voiceIds.map(v => id(v, '')).filter(Boolean)
        },
        zom: {
            channelId: id(zom.channelId, d.zom.channelId)
        },
        shopPanel: {
            enabled: shopPanel.enabled !== false,
            channelId: id(shopPanel.channelId, id(discord.storeChannelId, d.shopPanel.channelId || d.discord.storeChannelId)),
            title: str(shopPanel.title, d.shopPanel.title, 256),
            description: str(shopPanel.description, d.shopPanel.description, 4000),
            footer: str(shopPanel.footer, d.shopPanel.footer, 200),
            bannerUrl: String(shopPanel.bannerUrl ?? '').trim().slice(0, 1000),
            thumbnailUrl: String(shopPanel.thumbnailUrl ?? '').trim().slice(0, 1000),
            detailBannerUrl: String(shopPanel.detailBannerUrl ?? '').trim().slice(0, 1000),
            accentColor: /^#[0-9a-f]{6}$/i.test(String(shopPanel.accentColor || '').trim())
                ? String(shopPanel.accentColor).trim()
                : d.shopPanel.accentColor
        },
        economy: {
            messageEvery: integer(economy.messageEvery, d.economy.messageEvery, 1, 100000),
            messageReward: integer(economy.messageReward, d.economy.messageReward, 0, 1000000000),
            messageRewardCooldownSeconds: integer(economy.messageRewardCooldownSeconds, d.economy.messageRewardCooldownSeconds, 0, 86400),
            voiceEveryMinutes: integer(economy.voiceEveryMinutes, d.economy.voiceEveryMinutes, 1, 1440),
            voiceReward: integer(economy.voiceReward, d.economy.voiceReward, 0, 1000000000),
            dailyReward: integer(economy.dailyReward, d.economy.dailyReward, 0, 1000000000),
            dailyCooldownHours: number(economy.dailyCooldownHours, d.economy.dailyCooldownHours, 0.01, 720),
            gameReward: integer(economy.gameReward, d.economy.gameReward, 0, 1000000000)
        },
        games: {
            quickRounds: integer(games.quickRounds, d.games.quickRounds, 1, 25),
            quickGameSettings: normalizedQuickGameSettings,
            wheelRewards: wheel.map(v => integer(v, 0, 0, 1000000000)).filter(Number.isFinite).slice(0, 30),
            rouletteEnabled: games.rouletteEnabled !== false,
            rouletteMaxPlayers: integer(games.rouletteMaxPlayers, d.games.rouletteMaxPlayers, 2, 25),
            rouletteTurnSeconds: integer(games.rouletteTurnSeconds, d.games.rouletteTurnSeconds, 10, 120),
            rouletteActionCosts: {
                revive: integer(rouletteActionCosts.revive, d.games.rouletteActionCosts.revive, 0, 1000000000),
                link: integer(rouletteActionCosts.link, d.games.rouletteActionCosts.link, 0, 1000000000),
                protect: integer(rouletteActionCosts.protect, d.games.rouletteActionCosts.protect, 0, 1000000000),
                freeze: integer(rouletteActionCosts.freeze, d.games.rouletteActionCosts.freeze, 0, 1000000000),
                double: integer(rouletteActionCosts.double, d.games.rouletteActionCosts.double, 0, 1000000000),
                curse: integer(rouletteActionCosts.curse, d.games.rouletteActionCosts.curse, 0, 1000000000),
                unlink: integer(rouletteActionCosts.unlink, d.games.rouletteActionCosts.unlink, 0, 1000000000),
                add: integer(rouletteActionCosts.add, d.games.rouletteActionCosts.add, 0, 1000000000)
            },
            mafiaMinPlayers: integer(games.mafiaMinPlayers, d.games.mafiaMinPlayers, 3, 100),
            mafiaMaxPlayers: integer(games.mafiaMaxPlayers, d.games.mafiaMaxPlayers, 3, 100)
        },
        chairs: {
            minPlayers: integer(chairs.minPlayers, d.chairs.minPlayers, 2, 25),
            maxPlayers: integer(chairs.maxPlayers, d.chairs.maxPlayers, 2, 25),
            startCountdownSeconds: integer(chairs.startCountdownSeconds, d.chairs.startCountdownSeconds, 1, 60),
            roundTimeSeconds: integer(chairs.roundTimeSeconds, d.chairs.roundTimeSeconds, 5, 180),
            betweenRoundsMs: integer(chairs.betweenRoundsMs, d.chairs.betweenRoundsMs, 250, 30000),
            winnerReward: integer(chairs.winnerReward, d.chairs.winnerReward, 0, 1000000000)
        },
        voiceRooms: {
            enabled: bool(voiceRooms.enabled, d.voiceRooms.enabled),
            createVoiceChannelId: id(voiceRooms.createVoiceChannelId, d.voiceRooms.createVoiceChannelId),
            controlTextChannelId: id(voiceRooms.controlTextChannelId, d.voiceRooms.controlTextChannelId),
            categoryId: id(voiceRooms.categoryId, d.voiceRooms.categoryId),
            roomName: str(voiceRooms.roomName, d.voiceRooms.roomName, 90)
        },
        levels: {
            enabled: bool(levels.enabled, d.levels.enabled),
            levelUpChannelId: id(levels.levelUpChannelId, d.levels.levelUpChannelId),
            xpPerMessage: integer(levels.xpPerMessage, d.levels.xpPerMessage, 0, 1000000),
            xpCooldownSeconds: integer(levels.xpCooldownSeconds, d.levels.xpCooldownSeconds, 0, 86400),
            baseXp: integer(levels.baseXp, d.levels.baseXp, 1, 1000000000),
            xpGrowthPerLevel: integer(levels.xpGrowthPerLevel, d.levels.xpGrowthPerLevel, 0, 100000000)
        },
        bank: {
            bankChannelId: id(bank.bankChannelId, d.bank.bankChannelId),
            goldValue: integer(bank.goldValue, d.bank.goldValue, 1, 1000000000),
            salaryCooldownHours: number(bank.salaryCooldownHours, d.bank.salaryCooldownHours, 0.01, 720),
            maxSalary: integer(bank.maxSalary, d.bank.maxSalary, 0, 1000000000),
            tradeProfitPercent: number(bank.tradeProfitPercent, d.bank.tradeProfitPercent, 0, 1000),
            tradeSessionMinutes: number(bank.tradeSessionMinutes, d.bank.tradeSessionMinutes, 0.1, 1440),
            maxLoan: integer(bank.maxLoan, d.bank.maxLoan, 0, 1000000000),
            loanInterestPercent: number(bank.loanInterestPercent, d.bank.loanInterestPercent, 0, 1000),
            companyEmployeeStartSalary: integer(bank.companyEmployeeStartSalary, d.bank.companyEmployeeStartSalary, 0, 1000000000),
            companyEmployeeSalaryIncrease: integer(bank.companyEmployeeSalaryIncrease, d.bank.companyEmployeeSalaryIncrease, 0, 1000000000),
            companyLevelUpHours: number(bank.companyLevelUpHours, d.bank.companyLevelUpHours, 0.1, 8760),
            companyOwnerStartSalary: integer(bank.companyOwnerStartSalary, d.bank.companyOwnerStartSalary, 0, 1000000000),
            companyOwnerSalaryIncrease: integer(bank.companyOwnerSalaryIncrease, d.bank.companyOwnerSalaryIncrease, 0, 1000000000)
        },
        warnings: {
            role1Id: id(warnings.role1Id, d.warnings.role1Id),
            role2Id: id(warnings.role2Id, d.warnings.role2Id),
            role3Id: id(warnings.role3Id, d.warnings.role3Id)
        },
        rolePanel: {
            enabled: rolePanel.enabled !== false,
            channelId: id(rolePanel.channelId, d.rolePanel.channelId),
            title: str(rolePanel.title, d.rolePanel.title, 256),
            description: str(rolePanel.description, d.rolePanel.description, 4000),
            footer: str(rolePanel.footer, d.rolePanel.footer, 120),
            roles: normalizedRolePanelRoles.length
                ? normalizedRolePanelRoles
                : clone(d.rolePanel.roles)
        },
        gangs: {
            maxMembers: integer(gangs.maxMembers, d.gangs.maxMembers, 2, 20),
            categoryId: id(gangs.categoryId, ''),
            minMissionParticipants: integer(gangs.minMissionParticipants, d.gangs.minMissionParticipants, 2, 20),
            maxMissionSteps: integer(gangs.maxMissionSteps, d.gangs.maxMissionSteps, 3, 5),
            puzzleMaxAttempts: integer(gangs.puzzleMaxAttempts, d.gangs.puzzleMaxAttempts, 1, 10),
            chatMaxAttempts: integer(gangs.chatMaxAttempts, d.gangs.chatMaxAttempts, 1, 10),
            relayMaxAttempts: integer(gangs.relayMaxAttempts, d.gangs.relayMaxAttempts, 1, 10),
            missionCooldownHours: number(gangs.missionCooldownHours, d.gangs.missionCooldownHours, 1, 168),
            missionDurationMinutes: integer(gangs.missionDurationMinutes, d.gangs.missionDurationMinutes, 5, 180),
            missionRewardMin: integer(gangs.missionRewardMin, d.gangs.missionRewardMin, 1, 1000000000),
            missionRewardMax: integer(gangs.missionRewardMax, d.gangs.missionRewardMax, 1, 1000000000)
        },
        robbery: {
            enabled: robbery.enabled === true,
            bankChannelId: id(robbery.bankChannelId, d.robbery.bankChannelId),
            minParticipants: integer(robbery.minParticipants, d.robbery.minParticipants, 2, 25),
            mentionMode: ['none', 'everyone', 'here', 'role'].includes(String(robbery.mentionMode))
                ? String(robbery.mentionMode)
                : d.robbery.mentionMode,
            mentionRoleId: id(robbery.mentionRoleId, ''),
            lobbyMinutes: integer(robbery.lobbyMinutes, d.robbery.lobbyMinutes, 2, 60),
            missionMinutes: integer(robbery.missionMinutes, d.robbery.missionMinutes, 5, 60),
            reward: integer(robbery.reward, d.robbery.reward, 1, 1000000000),
            cooldownHours: number(robbery.cooldownHours, d.robbery.cooldownHours, 0, 720),
            equipmentPrices: {
                mask: integer(equipmentPrices.mask, d.robbery.equipmentPrices.mask, 1, 1000000000),
                laptop: integer(equipmentPrices.laptop, d.robbery.equipmentPrices.laptop, 1, 1000000000),
                drill: integer(equipmentPrices.drill, d.robbery.equipmentPrices.drill, 1, 1000000000),
                radio: integer(equipmentPrices.radio, d.robbery.equipmentPrices.radio, 1, 1000000000),
                car: integer(equipmentPrices.car, d.robbery.equipmentPrices.car, 1, 1000000000)
            }
        }
    };

    if (!normalized.discord.voiceChannelIds.length) normalized.discord.voiceChannelIds = clone(d.discord.voiceChannelIds);
    if (!normalized.games.wheelRewards.length) normalized.games.wheelRewards = clone(d.games.wheelRewards);
    if (normalized.games.mafiaMaxPlayers < normalized.games.mafiaMinPlayers) normalized.games.mafiaMaxPlayers = normalized.games.mafiaMinPlayers;
    if (normalized.chairs.maxPlayers < normalized.chairs.minPlayers) normalized.chairs.maxPlayers = normalized.chairs.minPlayers;
    if (normalized.gangs.missionRewardMax < normalized.gangs.missionRewardMin) normalized.gangs.missionRewardMax = normalized.gangs.missionRewardMin;

    return normalized;
}

function safeWriteJson(filePath, data) {
    const temp = `${filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 4), 'utf8');
    try {
        fs.renameSync(temp, filePath);
    } catch {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
}

function loadBotConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            currentConfig = clone(DEFAULT_CONFIG);
            safeWriteJson(CONFIG_FILE, currentConfig);
            return clone(currentConfig);
        }
        const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        currentConfig = normalizeBotConfig(parsed);
        safeWriteJson(CONFIG_FILE, currentConfig);
        return clone(currentConfig);
    } catch (error) {
        console.error('❌ خطأ بتحميل bot-settings.json:', error);
        currentConfig = clone(DEFAULT_CONFIG);
        return clone(currentConfig);
    }
}

function saveBotConfig(config) {
    currentConfig = normalizeBotConfig(config);
    safeWriteJson(CONFIG_FILE, currentConfig);
    return clone(currentConfig);
}

function getBotConfig() {
    if (!currentConfig) loadBotConfig();
    return currentConfig;
}

module.exports = {
    CONFIG_FILE,
    DEFAULT_CONFIG,
    normalizeBotConfig,
    loadBotConfig,
    saveBotConfig,
    getBotConfig
};
