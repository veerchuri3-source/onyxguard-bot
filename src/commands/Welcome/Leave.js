const Command = require("../../abstract/command");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");

module.exports = class LeaveCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "leave",
            aliases: ["goodbye", "leavemessage", "bye"],
            description: "Configure and manage leave/goodbye messages for your server",
            usage: [
                "leave",
                "leave set <#channel>",
                "leave delete",
                "leave test",
                "leave config",
                "leave channel <#channel>",
                "leave variables",
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
                    description: "View the Leave/Goodbye System dashboard and commands",
                },
                {
                    type: 1,
                    name: "set",
                    description: "Set Leave Message channel and preset",
                    options: [
                        {
                            type: 7,
                            name: "channel",
                            description: "Channel to send leave message",
                            required: true,
                        },
                    ],
                },
                {
                    type: 1,
                    name: "delete",
                    description: "Disable and delete Leave Message configuration",
                },
                {
                    type: 1,
                    name: "test",
                    description: "Test the Leave Message in the configured channel",
                },
                {
                    type: 1,
                    name: "config",
                    description: "View current Leave configuration and preview",
                },
                {
                    type: 1,
                    name: "variables",
                    description: "View all dynamic placeholders for leave messages",
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
                `• **System:** Leave System — ${guild.name}\n` +
                `• **Status:** ${isConfigured ? "`Active 🟢`" : "`Disabled 🔴`"} \n` +
                `• **Channel:** ${isConfigured ? `<#${data.channel}>` : "`Not configured`"}\n` +
                `• **Message Type:** ${data?.embeds && Object.keys(data.embeds).length > 0 ? "Custom Embed" : (data?.content && data.content.trim() ? "Text Message" : "*Default*")}\n\n` +
                `• **Quick Commands:**\n` +
                `> \`${prefix}leave set <#channel>\` • \`${prefix}leave test\`\n` +
                `> \`${prefix}leave delete\` • \`${prefix}leave variables\`\n\n` +
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
                    .setCustomId("leave_btn_set")
                    .setLabel("Set Channel & Preset")
                    .setEmoji("⚙️")
                    .setStyle(1),
                this.client.util
                    .button()
                    .setCustomId("leave_btn_test")
                    .setLabel("Test Leave")
                    .setEmoji("🧪")
                    .setStyle(3)
                    .setDisabled(!isConfigured),
                this.client.util
                    .button()
                    .setCustomId("leave_btn_config")
                    .setLabel("View Config")
                    .setEmoji("👁️")
                    .setStyle(2)
                    .setDisabled(!isConfigured),
                this.client.util
                    .button()
                    .setCustomId("leave_btn_vars")
                    .setLabel("Variables")
                    .setEmoji("📋")
                    .setStyle(2),
                this.client.util
                    .button()
                    .setCustomId("leave_btn_delete")
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
                id: "default_leave_preset_1",
                name: "Standard Goodbye Embed",
                content: "Goodbye {user.name} from {server.name}... 👋",
                embeds: {
                    title: "Farewell from {server.name}!",
                    description: "**{user.name}** has left the server.\nWe now have **{member.count}** members remaining. Safe travels!",
                    color: 0xed4245,
                    thumbnail: { url: "{user.avatar}" },
                    footer: { text: "{server.name} • Remaining: {member.count}", icon_url: "{server.icon}" },
                },
            },
            {
                id: "default_leave_preset_2",
                name: "Aesthetic Goodbye",
                content: "Sad to see you leave {user.name} 🍂",
                embeds: {
                    title: "✧ Member Left ✧",
                    description: "• **User:** {user.name} (`{user.id}`)\n• **Joined:** {user.joined}\n• **Total Members:** {member.count}",
                    color: 0x2b2d31,
                    footer: { text: "We hope to see you again!", icon_url: "{server.icon}" },
                },
            },
            {
                id: "default_leave_preset_3",
                name: "Simple Text Goodbye",
                content: "**{user.name}** has left **{server.name}**. We are now at **{member.count}** members.",
                embeds: {},
            },
        ];
    }

    async _handleSetFlow(ctx, channel, user, isSlash = false) {
        const guild = ctx.guild;
        const guildPresetsData = await this.client.database.welcomeUserData.get(guild.id);
        const defaultPresets = this._getDefaultPresets();
        const customPresets = (guildPresetsData?.message && guildPresetsData.message.length > 0)
            ? guildPresetsData.message.filter((p) => !p.id?.startsWith("example"))
            : [];
        let userPresets = [...defaultPresets, ...customPresets];

        const selectOptions = userPresets.slice(0, 25).map((p) => ({
            label: p.name.slice(0, 50),
            value: String(p.id),
            description: (p.content || "Custom embed preset").slice(0, 50),
        }));

        const menuRow = this.client.util.row().setComponents(
            this.client.util
                .menu()
                .setCustomId("leave_preset_select")
                .setPlaceholder("Choose a preset for the leave message")
                .addOptions(selectOptions)
        );

        const btnRow = this.client.util.row().setComponents(
            this.client.util.button().setCustomId("leave_save").setLabel("Save").setStyle(3),
            this.client.util.button().setCustomId("leave_cancel").setLabel("Cancel").setStyle(4)
        );

        const promptText = `**Setting Leave Channel:** <#${channel.id}>\nPlease choose an embed preset from the menu below, then click **Save**.\n*Need custom presets? Create them anytime with \`/embed create\`!*`;

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
            if (i.isStringSelectMenu() && i.customId === "leave_preset_select") {
                const selected = userPresets.find((p) => String(p.id) === i.values[0]);
                if (selected) {
                    presetName = selected.name;
                    dataToSave.content = selected.content || " ";
                    dataToSave.embeds = selected.embeds || {};
                }
                await i.deferUpdate().catch(() => {});
            }

            if (i.isButton()) {
                if (i.customId === "leave_save") {
                    if (!presetName) {
                        return i.reply({
                            content: `${this.client.config.Client.emoji.cross} Please select a preset from the menu before saving!`,
                            ephemeral: true,
                        });
                    }
                    await this.client.database.guildData.putLeave(guild.id, dataToSave);
                    await i.update({
                        content: `${this.client.config.Client.emoji.tick} **Leave Message Successfully Configured!**\n\n• **Channel:** <#${dataToSave.channel}>\n• **Selected Preset:** **${presetName}**`,
                        components: [],
                    }).catch(() => {
                        setupMsg.edit({
                            content: `${this.client.config.Client.emoji.tick} **Leave Message Successfully Configured!**\n\n• **Channel:** <#${dataToSave.channel}>\n• **Selected Preset:** **${presetName}**`,
                            components: [],
                        }).catch(() => {});
                    });
                    collector.stop("saved");
                }

                if (i.customId === "leave_cancel") {
                    await i.update({
                        content: "❌ Leave message configuration cancelled.",
                        components: [],
                    }).catch(() => {
                        setupMsg.delete().catch(() => {});
                    });
                    collector.stop("cancelled");
                }
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time") {
                setupMsg.edit({
                    content: "⏱️ Leave configuration session timed out.",
                    components: [],
                }).catch(() => {});
            }
        });
    }

    async run({ message, args }) {
        try {
            const data = await this.client.database.guildData.getLeave(message.guild.id);
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
                    if (i.customId === "leave_btn_set") {
                        await i.reply({
                            content: `ℹ️ To set the leave message, please specify a channel: \`${message.guild.config?.prefix || this.client.config.Client.Prefix || "$"}leave set <#channel>\``,
                            ephemeral: true,
                        });
                    } else if (i.customId === "leave_btn_test") {
                        await i.deferUpdate().catch(() => {});
                        const currentData = await this.client.database.guildData.getLeave(message.guild.id);
                        if (!currentData?.channel) {
                            return message.channel.send(`${this.client.config.Client.emoji.cross} Leave message has not been set up yet!`);
                        }
                        this.client.emit("guildMemberRemove", message.member);
                        message.channel.send(`${this.client.config.Client.emoji.tick} Sent test leave message to <#${currentData.channel}>!`).then((m) => {
                            setTimeout(() => m.delete().catch(() => {}), 5000);
                        });
                    } else if (i.customId === "leave_btn_config") {
                        await i.deferUpdate().catch(() => {});
                        const currentData = await this.client.database.guildData.getLeave(message.guild.id);
                        if (!currentData?.channel) {
                            return message.channel.send(`${this.client.config.Client.emoji.cross} Leave message is not set up!`);
                        }
                        const previewEmbed = this.client.util.embed()
                            .setTitle("📋 Current Leave Message Configuration")
                            .setColor(this.client.config.Client.PrimaryColor)
                            .setDescription(`• **Channel:** <#${currentData.channel}>\n• **Text Content:** \`${currentData.content || "None"}\`\n• **Embed:** ${currentData.embeds && Object.keys(currentData.embeds).length > 0 ? "Yes" : "No"}`);
                        message.channel.send({ embeds: [previewEmbed] });
                    } else if (i.customId === "leave_btn_vars") {
                        await i.deferUpdate().catch(() => {});
                        const varCmd = this.client.commands.get("variables");
                        if (varCmd && varCmd._buildEmbed) {
                            message.channel.send({ embeds: [varCmd._buildEmbed()] });
                        }
                    } else if (i.customId === "leave_btn_delete") {
                        await i.deferUpdate().catch(() => {});
                        await this.client.database.guildData.putLeave(message.guild.id, {
                            channel: null,
                            content: " ",
                            embeds: {},
                        });
                        msg.edit({
                            embeds: [this._buildDashboardEmbed(message.guild, { channel: null })],
                            components: this._buildDashboardButtons(false),
                        }).catch(() => {});
                        message.channel.send(`${this.client.config.Client.emoji.tick} Leave message disabled and deleted successfully!`);
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
                        embeds: [this.client.util.errorDelete(message, "Please mention or provide a valid text channel! Usage: `leave set <#channel>`")],
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
                        embeds: [this.client.util.errorDelete(message, "Please mention or provide a valid text channel! Usage: `leave channel <#channel>`")],
                    });
                }
                const currentData = await this.client.database.guildData.getLeave(message.guild.id) || {};
                currentData.channel = channel.id;
                if (!currentData.content) currentData.content = "Goodbye {user.name} from {server.name}!";
                await this.client.database.guildData.putLeave(message.guild.id, currentData);
                return message.reply(`${this.client.config.Client.emoji.tick} Leave channel updated to <#${channel.id}>!`);
            }

            if (sub === "delete" || sub === "disable" || sub === "reset") {
                await this.client.database.guildData.putLeave(message.guild.id, {
                    channel: null,
                    content: " ",
                    embeds: {},
                });
                return message.reply({
                    embeds: [this.client.util.doDeletesend(message, "Leave Message Has Been Successfully Deleted & Disabled!")],
                });
            }

            if (sub === "test") {
                if (!data?.channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Leave Message hasn't been set up yet! Use `leave set <#channel>` first.")],
                    });
                }
                message.reply({
                    embeds: [this.client.util.doDeletesend(message, `Sending test leave message to <#${data.channel}>...`)],
                });
                this.client.emit("guildMemberRemove", message.member);
                return;
            }

            if (sub === "config" || sub === "status" || sub === "view") {
                if (!data?.channel) {
                    return message.reply({
                        embeds: [this.client.util.errorDelete(message, "Leave message is not configured yet!")],
                    });
                }
                const previewEmbed = this.client.util.embed()
                    .setTitle("📋 Leave Message Configuration")
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
            console.error("Leave command error:", e);
        }
    }

    async exec({ interaction }) {
        try {
            const sub = interaction.options.getSubcommand();
            const data = await this.client.database.guildData.getLeave(interaction.guild.id);

            if (sub === "panel") {
                const embed = this._buildDashboardEmbed(interaction.guild, data);
                return interaction.reply({ embeds: [embed], components: this._buildDashboardButtons(Boolean(data?.channel)) });
            }

            if (sub === "set") {
                const channel = interaction.options.getChannel("channel") || interaction.channel;
                return this._handleSetFlow(interaction, channel, interaction.user, true);
            }

            if (sub === "delete") {
                await this.client.database.guildData.putLeave(interaction.guild.id, {
                    channel: null,
                    content: " ",
                    embeds: {},
                });
                return interaction.reply({
                    content: `${this.client.config.Client.emoji.tick} Leave Message Has Been Successfully Deleted!`,
                    ephemeral: true,
                });
            }

            if (sub === "test") {
                if (!data?.channel) {
                    return interaction.reply({
                        content: `${this.client.config.Client.emoji.cross} Leave Message has not been set up yet!`,
                        ephemeral: true,
                    });
                }
                this.client.emit("guildMemberRemove", interaction.member);
                return interaction.reply({
                    content: `${this.client.config.Client.emoji.tick} Leave message sent to <#${data.channel}>!`,
                    ephemeral: true,
                });
            }

            if (sub === "config") {
                if (!data?.channel) {
                    return interaction.reply({
                        content: `${this.client.config.Client.emoji.cross} Leave message is not configured yet!`,
                        ephemeral: true,
                    });
                }
                const previewEmbed = this.client.util.embed()
                    .setTitle("📋 Leave Message Configuration")
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
            console.error("Leave exec error:", e);
        }
    }
};
