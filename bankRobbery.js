const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const equipmentShop = require('./equipmentShop');
const robberyMissions = require('./robberyMissions');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'robbery.json');

let state = loadState();
let client = null;
let getConfig = null;
let gangSystem = null;
let onAvailabilityChange = null;
let timer = null;

function initBankRobbery(botClient, options = {}) {
    client = botClient;
    getConfig = options.getConfig;
    gangSystem = options.gangSystem;
    onAvailabilityChange = options.onAvailabilityChange;

    equipmentShop.initEquipmentShop({
        getConfig,
        getBankUser: options.getBankUser,
        saveBank: options.saveBank,
        getGangByMember: gangSystem.getGangByMember
    });

    const start = () => {
        recover().catch(logError);
        timer = setInterval(() => tick().catch(logError), 30 * 1000);
        timer.unref?.();
    };

    if (client.isReady()) start();
    else client.once('clientReady', start);

    console.log('🚨 ZOMBI City Bank Robbery System Loaded');
}

function stopBankRobbery() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function robberyConfig() {
    return getConfig?.().robbery || {};
}

function loadState() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        const initial = defaultState();
        safeWrite(initial);
        return initial;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return {
            version: 1,
            lobby: parsed?.lobby && typeof parsed.lobby === 'object'
                ? parsed.lobby
                : null,
            lastRobberyAt: parsed?.lastRobberyAt && typeof parsed.lastRobberyAt === 'object'
                ? parsed.lastRobberyAt
                : {},
            history: Array.isArray(parsed?.history) ? parsed.history.slice(0, 25) : []
        };
    } catch (error) {
        console.error('❌ Robbery Data Error:', error);
        return defaultState();
    }
}

function defaultState() {
    return { version: 1, lobby: null, lastRobberyAt: {}, history: [] };
}

function safeWrite(value = state) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temporaryPath = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 4), 'utf8');
    try {
        fs.renameSync(temporaryPath, DATA_FILE);
    } catch {
        fs.writeFileSync(DATA_FILE, JSON.stringify(value, null, 4), 'utf8');
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
}

async function handleConfigChange(previous = {}, next = {}) {
    const wasEnabled = previous.enabled === true;
    const isEnabled = next.enabled === true;

    if (!wasEnabled && isEnabled) {
        await openRobbery();
    } else if (wasEnabled && !isEnabled) {
        await closeRobbery('تم إغلاق السرقة من الداشبورد.', false);
    } else if (isEnabled && state.lobby) {
        if (state.lobby.status === 'open') {
            state.lobby.requiredPlayers = clamp(Number(next.minParticipants || 5), 2, 25);
            safeWrite();
        }
        await editLobbyMessage();
    }
}

async function recover() {
    if (state.lobby && state.lobby.expiresAt <= Date.now()) {
        await finishRobbery(false, 'انتهى وقت العملية.');
        return;
    }

    if (robberyConfig().enabled === true && !state.lobby) {
        await openRobbery();
        return;
    }

    if (state.lobby) {
        if (state.lobby.status === 'open') {
            state.lobby.requiredPlayers = clamp(Number(robberyConfig().minParticipants || 5), 2, 25);
            safeWrite();
        }
        await editLobbyMessage();
    }
}

async function tick() {
    if (!state.lobby) return;
    if (state.lobby.expiresAt <= Date.now()) {
        await finishRobbery(false, 'انتهى الوقت قبل إكمال سرقة البنك.');
    }
}

function robberyMentionPayload() {
    const cfg = robberyConfig();
    const mode = ['none', 'everyone', 'here', 'role'].includes(String(cfg.mentionMode))
        ? String(cfg.mentionMode)
        : 'everyone';

    if (mode === 'everyone') {
        return { content: '@everyone', allowedMentions: { parse: ['everyone'] } };
    }
    if (mode === 'here') {
        return { content: '@here', allowedMentions: { parse: ['everyone'] } };
    }
    if (mode === 'role' && /^\d{15,25}$/.test(String(cfg.mentionRoleId || ''))) {
        const roleId = String(cfg.mentionRoleId);
        return { content: `<@&${roleId}>`, allowedMentions: { parse: [], roles: [roleId] } };
    }
    return { allowedMentions: { parse: [] } };
}

async function openRobbery() {
    if (state.lobby) {
        await editLobbyMessage();
        return state.lobby;
    }

    const channel = await bankChannel();
    if (!channel) {
        throw new Error('روم البنك المركزي غير موجود أو لا يمكن الكتابة فيه.');
    }

    const lobbyMinutes = clamp(Number(robberyConfig().lobbyMinutes || 10), 2, 60);
    const requiredPlayers = clamp(Number(robberyConfig().minParticipants || 5), 2, 25);

    state.lobby = {
        id: `robbery_${Date.now().toString(36)}`,
        status: 'open',
        channelId: channel.id,
        messageId: '',
        gangId: '',
        participants: [],
        tasks: [],
        reward: Math.max(1, Math.floor(Number(robberyConfig().reward || 150000))),
        requiredPlayers,
        createdAt: Date.now(),
        expiresAt: Date.now() + lobbyMinutes * 60 * 1000
    };
    safeWrite();

    const message = await channel.send({
        ...renderRobbery(),
        ...robberyMentionPayload()
    });
    state.lobby.messageId = message.id;
    safeWrite();
    return state.lobby;
}

function renderRobbery() {
    const lobby = state.lobby;
    if (!lobby) return { content: 'السرقة غير متاحة.', components: [] };

    if (lobby.status === 'running') {
        const taskLines = lobby.tasks.map(task =>
            `${task.completed ? '✅' : '⏳'} **${task.label}:** <@${task.assignedUserId}>`
        ).join('\n');

        return {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('🚨 سرقة ZOMBI City Bank بدأت!')
                    .setDescription(
                        `🏴 العصابة: **${gangSystem.getGangById(lobby.gangId)?.name || 'غير معروفة'}**\n` +
                        `💰 المكافأة: **${format(lobby.reward)} ZZ** لخزنة العصابة\n` +
                        `⏳ الوقت المتبقي: <t:${Math.floor(lobby.expiresAt / 1000)}:R>\n\n` +
                        `**مهمات الفريق:**\n${taskLines}`
                    )
                    .setFooter({ text: 'كل مهمة مخصصة للاعب واحد' })
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    ...lobby.tasks.map(task =>
                        new ButtonBuilder()
                            .setCustomId(`robbery_task:${lobby.id}:${task.index}`)
                            .setLabel(task.label)
                            .setStyle(task.completed ? ButtonStyle.Success : ButtonStyle.Danger)
                            .setDisabled(task.completed)
                    )
                ),
                equipmentRow()
            ]
        };
    }

    const participants = lobby.participants.length
        ? lobby.participants.map(userId => `<@${userId}>`).join('، ')
        : 'بانتظار المشاركين';
    const gangName = lobby.gangId
        ? gangSystem.getGangById(lobby.gangId)?.name || 'غير معروفة'
        : 'تُحدد عند انضمام أول لاعب';

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🚨 سرقة البنك أصبحت متاحة!')
                .setDescription(
                    `🏦 الهدف: **ZOMBI City Bank**\n` +
                    `👥 المطلوب: **${lobby.requiredPlayers} لاعبين من نفس العصابة**\n` +
                    `🏴 العصابة: **${gangName}**\n` +
                    `💰 المكافأة: **${format(lobby.reward)} ZZ** لخزنة العصابة\n` +
                    `⏳ ينتهي التسجيل: <t:${Math.floor(lobby.expiresAt / 1000)}:R>\n\n` +
                    `**المشاركون (${lobby.participants.length}/${lobby.requiredPlayers}):**\n${participants}\n\n` +
                    '🎒 كل لاعب يحتاج قناعًا، والفريق يحتاج جهاز اتصال وجهاز اختراق ومثقابًا وسيارة هروب. يمكن توزيع أكثر من مهمة على نفس اللاعب إذا كان عدد الفريق أقل من 5.'
                )
                .setFooter({ text: 'جميع الأحداث والمعدات افتراضية داخل اللعبة فقط' })
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('robbery_join')
                    .setLabel('الانضمام للسرقة')
                    .setEmoji('🔴')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('robbery_leave')
                    .setLabel('مغادرة الفريق')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('robbery_start')
                    .setLabel('بدء العملية')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(lobby.participants.length < lobby.requiredPlayers)
            ),
            equipmentRow()
        ]
    };
}

function equipmentRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('robbery_equipment_shop')
            .setLabel('متجر المعدات')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('equipment_inventory')
            .setLabel('مخزوني')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
    );
}

async function handleRobberyMessage(message) {
    if (await equipmentShop.handleEquipmentMessage(message)) return true;

    if (message.content.trim() === 'سرقة البنك') {
        if (!state.lobby) {
            await message.reply('⛔ سرقة البنك غير متاحة الآن. الإدارة تفتحها من الداشبورد.');
        } else {
            await message.reply(renderRobbery());
        }
        return true;
    }

    return false;
}

async function handleRobberyInteraction(interaction) {
    if (await equipmentShop.handleEquipmentInteraction(interaction)) return true;
    if (!interaction.customId?.startsWith('robbery_')) return false;

    if (interaction.customId === 'robbery_equipment_shop') {
        if (!gangSystem.getGangByMember(interaction.user.id)) {
            await interaction.reply({ content: '❌ يجب أن تكون عضوًا في عصابة.', ephemeral: true });
        } else {
            await interaction.reply({ ...equipmentShop.shopPayload(), ephemeral: true });
        }
        return true;
    }

    if (interaction.customId === 'robbery_join') {
        await joinRobbery(interaction);
        return true;
    }

    if (interaction.customId === 'robbery_leave') {
        await leaveRobbery(interaction);
        return true;
    }

    if (interaction.customId === 'robbery_start') {
        await startRobberyByBoss(interaction);
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('robbery_task:')) {
        await showTaskModal(interaction);
        return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('robbery_task_modal:')) {
        await submitTask(interaction);
        return true;
    }

    return false;
}

async function joinRobbery(interaction) {
    const lobby = state.lobby;
    if (!lobby || lobby.status !== 'open' || robberyConfig().enabled !== true) {
        await interaction.reply({ content: '⛔ السرقة غير متاحة الآن.', ephemeral: true });
        return;
    }

    const gang = gangSystem.getGangByMember(interaction.user.id);
    if (!gang) {
        await interaction.reply({ content: '❌ يجب أن تكون عضوًا في عصابة.', ephemeral: true });
        return;
    }

    if (lobby.gangId && lobby.gangId !== gang.id) {
        await interaction.reply({ content: '❌ فريق السرقة الحالي من عصابة أخرى.', ephemeral: true });
        return;
    }

    if (!lobby.gangId) {
        const remaining = robberyCooldownRemaining(gang.id);
        if (remaining > 0) {
            await interaction.reply({
                content: `⏳ عصابتك تستطيع السرقة مجددًا <t:${Math.floor((Date.now() + remaining) / 1000)}:R>.`,
                ephemeral: true
            });
            return;
        }
    }

    if (lobby.participants.includes(interaction.user.id)) {
        await interaction.reply({ content: '✅ أنت موجود في الفريق بالفعل.', ephemeral: true });
        return;
    }

    if (equipmentShop.getInventory(interaction.user.id).mask < 1) {
        await interaction.reply({
            content: '❌ تحتاج إلى قناع افتراضي من متجر المعدات قبل الانضمام.',
            ephemeral: true
        });
        return;
    }

    if (lobby.participants.length >= lobby.requiredPlayers) {
        await interaction.reply({ content: '❌ الفريق مكتمل.', ephemeral: true });
        return;
    }

    lobby.gangId = gang.id;
    lobby.participants.push(interaction.user.id);
    safeWrite();

    if (lobby.participants.length < lobby.requiredPlayers) {
        await interaction.update(renderRobbery());
        return;
    }

    const result = startRobbery();
    if (!result.ok) {
        await interaction.reply({ content: `❌ لا يمكن بدء السرقة: ${result.error}`, ephemeral: true });
        await editLobbyMessage();
        return;
    }

    await interaction.update(renderRobbery());
}

function startRobbery() {
    const lobby = state.lobby;
    const assignment = equipmentShop.assignRobberyRoles(lobby.participants);
    if (!assignment.ok) return assignment;

    lobby.status = 'running';
    lobby.tasks = robberyMissions.createTasks(assignment.assignments);
    lobby.expiresAt = Date.now() + clamp(Number(robberyConfig().missionMinutes || 15), 5, 60) * 60 * 1000;
    equipmentShop.consumeRobberyMasks(lobby.participants);
    safeWrite();
    return { ok: true };
}

async function startRobberyByBoss(interaction) {
    const lobby = state.lobby;
    if (!lobby || lobby.status !== 'open') {
        await interaction.reply({ content: '❌ العملية ليست في مرحلة التجمع.', ephemeral: true });
        return;
    }

    const gang = gangSystem.getGangById(lobby.gangId);
    if (!gang || gang.bossId !== interaction.user.id) {
        await interaction.reply({ content: '❌ بوس العصابة فقط يستطيع بدء العملية يدويًا.', ephemeral: true });
        return;
    }

    if (lobby.participants.length < lobby.requiredPlayers) {
        await interaction.reply({
            content: `❌ يجب اكتمال **${lobby.requiredPlayers}** لاعبين أولًا.`,
            ephemeral: true
        });
        return;
    }

    const result = startRobbery();
    if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
        return;
    }

    await interaction.update(renderRobbery());
}

async function leaveRobbery(interaction) {
    const lobby = state.lobby;
    if (!lobby || lobby.status !== 'open') {
        await interaction.reply({ content: '❌ لا يمكن المغادرة بعد بدء العملية.', ephemeral: true });
        return;
    }

    lobby.participants = lobby.participants.filter(userId => userId !== interaction.user.id);
    if (!lobby.participants.length) lobby.gangId = '';
    safeWrite();
    await interaction.update(renderRobbery());
}

async function showTaskModal(interaction) {
    const [, lobbyId, indexText] = interaction.customId.split(':');
    const lobby = state.lobby;
    const task = lobby?.id === lobbyId ? lobby.tasks[Number(indexText)] : null;

    if (!task || lobby.status !== 'running') {
        await interaction.reply({ content: '❌ هذه المهمة لم تعد متاحة.', ephemeral: true });
        return;
    }

    if (task.assignedUserId !== interaction.user.id) {
        await interaction.reply({
            content: `❌ هذه المهمة مخصصة لـ <@${task.assignedUserId}>.`,
            ephemeral: true
        });
        return;
    }

    const input = new TextInputBuilder()
        .setCustomId('robbery_answer')
        .setLabel(task.question.slice(0, 45))
        .setPlaceholder('اكتب الإجابة هنا')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId(`robbery_task_modal:${lobby.id}:${task.index}`)
            .setTitle(`مهمة: ${task.label}`.slice(0, 45))
            .addComponents(new ActionRowBuilder().addComponents(input))
    );
}

async function submitTask(interaction) {
    const [, lobbyId, indexText] = interaction.customId.split(':');
    const lobby = state.lobby;
    const task = lobby?.id === lobbyId ? lobby.tasks[Number(indexText)] : null;

    if (!task || lobby.status !== 'running' || task.completed) {
        await interaction.reply({ content: '❌ هذه المهمة انتهت.', ephemeral: true });
        return;
    }

    if (task.assignedUserId !== interaction.user.id) {
        await interaction.reply({ content: '❌ هذه المهمة ليست لك.', ephemeral: true });
        return;
    }

    const answer = interaction.fields.getTextInputValue('robbery_answer');
    if (!robberyMissions.isCorrect(task, answer)) {
        task.attempts += 1;
        safeWrite();

        if (task.attempts >= 3) {
            await interaction.reply({
                content: '❌ فشلت المهمة ثلاث مرات، وتم اكتشاف العملية.',
                ephemeral: true
            });
            await finishRobbery(false, `فشل <@${task.assignedUserId}> في مهمة **${task.label}**.`);
            return;
        }

        await interaction.reply({
            content: `❌ إجابة خاطئة. المحاولات المتبقية: **${3 - task.attempts}**.`,
            ephemeral: true
        });
        return;
    }

    task.completed = true;
    safeWrite();
    await interaction.reply({ content: `✅ أكملت مهمة **${task.label}** بنجاح.`, ephemeral: true });

    if (lobby.tasks.every(item => item.completed)) {
        await finishRobbery(true, 'تم تنفيذ جميع مهمات الفريق بنجاح.');
    } else {
        await editLobbyMessage();
    }
}

async function finishRobbery(success, reason) {
    const lobby = state.lobby;
    if (!lobby) return;

    const gang = gangSystem.getGangById(lobby.gangId);
    if (gang) {
        if (success) {
            gangSystem.addGangReward(
                gang,
                lobby.reward,
                'robbery_reward',
                'مكافأة سرقة ZOMBI City Bank'
            );
            gang.stats.robberiesWon += 1;
            gang.reputation += 200;
            gang.level = Math.max(1, 1 + Math.floor(gang.reputation / 500));
            state.lastRobberyAt[gang.id] = Date.now();
        } else {
            gang.stats.robberiesFailed += 1;
        }
        gangSystem.saveGangs();
    }

    const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
    const message = await channel?.messages.fetch(lobby.messageId).catch(() => null);
    const title = success ? '✅ نجحت سرقة البنك!' : '❌ فشلت سرقة البنك';
    const description = success
        ? `${reason}\n\n🏴 العصابة: **${gang?.name || 'غير معروفة'}**\n🏦 تم إيداع **${format(lobby.reward)} ZZ** في خزنة العصابة.`
        : `${reason}\n\nلم يتم إيداع أي مكافأة.`;

    await message?.edit({
        embeds: [
            new EmbedBuilder()
                .setColor(success ? 0x57F287 : 0xED4245)
                .setTitle(title)
                .setDescription(description)
        ],
        components: []
    }).catch(() => null);

    state.history.unshift({
        gangId: lobby.gangId,
        success,
        reward: success ? lobby.reward : 0,
        finishedAt: Date.now()
    });
    state.history = state.history.slice(0, 25);
    state.lobby = null;
    safeWrite();

    if (typeof onAvailabilityChange === 'function') {
        onAvailabilityChange(false);
    }
}

async function closeRobbery(reason, updateConfig = true) {
    const lobby = state.lobby;
    if (!lobby) return;

    const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
    const message = await channel?.messages.fetch(lobby.messageId).catch(() => null);
    await message?.edit({
        embeds: [
            new EmbedBuilder()
                .setColor(0x747F8D)
                .setTitle('⛔ تم إغلاق سرقة البنك')
                .setDescription(reason)
        ],
        components: []
    }).catch(() => null);

    state.lobby = null;
    safeWrite();
    if (updateConfig) onAvailabilityChange?.(false);
}

async function editLobbyMessage() {
    const lobby = state.lobby;
    if (!lobby) return;
    const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
    const message = await channel?.messages.fetch(lobby.messageId).catch(() => null);

    if (message) {
        await message.edit(renderRobbery()).catch(() => null);
        return;
    }

    if (channel?.isTextBased?.() && typeof channel.send === 'function') {
        const replacement = await channel.send(renderRobbery());
        lobby.messageId = replacement.id;
        safeWrite();
    }
}

async function bankChannel() {
    const channelId = robberyConfig().bankChannelId || process.env.BANK_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased?.() && typeof channel.send === 'function' ? channel : null;
}

function robberyCooldownRemaining(gangId) {
    const last = Number(state.lastRobberyAt[gangId] || 0);
    const cooldown = clamp(Number(robberyConfig().cooldownHours || 24), 0, 720) * 60 * 60 * 1000;
    return Math.max(0, last + cooldown - Date.now());
}

function dashboardStatus() {
    return {
        enabled: robberyConfig().enabled === true,
        active: Boolean(state.lobby),
        status: state.lobby?.status || 'closed',
        participants: state.lobby?.participants?.length || 0,
        gangId: state.lobby?.gangId || '',
        expiresAt: state.lobby?.expiresAt || 0,
        history: state.history.slice(0, 10)
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || min));
}

function format(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
}

function logError(error) {
    console.error('❌ Bank Robbery Error:', error);
}

module.exports = {
    initBankRobbery,
    stopBankRobbery,
    handleConfigChange,
    handleRobberyMessage,
    handleRobberyInteraction,
    dashboardStatus,
    equipmentShop
};
