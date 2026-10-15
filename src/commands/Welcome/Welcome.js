const Command = require("../../abstract/command");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");

module.exports = class WelcomeCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "welcome",
            aliases: ["wel", "welcomesetup"],
            description: "Configure and manage welcome messages for your server",
            usage: [
                "welcome",
                "welcome set <#channel>",
                "welcome delete",
                "welcome test",
                "welcome config",
                "welcome channel <#channel>",
                "welcome variables",
            ],
            category: "Welcome",
            userPerms: ["ManageGuild"],
            botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
            cooldown: 5,
            image: "https://i.imgur.com/BA5XIva.png",
            options: [
                {
                    type: 1,
                    name: "panel",
                    description: "View the Welcome System dashboard and commands",
                },
                {
                    type: 1,
                    name: "set",
                    description: "Set Welcome Message channel and preset",
                    options: [
                        {
                            type: 7,
                            name: "channel",
                            description: "Channel to send welcome message",
                            required: true,
                        },
                    ],
                },
                {
                    type: 1,
                    name: "delete",
                    description: "Disable and delete Welcome Message configuration",
                },
                {
                    type: 1,
                    name: "test",
                    description: "Test the Welcome Message in the configured channel",
                },
                {
                    type: 1,
                    name: "config",
                    description: "View current Welcome configuration and preview",
                },
                {
                    type: 1,
                    name: "variables",
                    description: "View all dynamic placeholders for welcome messages",
                },
            ],
        });
    }

    _buildDashboardEmbed(guild, data) {
        const isConfigured = Boolean(data && data.channel);
        const prefix = guild.config?.prefix || this.client.config.Client.Prefix;

        return new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle("Hey , I'm OnyxGuard™")
            .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `A powerful multipurpose bot with Fastest Antinuke\n\n` +
                `• **System:** Welcome System — ${guild.name}\n` +
                `• **Status:** ${isConfigured ? "`Active 🟢`" : "`Disabled 🔴`"}\n` +
                `• **Channel:** ${isConfigured ? `<#${data.channel}>` : "`Not configured`"}\n` +
                `• **Message Type:** ${data?.embeds && Object.keys(data.embeds).length > 0 ? "Custom Embed" : (data?.content && data.content.trim() ? "Text Message" : "*Default*")}\n\n` +
                `• **Quick Commands:**\n` +
                `> \`${prefix}welcome set <#channel>\` • \`${prefix}welcome test\`\n` +
                `> \`${prefix}welcome delete\` • \`${prefix}welcome variables\`\n\n` +
                `**🔗 Links**\n` +
                `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
            )
            .setFooter({
                text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
                iconURL: this.client.user?.displayAvatarURL(),
            });
    }

    _buildDashboardButtons(isConfigured) {
        return [
            this.client.util.row().setComponents(
                this.client.util
                    .button()
                    .setCustomId("welcome_btn_set")
                    .setLabel("Set Channel & Preset")
                    .setEmoji("⚙️")
                    .setStyle(1),
                this.client.util
                    .button()
                    .setCustomId("welcome_btn_test")
                    .setLabel("Test Welcome")
                    .setEmoji("🧪")
                    .setStyle(3)
                    .setDisabled(!isConfigured),
                this.client.util
                    .button()
                    .setCustomId("welcome_btn_config")
                    .setLabel("View Config")
                    .setEmoji("👁️")
                    .setStyle(2)
                    .setDisabled(!isConfigured),
                this.client.util
                    .button()
                    .setCustomId("welcome_btn_vars")
                    .setLabel("Variables")
                    .setEmoji("📋")
                    .setStyle(2),
                this.client.util
                    .button()
                    .setCustomId("welcome_btn_delete")
                    .setLabel("Disable")
                    .setEmoji("🗑️")
                    .setStyle(4)
                    .setDisabled(!isConfigured)
            ),
        ];
    }

    _getDefaultPresets() {
        return [
            {
                id: "default_preset_1",
                name: "Standard Welcome Embed",
                content: "Welcome {user} to {server.name}! 🎉",
                embeds: {
                    title: "Welcome to {server.name}!",
                    description: "Hey {user}, welcome to **{server.name}**!\nYou are our **{member.count}**th member. We are delighted to have you here! Enjoy your stay.",
                    color: 0x5865f2,
                    thumbnail: { url: "{user.avatar}" },
                    footer: { text: "{server.name} • Member #{member.count}", icon_url: "{server.icon}" },
                },
            },
            {
                id: "default_preset_2",
                name: "Simple Aesthetic Welcome",
                content: "Welcome {user}! 💫",
                embeds: {
                    title: "✧ Welcome to {server.name} ✧",
                    description: "• Make sure to read the rules\n• Choose your roles and introduce yourself\n• Have fun in chat!",
                    color: 0x2b2d31,
                    footer: { text: "Enjoy your stay!", icon_url: "{server.icon}" },
                },
            },
            {
                id: "default_preset_3",
                name: "Text Only Message",
                content: "Hey {user}, welcome to **{server.name}**! You are our **{member.count}**th member! 🎉",
                embeds: {},
            },
        ];
    }

    async _handleSetFlow(ctx, channel, user, isSlash = false) {
        const guild = ctx.guild;
        const guildPresetsData = await this.client.database.welcomeUserData.get(guild.id);
        let userPresets = (guildPresetsData?.message && guildPresetsData.message.length > 0) ? guildPresetsData.message : [];
        if (userPresets.length === 0) {
            userPresets = this._getDefaultPresets();
        }

        const selectOptions = userPresets.slice(0, 25).map((p) => ({
            label: p.name.slice(0, 50),
            value: String(p.id),
            description: (p.content || "Custom embed preset").slice(0, 50),
        }));

        const menuRow = this.client.util.row().setComponents(
            this.client.util
                .menu()
                .setCustomId("welcome_preset_select")
                .setPlaceholder("Choose a preset for the welcome message")
                .addOptions(selectOptions)
        );

        const btnRow = this.client.util.row().setComponents(
            this.client.util.button().setCustomId("welcome_save").setLabel("Save").setStyle(3),
            this.client.util.button().setCustomId("welcome_cancel").setLabel("Cancel").setStyle(4)
        );

        const promptText = `**Setting Welcome Channel:** <#${channel.id}>\nPlease choose an embed preset from the menu below, then click **Save**.\n*Need custom presets? Create them anytime with \`/embed create\`!*`;

        const setupMsg = isSlash
            ? await ctx.reply({ content: promptText, components: [menuRow, btnRow], fetchReply: true, ephemeral: false })
            : await ctx.reply({ content: promptText, components: [menuRow, btnRow] });

        const filter = (i) => i.user.id === user.id;
        const collector = setupMsg.createMessageComponentCollector({ filter, time: 60000 });

        let presetName = "";
        let dataToSave = {
            channel: channel.id,
            content: " ",
            embeds: {},
        };

        collector.on("collect", async (i) => {
            if (i.isStringSelectMenu() && i.customId === "welcome_preset_select") {
                const selected = userPresets.find((p) => String(p.id) === i.values[0]);
                if (selected) {
                    presetName = selected.name;
                    dataToSave.content = selected.content || " ";
                    dataToSave.embeds = selected.embeds || {};
                }
                await i.deferUpdate().catch(() => {});
            }

            if (i.isButton()) {
                if (i.customId === "welcome_save") {
                    if (!presetName) {
                        return i.reply({
                            content: `${this.client.config.Client.emoji.cross} Please select a preset from the menu before saving!`,
                            ephemeral: true,
                        });
                    }
                    await this.client.database.guildData.putWelcome(guild.id, dataToSave);
                    await setupMsg.edit({
                        content: `${this.client.config.Client.emoji.tick} **Welcome Message Successfully Configured!**\n\n• **Channel:** <#${dataToSave.channel}>\n• **Selected Preset:** **${presetName}**`,
                        components: [],
                    }).catch(() => {});
                    collector.stop();
                }

                if (i.customId === "welcome_cancel") {
                    setupMsg.delete().catch(() => {});
                    collector.stop();
                }
            }
        });
    }

    async run({ message, args }) {
        try {
            const data = await this.client.database.guildData.getWelcome(message.guild.id);
            const sub = args[0]?.toLowerCase();

            // Default / Help dashboard
            if (!sub || sub === "help" || sub === "panel" || sub === "menu") {
                const embed = this._buildDashboardEmbed(message.guild, data);
                const isConfigured = Boolean(data && data.channel);
                const components = this._buildDashboardButtons(isConfigured);
                const msg = await message.reply({ embeds: [embed], components });

                const filter = (i) => i.user.id === message.author.id;
                const collector = msg.createMessageComponentCollector({ filter, time: 90000 });

                collector.on("collect", async (i) => {
                    if (i.customId === "welcome_btn_set") {
                        await i.reply({
                            content: `ℹ️ To set the welcome message, please specify a channel: \`${message.guild.config?.prefix || this.client.config.Client.Prefix || "$"}welcome set <#channel>\``,
                            ephemeral: true,
                        });
                    } else if (i.customId === "welcome_btn_test") {
                        await i.deferUpdate().catch(() => {});
                        const currentData = await this.client.database.guildData.getWelcome(message.guild.id);
                        if (!currentData?.channel) {
                            return message.channel.send(`${this.client.config.Client.emoji.cross} Welcome message has not been set up yet!`);
                        }
                        this.client.emit("guildMemberAdd", message.member);
                        message.channel.send(`${this.client.config.Client.emoji.tick} Sent test welcome message to <#${currentData.channel}>!`).then((m) => {
                            setTimeout(() => m.delete().catch(() => {}), 5000);
                        });
                    } else if (i.customId === "welcome_btn_config") {
                        await i.deferUpdate().catch(() => {});
                        const currentData = await this.client.database.guildData.getWelcome(message.guild.id);
                        if (!currentData?.channel) {
                            return message.channel.send(`${this.client.config.Client.emoji.cross} Welcome message is not set up!`);
                        }
                        const previewEmbed = this.client.util.embed()
                            .setTitle("📋 Current Welcome Message Configuration")
                            .setColor(this.client.config.Client.PrimaryColor)
                            .setDescription(`• **Channel:** <#${currentData.channel}>\n• **Text Content:** \`${currentData.content || "None"}\`\n• **Embed:** ${currentData.embeds && Object.keys(currentData.embeds).length > 0 ? "Yes" : "No"}`);
                        message.channel.send({ embeds: [previewEmbed] });
                    } else if (i.customId === "welcome_btn_vars") {
                        await i.deferUpdate().catch(() => {});
                        const varCmd = this.client.commands.get("variables");
                        if (varCmd && varCmd._buildEmbed) {
                            message.channel.send({ embeds: [varCmd._buildEmbed()] });
                        }
                    } else if (i.customId === "welcome_btn_delete") {
                        await i.deferUpdate().catch(() => {});
                        await this.client.database.guildData.putWelcome(message.guild.id, {
                            channel: null,
                            content: " ",
                            embeds: {},
                        });
                        msg.edit({
                            embeds: [this._buildDashboardEmbed(message.guild, { channel: null })],
                            components: this._buildDashboardButtons(false),
                        }).catch(() => {});
                        message.channel.send(`${this.client.config.Client.emoji.tick} Welcome message disabled and deleted successfully!`);
                    }
                });
                return;
            }

            if (sub === "set") {
                const channel =
                    message.mentions.channels.first() ||
                    message.guild.channels.cache.get(args[1]) ||
                    message.guild.channels.cache.find(
                        (r) => r.name.toLowerCase() === args.slice(1).join(" ").toLowerCase()
                    );
                if (!channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Please mention or provide a valid text channel! Usage: `welcome set <#channel>`")],
                    });
                }
                return this._handleSetFlow(message, channel, message.author, false);
            }

            if (sub === "channel") {
                const channel =
                    message.mentions.channels.first() ||
                    message.guild.channels.cache.get(args[1]) ||
                    message.guild.channels.cache.find(
                        (r) => r.name.toLowerCase() === args.slice(1).join(" ").toLowerCase()
                    );
                if (!channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Please mention or provide a valid text channel! Usage: `welcome channel <#channel>`")],
                    });
                }
                const currentData = await this.client.database.guildData.getWelcome(message.guild.id) || {};
                currentData.channel = channel.id;
                if (!currentData.content) currentData.content = "Welcome {user} to {server.name}!";
                await this.client.database.guildData.putWelcome(message.guild.id, currentData);
                return message.reply(`${this.client.config.Client.emoji.tick} Welcome channel updated to <#${channel.id}>!`);
            }

            if (sub === "delete" || sub === "disable" || sub === "reset") {
                await this.client.database.guildData.putWelcome(message.guild.id, {
                    channel: null,
                    content: " ",
                    embeds: {},
                });
                return message.reply({
                    embeds: [this.client.util.doDeletesend(message, "Welcome Message Has Been Successfully Deleted & Disabled!")],
                });
            }

            if (sub === "test") {
                if (!data?.channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Welcome Message hasn't been set up yet! Use `welcome set <#channel>` first.")],
                    });
                }
                message.reply({
                    embeds: [this.client.util.doDeletesend(message, `Sending test welcome message to <#${data.channel}>...`)],
                });
                this.client.emit("guildMemberAdd", message.member);
                return;
            }

            if (sub === "config" || sub === "status" || sub === "view") {
                if (!data?.channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Welcome message is not configured yet!")],
                    });
                }
                const previewEmbed = this.client.util.embed()
                    .setTitle("📋 Welcome Message Configuration")
                    .setColor(this.client.config.Client.PrimaryColor)
                    .addFields(
                        { name: "Channel", value: `<#${data.channel}> (\`${data.channel}\`)`, inline: true },
                        { name: "Has Embed", value: data.embeds && Object.keys(data.embeds).length > 0 ? "Yes" : "No", inline: true },
                        { name: "Content Preview", value: `\`${data.content || "Default"}\`` }
                    );
                return message.reply({ embeds: [previewEmbed] });
            }

            if (sub === "variables" || sub === "vars") {
                const varCmd = this.client.commands.get("variables");
                if (varCmd && varCmd._buildEmbed) {
                    return message.reply({ embeds: [varCmd._buildEmbed()] });
                }
            }

            return message.reply({
                embeds: [this._buildDashboardEmbed(message.guild, data)],
                components: this._buildDashboardButtons(Boolean(data?.channel)),
            });
        } catch (e) {
            console.error("Welcome command error:", e);
        }
    }

    async exec({ interaction }) {
        try {
            const sub = interaction.options.getSubcommand();
            const data = await this.client.database.guildData.getWelcome(interaction.guild.id);

            if (sub === "panel") {
                const embed = this._buildDashboardEmbed(interaction.guild, data);
                return interaction.reply({ embeds: [embed], components: this._buildDashboardButtons(Boolean(data?.channel)) });
            }

            if (sub === "set") {
                const channel = interaction.options.getChannel("channel") || interaction.channel;
                return this._handleSetFlow(interaction, channel, interaction.user, true);
            }

            if (sub === "delete") {
                await this.client.database.guildData.putWelcome(interaction.guild.id, {
                    channel: null,
                    content: " ",
                    embeds: {},
                });
                return interaction.reply({
                    content: `${this.client.config.Client.emoji.tick} Welcome Message Has Been Successfully Deleted!`,
                    ephemeral: true,
                });
            }

            if (sub === "test") {
                if (!data?.channel) {
                    return interaction.reply({
                        content: `${this.client.config.Client.emoji.cross} Welcome Message has not been set up yet!`,
                        ephemeral: true,
                    });
                }
                this.client.emit("guildMemberAdd", interaction.member);
                return interaction.reply({
                    content: `${this.client.config.Client.emoji.tick} Welcome message sent to <#${data.channel}>!`,
                    ephemeral: true,
                });
            }

            if (sub === "config") {
                if (!data?.channel) {
                    return interaction.reply({
                        content: `${this.client.config.Client.emoji.cross} Welcome message is not configured yet!`,
                        ephemeral: true,
                    });
                }
                const previewEmbed = this.client.util.embed()
                    .setTitle("📋 Welcome Message Configuration")
                    .setColor(this.client.config.Client.PrimaryColor)
                    .addFields(
                        { name: "Channel", value: `<#${data.channel}>`, inline: true },
                        { name: "Has Embed", value: data.embeds && Object.keys(data.embeds).length > 0 ? "Yes" : "No", inline: true },
                        { name: "Content", value: `\`${data.content || "None"}\`` }
                    );
                return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
            }

            if (sub === "variables") {
                const varCmd = this.client.commands.get("variables");
                if (varCmd && varCmd._buildEmbed) {
                    return interaction.reply({ embeds: [varCmd._buildEmbed()], ephemeral: true });
                }
            }
        } catch (e) {
            console.error("Welcome exec error:", e);
        }
    }
};
