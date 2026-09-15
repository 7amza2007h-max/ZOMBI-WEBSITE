const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'equipment.json');

const ITEMS = {
    mask: {
        name: '🎭 قناع افتراضي',
        description: 'مطلوب لكل مشارك ويُستهلك عند بدء السرقة.',
        defaultPrice: 5000,
        max: 20
    },
    laptop: {
        name: '💻 جهاز اختراق افتراضي',
        description: 'مطلوب لمهمة الهاكر.',
        defaultPrice: 25000,
        max: 3
    },
    drill: {
        name: '🛠️ مثقاب خزنة افتراضي',
        description: 'مطلوب لخبير الخزنة.',
        defaultPrice: 30000,
        max: 3
    },
    radio: {
        name: '📻 جهاز اتصال',
        description: 'مطلوب لقائد العملية.',
        defaultPrice: 12000,
        max: 5
    },
    car: {
        name: '🚗 سيارة هروب افتراضية',
        description: 'مطلوبة للسائق ولا تُستهلك.',
        defaultPrice: 50000,
        max: 2
    }
};

let inventoryData = loadData();
let getConfig = null;
let getBankUser = null;
let saveBank = null;
let getGangByMember = null;

function initEquipmentShop(options = {}) {
    getConfig = options.getConfig;
    getBankUser = options.getBankUser;
    saveBank = options.saveBank;
    getGangByMember = options.getGangByMember;
}

function loadData() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        const initial = { version: 1, users: {} };
        safeWrite(initial);
        return initial;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return {
            version: 1,
            users: parsed?.users && typeof parsed.users === 'object'
                ? parsed.users
                : {}
        };
    } catch (error) {
        console.error('❌ Equipment Data Error:', error);
        return { version: 1, users: {} };
    }
}

function safeWrite(value = inventoryData) {
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

function getInventory(userId) {
    const id = String(userId);
    if (!inventoryData.users[id]) {
        inventoryData.users[id] = {};
    }

    for (const key of Object.keys(ITEMS)) {
        inventoryData.users[id][key] = Math.max(
            0,
            Math.floor(Number(inventoryData.users[id][key]) || 0)
        );
    }

    return inventoryData.users[id];
}

function price(itemId) {
    const configured = getConfig?.().robbery?.equipmentPrices?.[itemId];
    return Math.max(
        1,
        Math.floor(Number(configured) || ITEMS[itemId].defaultPrice)
    );
}

function shopPayload() {
    const lines = Object.entries(ITEMS).map(([itemId, item]) =>
        `${item.name} — **${format(price(itemId))} ZZ**\n${item.description}`
    ).join('\n\n');

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('🎒 متجر معدات سرقة البنك')
                .setDescription(
                    `${lines}\n\n` +
                    '💳 يتم الخصم من **رصيد البنك الشخصي ZZ**.'
                )
                .setFooter({ text: 'جميع المعدات افتراضية داخل اللعبة فقط' })
        ],
        components: [
            new ActionRowBuilder().addComponents(
                ...Object.entries(ITEMS).map(([itemId, item]) =>
                    new ButtonBuilder()
                        .setCustomId(`equipment_buy:${itemId}`)
                        .setLabel(item.name.replace(/^\S+\s/, '').slice(0, 60))
                        .setStyle(ButtonStyle.Primary)
                )
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('equipment_inventory')
                    .setLabel('مخزوني')
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

function inventoryEmbed(userId) {
    const inventory = getInventory(userId);
    const lines = Object.entries(ITEMS).map(([itemId, item]) =>
        `${item.name}: **${inventory[itemId]}**`
    ).join('\n');

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎒 معداتك الافتراضية')
        .setDescription(lines);
}

async function handleEquipmentMessage(message) {
    const content = message.content.trim();
    if (content !== 'معدات' && content !== 'عصابة معدات') {
        return false;
    }

    if (!getGangByMember?.(message.author.id)) {
        await message.reply('❌ يجب أن تكون عضوًا في عصابة لشراء معدات السرقة.');
        return true;
    }

    await message.reply(shopPayload());
    return true;
}

async function handleEquipmentInteraction(interaction) {
    if (!interaction.customId?.startsWith('equipment_')) return false;
    if (!interaction.isButton()) return false;

    if (!getGangByMember?.(interaction.user.id)) {
        await interaction.reply({
            content: '❌ يجب أن تكون عضوًا في عصابة لاستخدام متجر المعدات.',
            ephemeral: true
        });
        return true;
    }

    if (interaction.customId === 'equipment_inventory') {
        await interaction.reply({
            embeds: [inventoryEmbed(interaction.user.id)],
            ephemeral: true
        });
        return true;
    }

    const [, itemId] = interaction.customId.split(':');
    const item = ITEMS[itemId];

    if (!item) {
        await interaction.reply({ content: '❌ المعدة غير موجودة.', ephemeral: true });
        return true;
    }

    const inventory = getInventory(interaction.user.id);
    if (inventory[itemId] >= item.max) {
        await interaction.reply({
            content: `❌ وصلت للحد الأقصى من ${item.name}.`,
            ephemeral: true
        });
        return true;
    }

    const bankUser = getBankUser?.(interaction.user.id);
    const itemPrice = price(itemId);

    if (!bankUser || bankUser.bank < itemPrice) {
        await interaction.reply({
            content:
                `❌ رصيد البنك لا يكفي.\n` +
                `💰 السعر: **${format(itemPrice)} ZZ**\n` +
                `🏦 رصيدك: **${format(bankUser?.bank || 0)} ZZ**`,
            ephemeral: true
        });
        return true;
    }

    bankUser.bank -= itemPrice;
    inventory[itemId] += 1;
    saveBank?.();
    safeWrite();

    await interaction.reply({
        content:
            `✅ اشتريت ${item.name} مقابل **${format(itemPrice)} ZZ**.\n` +
            `🎒 الكمية لديك: **${inventory[itemId]}**`,
        ephemeral: true
    });
    return true;
}

function assignRobberyRoles(participantIds) {
    const participants = participantIds.map(String);
    const missingMasks = participants.filter(
        userId => getInventory(userId).mask < 1
    );

    if (missingMasks.length) {
        return {
            ok: false,
            error: `الأعضاء بدون قناع: ${missingMasks.map(id => `<@${id}>`).join('، ')}`
        };
    }

    const requiredRoles = [
        { key: 'leader', label: 'قائد العملية', gear: 'radio' },
        { key: 'hacker', label: 'الهاكر', gear: 'laptop' },
        { key: 'vault', label: 'خبير الخزنة', gear: 'drill' },
        { key: 'driver', label: 'السائق', gear: 'car' }
    ];
    const assignments = [];
    const used = new Set();

    if (!participants.length) {
        return { ok: false, error: 'لا يوجد مشاركون في فريق السرقة.' };
    }

    for (const role of requiredRoles) {
        // نفضل توزيع الأدوار على لاعبين مختلفين، لكن إذا كان الحد من الداشبورد
        // أقل من 4 لاعبين نسمح للاعب واحد بحمل أكثر من دور إذا كان يملك المعدة.
        const userId =
            participants.find(id => !used.has(id) && getInventory(id)[role.gear] >= 1) ||
            participants.find(id => getInventory(id)[role.gear] >= 1);

        if (!userId) {
            return {
                ok: false,
                error: 'الفريق يحتاج جهاز اتصال، جهاز اختراق، مثقاب، وسيارة هروب. يمكن للاعب واحد حمل أكثر من معدة عند تقليل عدد المشاركين.'
            };
        }

        assignments.push({ ...role, userId });
        used.add(userId);
    }

    const taskCounts = new Map(participants.map(id => [id, 0]));
    for (const assignment of assignments) {
        taskCounts.set(assignment.userId, (taskCounts.get(assignment.userId) || 0) + 1);
    }
    const lookout = [...participants].sort(
        (a, b) => (taskCounts.get(a) || 0) - (taskCounts.get(b) || 0)
    )[0];

    assignments.push({
        key: 'lookout',
        label: 'المراقب',
        gear: 'mask',
        userId: lookout
    });

    return { ok: true, assignments };
}

function consumeRobberyMasks(participantIds) {
    for (const userId of participantIds) {
        const inventory = getInventory(userId);
        inventory.mask = Math.max(0, inventory.mask - 1);
    }
    safeWrite();
}

function format(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
}

module.exports = {
    ITEMS,
    initEquipmentShop,
    handleEquipmentMessage,
    handleEquipmentInteraction,
    shopPayload,
    inventoryEmbed,
    getInventory,
    assignRobberyRoles,
    consumeRobberyMasks
};
