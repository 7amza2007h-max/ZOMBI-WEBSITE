// ==========================================================
// 🕵️ لعبة من القاتل؟
// النظام الجديد - Discord.js v14
// 50 قضية + قصة + أدلة + 3 تلميحات
// ==========================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const CASES_FILE = path.join(
    __dirname,
    "killer-cases.json"
);

// ==========================================================
// تخزين الألعاب
// ==========================================================

const activeGames = new Map();
const usedCases = new Map();

// ==========================================================
// 🕵️ القضايا - 50 قضية
// ==========================================================

// ==========================================================
// 🗂️ القضايا أصبحت بملف JSON حتى يمكن تعديلها من الداشبورد
// ==========================================================

function cleanText(value, max = 2000) {

    return String(
        value ?? ""
    )
        .trim()
        .slice(
            0,
            max
        );
}

function normalizeCase(
    gameCase,
    index
) {

    if (
        !gameCase ||
        typeof gameCase !== "object"
    ) {
        return null;
    }

    const suspects =
        Array.isArray(
            gameCase.suspects
        )
            ? gameCase.suspects
                .map(value => cleanText(value, 80))
                .filter(Boolean)
                .slice(0, 5)
            : [];

    const clues =
        Array.isArray(
            gameCase.clues
        )
            ? gameCase.clues
                .map(value => cleanText(value, 300))
                .filter(Boolean)
                .slice(0, 10)
            : [];

    const hints =
        Array.isArray(
            gameCase.hints
        )
            ? gameCase.hints
                .map(value => cleanText(value, 300))
                .filter(Boolean)
                .slice(0, 3)
            : [];

    const killer =
        cleanText(
            gameCase.killer,
            80
        );

    const normalized = {

        id:
            cleanText(
                gameCase.id,
                80
            ) ||
            `case_${index + 1}`,

        enabled:
            gameCase.enabled !== false,

        title:
            cleanText(
                gameCase.title,
                120
            ),

        story:
            cleanText(
                gameCase.story,
                2000
            ),

        suspects,

        clues,

        hints,

        killer,

        answer:
            cleanText(
                gameCase.answer,
                2000
            )
    };

    // Discord يسمح بحد أقصى 5 أزرار في الصف.
    // اللعبة الحالية تحتاج 3 تلميحات بالضبط.
    if (
        !normalized.title ||
        !normalized.story ||
        suspects.length < 2 ||
        suspects.length > 5 ||
        clues.length < 1 ||
        hints.length !== 3 ||
        !killer ||
        !suspects.includes(killer) ||
        !normalized.answer
    ) {
        return null;
    }

    return normalized;
}

function loadCases(
    options = {}
) {

    const includeDisabled =
        options.includeDisabled === true;

    try {

        if (
            !fs.existsSync(
                CASES_FILE
            )
        ) {

            console.error(
                `❌ ملف القضايا غير موجود: ${CASES_FILE}`
            );

            return [];
        }

        const parsed =
            JSON.parse(
                fs.readFileSync(
                    CASES_FILE,
                    "utf8"
                )
            );

        if (
            !Array.isArray(parsed)
        ) {
            return [];
        }

        const validCases =
            parsed
                .map(
                    (gameCase, index) =>
                        normalizeCase(
                            gameCase,
                            index
                        )
                )
                .filter(Boolean);

        return includeDisabled
            ? validCases
            : validCases.filter(
                gameCase =>
                    gameCase.enabled
            );

    } catch (error) {

        console.error(
            "❌ خطأ في تحميل killer-cases.json:",
            error
        );

        return [];
    }
}


// ==========================================================
// 🔄 اختيار قضية بدون تكرار
// ==========================================================

function getNextCase(guildId) {

    const cases =
        loadCases();

    if (
        !cases.length
    ) {
        return null;
    }

    let used =
        usedCases.get(
            guildId
        );

    if (
        !Array.isArray(used)
    ) {
        used = [];
    }

    // تنظيف القضايا المحذوفة أو المعطلة من سجل عدم التكرار.
    const currentIds =
        new Set(
            cases.map(
                gameCase =>
                    gameCase.id
            )
        );

    used =
        used.filter(
            caseId =>
                currentIds.has(caseId)
        );

    // إذا انتهت كل القضايا المفعلة، نبدأ دورة جديدة.
    if (
        used.length >=
        cases.length
    ) {
        used = [];
    }

    const available =
        cases.filter(
            gameCase =>
                !used.includes(
                    gameCase.id
                )
        );

    const selected =
        available[
            Math.floor(
                Math.random() *
                available.length
            )
        ];

    used.push(
        selected.id
    );

    usedCases.set(
        guildId,
        used
    );

    return selected;
}

// ==========================================================
// 🕵️ بدء اللعبة
// ==========================================================

async function startKillerGame(message) {

    if (!message.guild) return;

    const guildId = message.guild.id;

    // ------------------------------------------------------
    // منع أكثر من قضية
    // ------------------------------------------------------

    if (activeGames.has(guildId)) {

        await message.reply({
            content:
                "⚠️ **توجد قضية شغالة حاليًا!**\n" +
                "🔎 حاول حل القضية الحالية أولًا."
        });

        return;
    }

    const selectedCase =
        getNextCase(guildId);

    if (!selectedCase) {

        await message.reply(
            "❌ لا توجد قضايا مفعلة حاليًا. أضف أو فعّل قضية من الداشبورد."
        );

        return;
    }

    // ------------------------------------------------------
    // تخزين اللعبة
    // ------------------------------------------------------

    void require('../public/serverLogs').game(message,'من القاتل');
    activeGames.set(guildId, {
        caseData: selectedCase,
        answered: false,
        hintsUsed: 0
    });

    // ------------------------------------------------------
    // Embed
    // ------------------------------------------------------

    const embed =
        new EmbedBuilder()
            .setColor(0x8B0000)
            .setTitle(
                `🕵️ ${selectedCase.title}`
            )
            .setDescription(
                `## 📖 القصة\n` +
                `${selectedCase.story}\n\n` +

                `## 👥 المشتبه بهم\n` +
                selectedCase.suspects
                    .map(
                        (name, index) =>
                            `**${index + 1}.** ${name}`
                    )
                    .join("\n") +

                `\n\n## 🔎 الأدلة\n` +
                selectedCase.clues
                    .map(
                        (clue, index) =>
                            `**${index + 1}.** ${clue}`
                    )
                    .join("\n")
            )
            .setFooter({
                text:
                    "🧠 حل القضية بالاعتماد على الأدلة • لديك 3 تلميحات"
            })
            .setTimestamp();

    // ------------------------------------------------------
    // أزرار المشتبه بهم
    // ------------------------------------------------------

    const suspectRow =
        new ActionRowBuilder();

    selectedCase.suspects.forEach(
        (suspect, index) => {

            suspectRow.addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `killer_answer_${index}`
                    )
                    .setLabel(suspect)
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );
        }
    );

    // ------------------------------------------------------
    // أزرار التلميحات والإيقاف
    // ------------------------------------------------------

    const controlRow =
        new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "killer_hint_1"
                    )
                    .setLabel("💡 تلميح 1")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "killer_hint_2"
                    )
                    .setLabel("💡 تلميح 2")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "killer_hint_3"
                    )
                    .setLabel("💡 تلميح 3")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "killer_end"
                    )
                    .setLabel("🛑 إيقاف")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    // ------------------------------------------------------
    // إرسال اللعبة
    // ------------------------------------------------------

    try {

        await message.channel.send({

            content:
                "🕵️ **بدأت قضية جديدة!**\n" +
                "🔎 ركزوا في الأدلة وحاولوا معرفة القاتل.",

            embeds: [
                embed
            ],

            components: [
                suspectRow,
                controlRow
            ]
        });

    } catch (error) {

        console.error(
            "❌ خطأ في إرسال لعبة من القاتل:",
            error
        );

        activeGames.delete(guildId);
    }
}

// ==========================================================
// 🎮 التعامل مع أزرار اللعبة
// ==========================================================

async function handleKillerButton(interaction) {

    if (!interaction.guild) {
        return false;
    }

    const guildId =
        interaction.guild.id;

    const game =
        activeGames.get(guildId);

    // ======================================================
    // لا توجد لعبة
    // ======================================================

    if (!game) {

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            await interaction.reply({

                content:
                    "❌ لا توجد قضية شغالة حاليًا.",

                ephemeral: true
            });
        }

        return true;
    }

    // ======================================================
    // 🛑 إيقاف
    // ======================================================

    if (
        interaction.customId ===
        "killer_end"
    ) {

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            await interaction.reply({

                content:
                    "❌ زر إيقاف اللعبة مخصص للإدارة فقط.",

                ephemeral: true
            });

            return true;
        }

        activeGames.delete(guildId);

        await interaction.update({

            content:
                "🛑 **تم إيقاف قضية من القاتل بواسطة الإدارة.**",

            embeds: [],

            components: []
        });

        return true;
    }

    // ======================================================
    // 💡 التلميحات
    // ======================================================

    const hintMatch =
        interaction.customId.match(
            /^killer_hint_(\d+)$/
        );

    if (hintMatch) {

        const hintNumber =
            Number(hintMatch[1]);

        // --------------------------------------------------
        // التأكد أن التلميح صحيح
        // --------------------------------------------------

        if (
            hintNumber < 1 ||
            hintNumber > 3
        ) {

            await interaction.reply({

                content:
                    "❌ هذا التلميح غير موجود.",

                ephemeral: true
            });

            return true;
        }

        // --------------------------------------------------
        // منع تخطي التلميحات
        // --------------------------------------------------

        if (
            hintNumber >
            game.hintsUsed + 1
        ) {

            await interaction.reply({

                content:
                    `🔒 يجب استخدام **التلميح ${game.hintsUsed + 1}** أولًا.`,

                ephemeral: true
            });

            return true;
        }

        // --------------------------------------------------
        // إذا كان مستخدمًا
        // --------------------------------------------------

        if (
            hintNumber <=
            game.hintsUsed
        ) {

            await interaction.reply({

                content:
                    `💡 **التلميح ${hintNumber}:**\n` +
                    game.caseData.hints[
                        hintNumber - 1
                    ],

                ephemeral: true
            });

            return true;
        }

        // --------------------------------------------------
        // إظهار التلميح الجديد
        // --------------------------------------------------

        game.hintsUsed = hintNumber;

        await interaction.reply({

            content:
                `💡 **التلميح ${hintNumber}:**\n\n` +
                game.caseData.hints[
                    hintNumber - 1
                ],

            ephemeral: true
        });

        return true;
    }

    // ======================================================
    // منع الإجابة بعد الحل
    // ======================================================

    if (game.answered) {

        await interaction.reply({

            content:
                "❌ تم حل هذه القضية بالفعل.",

            ephemeral: true
        });

        return true;
    }

    // ======================================================
    // استخراج رقم الإجابة
    // ======================================================

    const match =
        interaction.customId.match(
            /^killer_answer_(\d+)$/
        );

    if (!match) {
        return false;
    }

    const selectedIndex =
        Number(match[1]);

    const selectedSuspect =
        game.caseData
            .suspects[selectedIndex];

    // ======================================================
    // حماية
    // ======================================================

    if (!selectedSuspect) {

        await interaction.reply({

            content:
                "❌ حدث خطأ في اختيار الإجابة.",

            ephemeral: true
        });

        return true;
    }

    // ======================================================
    // 🎉 إجابة صحيحة
    // ======================================================

    if (
        selectedSuspect ===
        game.caseData.killer
    ) {

        game.answered = true;

        const winEmbed =
            new EmbedBuilder()

                .setColor(0x00AA00)

                .setTitle(
                    "🎉 تم حل القضية!"
                )

                .setDescription(

                    `🕵️ **القضية:**\n` +
                    `${game.caseData.title}\n\n` +

                    `🏆 **القاتل هو:**\n` +
                    `## ${game.caseData.killer}\n\n` +

                    `💡 **الحل:**\n` +
                    `${game.caseData.answer}\n\n` +

                    `🎯 **حلها:** ${interaction.user.username}\n\n` +

                    `🔎 استخدمت **${game.hintsUsed}/3** تلميحات.`
                )

                .setFooter({
                    text:
                        "🕵️ أحسنت! تم حل القضية."
                })

                .setTimestamp();

        activeGames.delete(guildId);

        await interaction.update({

            content:
                "🎉 **تم حل القضية!**",

            embeds: [
                winEmbed
            ],

            components: []
        });

        return true;
    }

    // ======================================================
    // ❌ إجابة خاطئة
    // ======================================================

    await interaction.reply({

        content:
            `❌ **إجابة خاطئة يا ${interaction.user.username}!**\n\n` +
            `🔎 القضية ما زالت مستمرة.\n` +
            `💡 حاول استخدام الأدلة أو اطلب تلميحًا.`,

        ephemeral: true
    });

    return true;
}

// ==========================================================
// 🛑 إيقاف اللعبة من أمر "إيقاف"
// ==========================================================

async function stopKillerGame(channel) {

    if (
        !channel ||
        !channel.guild
    ) {

        return false;
    }

    const guildId =
        channel.guild.id;

    if (
        !activeGames.has(guildId)
    ) {

        return false;
    }

    activeGames.delete(guildId);

    await channel.send(
        "🛑 **تم إيقاف لعبة من القاتل.**"
    );

    return true;
}

// ==========================================================
// ⚙️ إعداد النظام
// ==========================================================

function setupKillerGame(client) {

    // ======================================================
    // 🕵️ أمر "من القاتل"
    // ======================================================

    client.on(
        "messageCreate",
        async message => {

            try {

                if (
                    message.author.bot
                ) {
                    return;
                }

                if (
                    !message.guild
                ) {
                    return;
                }

               
const content =
    message.content.trim();


            } catch (error) {

                console.error(
                    "❌ خطأ في أمر من القاتل:",
                    error
                );
            }
        }
    );

    // ======================================================
    // 🎮 أزرار اللعبة
    // ======================================================

    client.on(
        "interactionCreate",
        async interaction => {

            try {

                if (
                    !interaction.isButton()
                ) {
                    return;
                }

                if (
                    !interaction.customId.startsWith(
                        "killer_"
                    )
                ) {
                    return;
                }

                await handleKillerButton(
                    interaction
                );

            } catch (error) {

                console.error(
                    "❌ خطأ في أزرار من القاتل:",
                    error
                );

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {

                    await interaction.reply({

                        content:
                            "❌ حدث خطأ أثناء الضغط على الزر.",

                        ephemeral: true

                    }).catch(() => {});
                }
            }
        }
    );

    // ======================================================
    // 🛑 أمر "إيقاف"
    // ======================================================

    client.on(
        "messageCreate",
        async message => {

            try {

                if (
                    message.author.bot
                ) {
                    return;
                }

                if (
                    !message.guild
                ) {
                    return;
                }

                if (
                    message.content.trim() !==
                    "إيقاف"
                ) {
                    return;
                }

                // الإدارة فقط
                if (
                    !message.member.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {
                    return;
                }

                await stopKillerGame(
                    message.channel
                );

            } catch (error) {

                console.error(
                    "❌ خطأ في إيقاف لعبة من القاتل:",
                    error
                );
            }
        }
    );

    // ======================================================
    // ✅ تحميل النظام
    // ======================================================

    const totalCases =
        loadCases({ includeDisabled: true }).length;

    const enabledCases =
        loadCases().length;

    console.log(
        `🕵️ لعبة من القاتل: ${enabledCases}/${totalCases} قضية مفعلة`
    );
}

// ==========================================================
// 📤 Export
// ==========================================================

module.exports = {

    setupKillerGame,

    startKillerGame,

    handleKillerButton,

    stopKillerGame

};