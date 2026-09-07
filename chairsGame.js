
// ==========================================================
// 🪑 CHAIR GAME - Discord.js v14
// ==========================================================

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const crypto = require('crypto');

// ==========================================================
// ⚙️ إعدادات اللعبة - Live from Dashboard
// ==========================================================

const { getBotConfig } = require('./botConfig');

const CONFIG = new Proxy({}, {
    get(_target, key) {
        const cfg = getBotConfig().chairs || {};
        const values = {
            MAX_PLAYERS: Number(cfg.maxPlayers || 20),
            MIN_PLAYERS: Number(cfg.minPlayers || 2),
            START_COUNTDOWN: Number(cfg.startCountdownSeconds || 5),
            ROUND_TIME: Number(cfg.roundTimeSeconds || 20),
            BETWEEN_ROUNDS: Number(cfg.betweenRoundsMs || 2500),
            WINNER_REWARD: Number(cfg.winnerReward || 500)
        };
        return values[key];
    }
});

// ==========================================================
// 🎮 الألعاب الحالية
// ==========================================================

const games = new Map();

// ==========================================================
// 🔀 خلط Array
// ==========================================================

function shuffle(array) {

    const result = [...array];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];
    }

    return result;
}

// ==========================================================
// 🆔 إنشاء ID للعبة
// ==========================================================

function createGameId() {

    return crypto
        .randomBytes(6)
        .toString('hex');
}

// ==========================================================
// 🪑 إنشاء أزرار الجولة
// ==========================================================

function createRoundComponents(game) {

    const rows = [];

    let row = [];

    for (const button of game.buttons) {

        const customId =
            `chairs:press:${game.id}:${button.id}`;

        const discordButton =
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('🪑')
                .setStyle(
                    button.type === 'red'
                        ? ButtonStyle.Danger
                        : ButtonStyle.Primary
                )
                .setDisabled(button.disabled);

        row.push(discordButton);

        if (row.length === 5) {

            rows.push(
                new ActionRowBuilder()
                    .addComponents(row)
            );

            row = [];
        }
    }

    if (row.length > 0) {

        rows.push(
            new ActionRowBuilder()
                .addComponents(row)
        );
    }

    return rows;
}
// ==========================================================
// 🎮 أزرار اللوبي
// ==========================================================

function createLobbyComponents(game) {

    const joinButton =
        new ButtonBuilder()

            .setCustomId(
                `chairs:join:${game.id}`
            )

            .setLabel('انضم للعبة')

            .setEmoji('🟢')

            .setStyle(
                ButtonStyle.Success
            )

            .setDisabled(
                game.players.length >=
                CONFIG.MAX_PLAYERS
            );

    const leaveButton =
        new ButtonBuilder()

            .setCustomId(
                `chairs:leave:${game.id}`
            )

            .setLabel('اخرج من اللعبة')

            .setEmoji('🔴')

            .setStyle(
                ButtonStyle.Danger
            );

    const startButton =
        new ButtonBuilder()

            .setCustomId(
                `chairs:start:${game.id}`
            )

            .setLabel('ابدأ اللعبة')

            .setEmoji('▶️')

            .setStyle(
                ButtonStyle.Primary
            )

            .setDisabled(
                game.players.length <
                CONFIG.MIN_PLAYERS
            );

    const row =
        new ActionRowBuilder()
            .addComponents(
                joinButton,
                leaveButton,
                startButton
            );

    return [row];
}

// ==========================================================
// 📝 قائمة اللاعبين
// ==========================================================

function playersList(game) {

    if (game.players.length === 0) {

        return 'لا يوجد لاعبين حتى الآن.';
    }

    return game.players
        .map(
            (userId, index) =>
                `${index + 1}. <@${userId}>`
        )
        .join('\n');
}

// ==========================================================
// 📋 Embed اللوبي
// ==========================================================

function createLobbyEmbed(game) {

    return new EmbedBuilder()

        .setTitle('🪑 لعبة الكراسي')

        .setDescription(
            [
                '**طريقة اللعب:**',
                '',
                '1️⃣ اضغط على **انضم للعبة** للمشاركة.',
                '2️⃣ عند بدء الجولة ستظهر الكراسي.',
                '3️⃣ 🪑 يوجد دائمًا **كرسي واحد ناقص**.',
                '4️⃣ 🔵 الجولة الزرقاء = آمنة.',
                '5️⃣ 🔴 الجولة الحمراء = خطرة.',
                '6️⃣ 🎲 لون الجولة يختاره البوت عشوائيًا.',
                '',
                `👥 **اللاعبين (${game.players.length}/${CONFIG.MAX_PLAYERS})**`,
                playersList(game)
            ].join('\n')
        )

        .setColor(0x5865F2)

        .setFooter({
            text: '🪑 Chairs Game'
        });
}

// ==========================================================
// 🎮 Embed الجولة
// ==========================================================

function createRoundEmbed(game) {

    const available =
        game.buttons.filter(
            button =>
                !button.disabled
        ).length;

    const isRed =
        game.roundType === 'red';

    return new EmbedBuilder()

        .setTitle(
            `🪑 الجولة ${game.round}`
        )

        .setDescription(
            [
                `👥 اللاعبين المتبقين: **${game.players.length}**`,
                `🪑 الكراسي المتاحة: **${available}**`,
                '',
                isRed
                    ? '🔴 **جولة حمراء!**'
                    : '🔵 **جولة زرقاء!**',
                '',
                isRed
                    ? '💥 اضغط بحذر! أي كرسي أحمر يعني خروجك.'
                    : '✅ الكراسي الزرقاء آمنة.',
                '',
                '🪑 يوجد دائمًا كرسي واحد ناقص.',
                '',
                `⏱️ الوقت المتبقي: **${game.timeLeft} ثانية**`,
                '',
                '⚠️ يمكنك اختيار كرسي واحد فقط.'
            ].join('\n')
        )

        .setColor(
            isRed
                ? 0xFF3333
                : 0x3498DB
        )

        .setFooter({
            text: '🪑 اختر كرسيك بحذر 👀'
        });
}

// ==========================================================
// 🏆 Embed الفوز
// ==========================================================

function createWinnerEmbed(game) {

    return new EmbedBuilder()

        .setTitle(
            '🏆 انتهت لعبة الكراسي!'
        )

        .setDescription(
            [
                `🥇 **الفائز:** <@${game.winner}>`,
                '',
                `💰 **الجائزة:** ${CONFIG.WINNER_REWARD} ZOM`,
                '',
                '🎉 مبروك للفائز!'
            ].join('\n')
        )

        .setColor(0x00FF66)

        .setFooter({
            text: '🪑 Chairs Game'
        });
}

// ==========================================================
// ❌ Embed خروج لاعب
// ==========================================================

function createEliminationEmbed(
    userId,
    reason,
    playersLeft
) {

    return new EmbedBuilder()

        .setTitle(
            '💥 خرج لاعب!'
        )

        .setDescription(
            [
                `❌ <@${userId}> **خرج من اللعبة**.`,
                '',
                `📌 السبب: ${reason}`,
                '',
                `👥 اللاعبين المتبقين: **${playersLeft}**`
            ].join('\n')
        )

        .setColor(0xFF3333);
}

// ==========================================================
// 🎲 إنشاء الجولة
// ==========================================================

function generateRound(game) {

    // ======================================================
    // 🪑 كرسي ناقص دائمًا
    // ======================================================

    const numberOfChairs =
        Math.max(
            1,
            game.players.length - 1
        );

    // ======================================================
    // 🎲 اختيار نوع الجولة عشوائيًا
    // ======================================================

    game.roundType =
        Math.random() < 0.5
            ? 'blue'
            : 'red';

    // ======================================================
    // 🧹 حذف أزرار الجولة السابقة
    // ======================================================

    game.buttons = [];

    // ======================================================
    // 🪑 إنشاء الكراسي
    // ======================================================

    for (
        let i = 0;
        i < numberOfChairs;
        i++
    ) {

        game.buttons.push({

            id: String(i),

            type:
                game.roundType,

            disabled: false,

            claimedBy: null
        });
    }

    // ======================================================
    // 🔀 خلط أماكن الأزرار
    // ======================================================

    game.buttons =
        shuffle(game.buttons);

    // ======================================================
    // 🧹 تصفير اختيارات اللاعبين
    // ======================================================

    game.selectedPlayers =
        new Set();
}

// ==========================================================
// 🆕 إنشاء لعبة
// ==========================================================

async function createChairsGame(message) {

    if (!message.guild) {

        return message.reply(
            '❌ هذه اللعبة تعمل داخل السيرفر فقط.'
        );
    }

    // لا تسمح بلعبتين بنفس القناة
    if (
        games.has(
            message.channel.id
        )
    ) {

        return message.reply(
            '❌ يوجد بالفعل لعبة كراسي في هذه القناة.'
        );
    }

    const game = {

        id:
            createGameId(),

        channelId:
            message.channel.id,

        guildId:
            message.guild.id,

        hostId:
            message.author.id,

        players: [],

        eliminated: [],

        buttons: [],

        selectedPlayers:
            new Set(),

        round: 0,

        roundType:
            null,

        timeLeft: 0,

        status:
            'waiting',

        winner:
            null,

        message:
            null,

        timer:
            null,

        nextRoundTimer:
            null,

        countdownTimer:
            null
    };

    games.set(
        message.channel.id,
        game
    );

    try {

        const sentMessage =
            await message.channel.send({

                embeds: [
                    createLobbyEmbed(game)
                ],

                components:
                    createLobbyComponents(game)
            });

        game.message =
            sentMessage;

        return game;

    } catch (error) {

        console.error(
            '❌ خطأ أثناء إنشاء لعبة الكراسي:',
            error
        );

        games.delete(
            message.channel.id
        );

        return null;
    }
}

// ==========================================================
// 🟢 دخول اللعبة
// ==========================================================

async function joinGame(
    interaction,
    game
) {

    if (
        game.status !== 'waiting'
    ) {

        return interaction.reply({

            content:
                '❌ اللعبة بدأت بالفعل.',

            ephemeral: true
        });
    }

    if (
        game.players.includes(
            interaction.user.id
        )
    ) {

        return interaction.reply({

            content:
                '⚠️ أنت داخل اللعبة بالفعل.',

            ephemeral: true
        });
    }

    if (
        game.players.length >=
        CONFIG.MAX_PLAYERS
    ) {

        return interaction.reply({

            content:
                '❌ اللعبة ممتلئة.',

            ephemeral: true
        });
    }

    game.players.push(
        interaction.user.id
    );

    await interaction.update({

        embeds: [
            createLobbyEmbed(game)
        ],

        components:
            createLobbyComponents(game)
    });
}

// ==========================================================
// 🔴 الخروج من اللوبي
// ==========================================================

async function leaveGame(
    interaction,
    game
) {

    if (
        game.status !== 'waiting'
    ) {

        return interaction.reply({

            content:
                '❌ لا يمكنك الخروج الآن لأن اللعبة بدأت.',

            ephemeral: true
        });
    }

    const index =
        game.players.indexOf(
            interaction.user.id
        );

    if (index === -1) {

        return interaction.reply({

            content:
                '❌ أنت لست داخل اللعبة.',

            ephemeral: true
        });
    }

    game.players.splice(
        index,
        1
    );

    // إذا المضيف خرج
    if (
        game.hostId ===
        interaction.user.id
    ) {

        game.hostId =
            game.players[0] || null;
    }

    await interaction.update({

        embeds: [
            createLobbyEmbed(game)
        ],

        components:
            createLobbyComponents(game)
    });
}

// ==========================================================
// ▶️ بدء اللعبة
// ==========================================================

async function startGame(
    interaction,
    game
) {

    if (
        game.status !== 'waiting'
    ) {

        return interaction.reply({

            content:
                '❌ اللعبة بدأت بالفعل.',

            ephemeral: true
        });
    }

    // فقط المضيف
    if (
        interaction.user.id !==
        game.hostId
    ) {

        return interaction.reply({

            content:
                '❌ فقط صاحب اللعبة يستطيع بدء اللعبة.',

            ephemeral: true
        });
    }

    if (
        game.players.length <
        CONFIG.MIN_PLAYERS
    ) {

        return interaction.reply({

            content:
                `❌ تحتاج إلى ${CONFIG.MIN_PLAYERS} لاعبين على الأقل.`,

            ephemeral: true
        });
    }

    void require('./public/serverLogs').game(interaction,'الكراسي');
    game.status =
        'starting';

    await interaction.update({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🪑 لعبة الكراسي'
                )

                .setDescription(
                    [
                        '🔥 **اللعبة ستبدأ!**',
                        '',
                        `👥 عدد اللاعبين: **${game.players.length}**`,
                        '',
                        'استعدوا...'
                    ].join('\n')
                )

                .setColor(0xFFAA00)
        ],

        components: []
    });

    let countdown =
        CONFIG.START_COUNTDOWN;

    game.countdownTimer =
        setInterval(
            async () => {

                countdown--;

                if (
                    countdown <= 0
                ) {

                    clearInterval(
                        game.countdownTimer
                    );

                    game.countdownTimer =
                        null;

                    await startRound(game);

                    return;
                }

                try {

                    await game.message.edit({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    '🪑 لعبة الكراسي'
                                )

                                .setDescription(
                                    [
                                        '🔥 **اللعبة ستبدأ بعد:**',
                                        '',
                                        `# ${countdown}`,
                                        '',
                                        `👥 اللاعبين: **${game.players.length}**`
                                    ].join('\n')
                                )

                                .setColor(0xFFAA00)
                        ],

                        components: []
                    });

                } catch (error) {

                    console.error(
                        'Countdown error:',
                        error
                    );
                }

            },
            1000
        );
}

// ==========================================================
// 🎮 بدء الجولة
// ==========================================================

async function startRound(game) {

    if (
        game.players.length <= 1
    ) {

        return finishGame(game);
    }

    game.status =
        'playing';

    game.round++;

    game.timeLeft =
        CONFIG.ROUND_TIME;

    generateRound(game);

    try {

        await game.message.edit({

            embeds: [
                createRoundEmbed(game)
            ],

            components:
                createRoundComponents(game)
        });

    } catch (error) {

        console.error(
            '❌ خطأ بدء الجولة:',
            error
        );

        return;
    }

    // ======================================================
    // ⏱️ مؤقت الجولة
    // ======================================================

    game.timer =
        setInterval(
            async () => {

                game.timeLeft--;

                if (
                    game.timeLeft <= 5 ||
                    game.timeLeft % 5 === 0
                ) {

                    try {

                        await game.message.edit({

                            embeds: [
                                createRoundEmbed(game)
                            ],

                            components:
                                createRoundComponents(game)
                        });

                    } catch {}
                }

                if (
                    game.timeLeft <= 0
                ) {

                    clearInterval(
                        game.timer
                    );

                    game.timer =
                        null;

                    await endRound(game);
                }

            },
            1000
        );
}

// ==========================================================
// 🔘 الضغط على زر
// ==========================================================

async function pressButton(
    interaction,
    game,
    buttonId
) {

    if (
        game.status !== 'playing'
    ) {

        return interaction.reply({

            content:
                '❌ لا توجد جولة حالية.',

            ephemeral: true
        });
    }

    // ======================================================
    // التأكد أن اللاعب داخل اللعبة
    // ======================================================

    if (
        !game.players.includes(
            interaction.user.id
        )
    ) {

        return interaction.reply({

            content:
                '❌ أنت لست مشاركًا في اللعبة.',

            ephemeral: true
        });
    }

    // ======================================================
    // اللاعب اختار مسبقًا
    // ======================================================

    if (
        game.selectedPlayers.has(
            interaction.user.id
        )
    ) {

        return interaction.reply({

            content:
                '⚠️ لقد اخترت كرسيًا بالفعل في هذه الجولة.',

            ephemeral: true
        });
    }

    // ======================================================
    // البحث عن الزر
    // ======================================================

    const button =
        game.buttons.find(
            b =>
                b.id === buttonId
        );

    if (!button) {

        return interaction.reply({

            content:
                '❌ هذا الكرسي غير موجود.',

            ephemeral: true
        });
    }

    // ======================================================
    // الكرسي مأخوذ
    // ======================================================

    if (
        button.disabled
    ) {

        return interaction.reply({

            content:
                '⚠️ هذا الكرسي تم أخذه بالفعل.',

            ephemeral: true
        });
    }

    // ======================================================
    // تسجيل الاختيار
    // ======================================================

    game.selectedPlayers.add(
        interaction.user.id
    );

    button.disabled =
        true;

    // ======================================================
    // 🔴 الجولة الحمراء
    // ======================================================

    if (
        game.roundType === 'red'
    ) {

        game.players =
            game.players.filter(
                id =>
                    id !==
                    interaction.user.id
            );

        game.eliminated.push(
            interaction.user.id
        );

        try {

            await interaction.update({

                embeds: [
                    createRoundEmbed(game)
                ],

                components:
                    createRoundComponents(game)
            });

        } catch {

            try {

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {

                    await interaction.reply({

                        content:
                            '🔴 ضغطت على كرسي أحمر! ❌ خرجت من اللعبة.',

                        ephemeral: true
                    });
                }

            } catch {}
        }

        // رسالة عامة
        try {

            await interaction.followUp({

                embeds: [

                    createEliminationEmbed(

                        interaction.user.id,

                        '🔴 ضغط على كرسي أحمر',

                        game.players.length
                    )
                ]
            });

        } catch {}

        // ==================================================
        // هل بقي لاعب واحد؟
        // ==================================================

        if (
            game.players.length <= 1
        ) {

            if (game.timer) {

                clearInterval(
                    game.timer
                );

                game.timer =
                    null;
            }

            return finishGame(game);
        }

        // ==================================================
        // هل انتهت الكراسي؟
        // ==================================================

        const available =
            game.buttons.filter(
                b =>
                    !b.disabled
            ).length;

        if (
            available === 0
        ) {

            if (game.timer) {

                clearInterval(
                    game.timer
                );

                game.timer =
                    null;
            }

            return endRound(game);
        }

        return;
    }

    // ======================================================
    // 🔵 الجولة الزرقاء
    // ======================================================

    button.claimedBy =
        interaction.user.id;

    try {

        await interaction.update({

            embeds: [
                createRoundEmbed(game)
            ],

            components:
                createRoundComponents(game)
        });

    } catch {

        return;
    }

    // رسالة خاصة
    try {

        await interaction.followUp({

            content:
                '🔵 **آمن!** حصلت على كرسي وانتقلت للمرحلة التالية. 🪑',

            ephemeral: true
        });

    } catch {}

    // ======================================================
    // هل انتهت الكراسي؟
    // ======================================================

    const available =
        game.buttons.filter(
            b =>
                !b.disabled
        ).length;

    if (
        available === 0
    ) {

        if (game.timer) {

            clearInterval(
                game.timer
            );

            game.timer =
                null;
        }

        return endRound(game);
    }
}

// ==========================================================
// ⏰ نهاية الجولة
// ==========================================================

async function endRound(game) {

    if (
        game.status !== 'playing'
    ) {

        return;
    }

    if (game.timer) {

        clearInterval(
            game.timer
        );

        game.timer =
            null;
    }

    // ======================================================
    // 🔴 الجولة الحمراء
    // ======================================================

    if (
        game.roundType === 'red'
    ) {

        // في الجولة الحمراء:
        // أي شخص لم يضغط لا يخرج.
        // اللاعب الذي ضغط الأحمر خرج مسبقًا.

        if (
            game.players.length <= 1
        ) {

            return finishGame(game);
        }

        try {

            await game.message.edit({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            `🔴 نهاية الجولة ${game.round}`
                        )

                        .setDescription(
                            [
                                '🔴 **كانت هذه جولة حمراء!**',
                                '',
                                '❌ كل من ضغط على كرسي أحمر خرج من اللعبة.',
                                '',
                                `👥 اللاعبين المتبقين: **${game.players.length}**`
                            ].join('\n')
                        )

                        .setColor(0xFF3333)
                ],

                components: []
            });

        } catch {}

        game.status =
            'between';

        game.nextRoundTimer =
            setTimeout(
                async () => {

                    game.nextRoundTimer =
                        null;

                    if (
                        !games.has(
                            game.channelId
                        )
                    ) {

                        return;
                    }

                    if (
                        game.players.length <= 1
                    ) {

                        return finishGame(game);
                    }

                    await startRound(game);

                },
                CONFIG.BETWEEN_ROUNDS
            );

        return;
    }

    // ======================================================
    // 🔵 الجولة الزرقاء
    // ======================================================

    const safePlayers =
        game.buttons

            .filter(
                button =>
                    button.type === 'blue' &&
                    button.claimedBy
            )

            .map(
                button =>
                    button.claimedBy
            );

    // ======================================================
    // اللاعبين الذين لم يحصلوا على كرسي
    // ======================================================

    const playersWithoutChair =
        game.players.filter(
            userId =>
                !safePlayers.includes(
                    userId
                )
        );

    // ======================================================
    // 🪑 الكرسي الناقص
    // ======================================================

    if (
        playersWithoutChair.length > 0 &&
        game.players.length > 1
    ) {

        // بما أن هناك كرسيًا واحدًا ناقصًا،
        // الطبيعي أن يكون لاعب واحد فقط بدون كرسي.
        // نختار واحدًا بشكل آمن في حال وجود أكثر من واحد.

        const loser =
            playersWithoutChair[
                Math.floor(
                    Math.random() *
                    playersWithoutChair.length
                )
            ];

        game.players =
            game.players.filter(
                id =>
                    id !== loser
            );

        game.eliminated.push(
            loser
        );

        try {

            await game.message.edit({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            `🔵 نهاية الجولة ${game.round}`
                        )

                        .setDescription(
                            [
                                `❌ <@${loser}> لم يحصل على كرسي!`,
                                '',
                                '🪑 كان هناك كرسي واحد ناقص.',
                                '',
                                '💥 خرج من اللعبة.',
                                '',
                                `👥 اللاعبين المتبقين: **${game.players.length}**`
                            ].join('\n')
                        )

                        .setColor(0x3498DB)
                ],

                components: []
            });

        } catch {}
    }

    // ======================================================
    // 🏆 هل بقي لاعب واحد؟
    // ======================================================

    if (
        game.players.length <= 1
    ) {

        return finishGame(game);
    }

    // ======================================================
    // الجولة التالية
    // ======================================================

    game.status =
        'between';

    game.nextRoundTimer =
        setTimeout(
            async () => {

                game.nextRoundTimer =
                    null;

                if (
                    !games.has(
                        game.channelId
                    )
                ) {

                    return;
                }

                if (
                    game.players.length <= 1
                ) {

                    return finishGame(game);
                }

                await startRound(game);

            },
            CONFIG.BETWEEN_ROUNDS
        );
}

// ==========================================================
// 🛑 إيقاف اللعبة
// ==========================================================

async function stopChairsGame(
    channelId,
    stoppedBy = null
) {

    const game =
        games.get(channelId);

    if (!game) {

        return false;
    }

    // إيقاف المؤقت
    if (game.timer) {

        clearInterval(
            game.timer
        );

        game.timer =
            null;
    }

    // إيقاف العد التنازلي
    if (game.countdownTimer) {

        clearInterval(
            game.countdownTimer
        );

        game.countdownTimer =
            null;
    }

    // إيقاف الانتظار بين الجولات
    if (game.nextRoundTimer) {

        clearTimeout(
            game.nextRoundTimer
        );

        game.nextRoundTimer =
            null;
    }

    game.status =
        'stopped';

    try {

        await game.message.edit({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🛑 تم إيقاف لعبة الكراسي'
                    )

                    .setDescription(
                        [
                            '❌ تم إيقاف اللعبة.',
                            '',
                            game.players.length > 0
                                ? `👥 عدد اللاعبين: **${game.players.length}**`
                                : '👥 لم يبدأ أي لاعب.',
                            '',
                            stoppedBy
                                ? `🛑 أوقفها: <@${stoppedBy}>`
                                : ''
                        ].filter(Boolean).join('\n')
                    )

                    .setColor(0xFF3333)

                    .setFooter({
                        text: '🪑 Chairs Game'
                    })
            ],

            components: []
        });

    } catch {}

    games.delete(
        channelId
    );

    return true;
}

// ==========================================================
// 🏆 إنهاء اللعبة
// ==========================================================

async function finishGame(game) {

    if (
        game.timer
    ) {

        clearInterval(
            game.timer
        );

        game.timer =
            null;
    }

    if (
        game.nextRoundTimer
    ) {

        clearTimeout(
            game.nextRoundTimer
        );

        game.nextRoundTimer =
            null;
    }

    if (
        game.countdownTimer
    ) {

        clearInterval(
            game.countdownTimer
        );

        game.countdownTimer =
            null;
    }

    game.status =
        'finished';

    // ======================================================
    // 🏆 يوجد فائز
    // ======================================================

    if (
        game.players.length === 1
    ) {

        game.winner =
            game.players[0];

        try {

            await game.message.edit({

                embeds: [
                    createWinnerEmbed(game)
                ],

                components: []
            });

        } catch {}

        // ==================================================
        // 💰 ربط ZOM
        // ==================================================

        /*
        
        إذا كان getUser و saveEconomy
        موجودين في index.js عندك،
        يمكنك لاحقًا ربط الجائزة هنا.

        مثال:

        const user = getUser(game.winner);

        user.balance += CONFIG.WINNER_REWARD;

        saveEconomy();

        */

    } else {

        try {

            await game.message.edit({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            '🪑 انتهت اللعبة'
                        )

                        .setDescription(
                            '❌ انتهت اللعبة بدون فائز.'
                        )

                        .setColor(0xFF3333)
                ],

                components: []
            });

        } catch {}
    }

    // ======================================================
    // 🧹 حذف اللعبة من الذاكرة
    // ======================================================

 games.delete(
        game.channelId
    );
}

// ==========================================================
// 🖱️ التعامل مع تفاعلات اللعبة
// ==========================================================

async function handleChairsInteraction(
    interaction
) {

    if (
        !interaction.isButton()
    ) {

        return false;
    }

    const customId =
        interaction.customId;

    // ليست لعبة الكراسي
    if (
        !customId.startsWith(
            'chairs:'
        )
    ) {

        return false;
    }

    const parts =
        customId.split(':');

    /*
        chairs:join:GAME_ID
        chairs:leave:GAME_ID
        chairs:start:GAME_ID
        chairs:press:GAME_ID:BUTTON_ID
    */

    const action =
        parts[1];

    const gameId =
        parts[2];

    // ======================================================
    // البحث عن اللعبة
    // ======================================================

    let game =
        null;

    for (
        const currentGame
        of games.values()
    ) {

        if (
            currentGame.id ===
            gameId
        ) {

            game =
                currentGame;

            break;
        }
    }

    // ======================================================
    // اللعبة غير موجودة
    // ======================================================

    if (!game) {

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            await interaction.reply({

                content:
                    '❌ هذه اللعبة انتهت أو لم تعد موجودة.',

                ephemeral: true
            });
        }

        return true;
    }

    // ======================================================
    // دخول
    // ======================================================

    if (
        action === 'join'
    ) {

        await joinGame(
            interaction,
            game
        );

        return true;
    }

    // ======================================================
    // خروج
    // ======================================================

    if (
        action === 'leave'
    ) {

        await leaveGame(
            interaction,
            game
        );

        return true;
    }

    // ======================================================
    // بدء
    // ======================================================

    if (
        action === 'start'
    ) {

        await startGame(
            interaction,
            game
        );

        return true;
    }

    // ======================================================
    // ضغط كرسي
    // ======================================================

    if (
        action === 'press'
    ) {

        const buttonId =
            parts[3];

        await pressButton(
            interaction,
            game,
            buttonId
        );

        return true;
    }

    return true;
}

// ==========================================================
// 📤 Export
// ==========================================================

module.exports = {

    createChairsGame,

    handleChairsInteraction,

    stopChairsGame,

    games,

    CONFIG
};

