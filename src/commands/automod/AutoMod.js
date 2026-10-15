/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Command = require("../../abstract/command");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

// ─────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────
const COLORS = {
  active: 0x00E676,
  disabled: 0xFF1744,
  accent: 0x7C4DFF,
  info: 0x448AFF,
  warning: 0xFFAB00,
  neutral: 0x2B2D31,
};

const AUTOMOD_MODULES = [
  { id: "antiSpam", label: "Anti Spam", description: "Stops message flooding & rapid spam with auto-timeout", emoji: "⚡" },
  { id: "antiCaps", label: "Anti Caps", description: "Deletes messages with excessive capital letters", emoji: "🔠" },
  { id: "antiLink", label: "Anti Link", description: "Blocks unauthorized Discord server invites & external links", emoji: "🔗" },
  { id: "antiMention", label: "Anti Mention", description: "Blocks excessive user/role mentions and mass pings", emoji: "📯" },
  { id: "antiWord", label: "Anti Bad Words", description: "Filters toxic, vulgar, and blacklisted keywords", emoji: "🚫" },
];

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────
function buildProgressBar(active, total) {
  const filled = Math.round((active / total) * 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} **${active}/${total}**`;
}

module.exports = class AutoModCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "automod",
      aliases: ["automoderation", "am"],
      description: "Advanced Server Auto-Moderation & Protection System",
      usage: ["automod [enable|disable|status|setlog|whitelist]"],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages", "ManageGuild", "ModerateMembers", "BanMembers"],
      guildOnly: true,
      cooldown: 3,
      options: [
        { type: 1, name: "enable", description: "Select and enable AutoMod protection modules" },
        { type: 1, name: "disable", description: "Disable AutoMod protections" },
        { type: 1, name: "status", description: "View current AutoMod status and active modules" },
        {
          type: 1, name: "setlog", description: "Set the AutoMod security log channel",
          options: [{ type: 7, name: "channel", description: "Channel for AutoMod logs", required: true }],
        },
        {
          type: 1, name: "whitelist", description: "Whitelist or unwhitelist a user from AutoMod",
          options: [{ type: 6, name: "user", description: "User to whitelist or remove", required: true }],
        },
      ],
    });
  }

  // ── Data ──────────────────────────────────────────────
  async _getAutoModData(guildId) {
    let data = await this.client.cache.get("automod_" + guildId);
    if (!data) {
      data = await this.client.database.autoModData.get(guildId);
      if (data) await this.client.cache.set("automod_" + guildId, data);
    }
    if (!data || typeof data !== "object") data = {};
    if (typeof data.enabled !== "boolean") data.enabled = false;
    if (!Array.isArray(data.whitelistusers)) data.whitelistusers = [];
    if (!data.features || typeof data.features !== "object") {
      data.features = Object.fromEntries(AUTOMOD_MODULES.map((m) => [m.id, false]));
    }
    return data;
  }

  // ── Setup / Selection Embed (Image 2 Style) ───────────
  _buildSetupEmbed(guild, data, selectedModules = []) {
    const prefix = guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const isEnabled = Boolean(data.enabled);
    const activeMods = AUTOMOD_MODULES.filter((m) => selectedModules.includes(m.id));
    const inactiveMods = AUTOMOD_MODULES.filter((m) => !selectedModules.includes(m.id));

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
        `• **Prefix:** \`${prefix}\`\n` +
        `• **AutoMod Status:** ${isEnabled ? "`Active 🟢`" : "`Offline 🔴`"}\n` +
        `• **Selected Modules:** \`${selectedModules.length}/${AUTOMOD_MODULES.length}\`\n` +
        `• **Log Channel:** ${data.logchannelid ? `<#${data.logchannelid}>` : "`Not configured`"}\n\n` +
        `• **Selected Protections (${selectedModules.length}):**\n` +
        `> ${activeMods.length > 0 ? activeMods.map((m) => `${m.emoji} \`${m.label}\``).join(" • ") : "*None selected*"}\n\n` +
        `• **Unselected Protections (${inactiveMods.length}):**\n` +
        `> ${inactiveMods.length > 0 ? inactiveMods.map((m) => `${m.emoji} \`${m.label}\``).join(" • ") : "*All selected*"}\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/YtSejhTGzw)`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ── Status Embed (Image 2 Style) ──────────────────────
  _buildStatusEmbed(guild, data) {
    const prefix = guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const isEnabled = Boolean(data.enabled);
    const activeMods = AUTOMOD_MODULES.filter((m) => isEnabled && data.features?.[m.id] !== false);
    const inactiveMods = AUTOMOD_MODULES.filter((m) => !isEnabled || data.features?.[m.id] === false);

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
        `• **Prefix:** \`${prefix}\`\n` +
        `• **AutoMod Status:** ${isEnabled ? "`Active & Enforcing 🟢`" : "`Protection Offline 🔴`"}\n` +
        `• **Active Modules:** \`${activeMods.length}/${AUTOMOD_MODULES.length}\`\n` +
        `• **Whitelisted Users:** \`${data.whitelistusers?.length || 0}\` | **Logs:** ${data.logchannelid ? `<#${data.logchannelid}>` : "`Not configured`"}\n\n` +
        `• **Active Protections (${activeMods.length}):**\n` +
        `> ${activeMods.length > 0 ? activeMods.map((m) => `\`${m.label}\``).join(" • ") : "*None active*"}\n\n` +
        `• **Disabled Protections (${inactiveMods.length}):**\n` +
        `> ${inactiveMods.length > 0 ? inactiveMods.map((m) => `\`${m.label}\``).join(" • ") : "*All active*"}\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
      )
      .setFooter({
        text: `Powered By OnyxGuard Development™ | Designed By .1xylen`,
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ── Components ────────────────────────────────────────
  _buildComponents(selectedModules = [], disabled = false) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("automod_select_modules")
      .setPlaceholder(selectedModules.length > 0 ? `❯ Active Modules (${selectedModules.length}/${AUTOMOD_MODULES.length})` : "❯ Select AutoMod Modules to Activate")
      .setMinValues(0)
      .setMaxValues(AUTOMOD_MODULES.length)
      .setDisabled(disabled)
      .addOptions(
        AUTOMOD_MODULES.map((m) => ({
          label: m.label,
          value: m.id,
          description: m.description.slice(0, 50),
          emoji: m.emoji,
          default: selectedModules.includes(m.id),
        }))
      );

    const menuRow = new ActionRowBuilder().addComponents(selectMenu);

    const continueBtn = new ButtonBuilder()
      .setCustomId("automod_btn_continue")
      .setLabel("Continue & Enable")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled);

    const enableAllBtn = new ButtonBuilder()
      .setCustomId("automod_btn_enable_all")
      .setLabel("Select All")
      .setEmoji("⚡")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled);

    const clearBtn = new ButtonBuilder()
      .setCustomId("automod_btn_clear")
      .setLabel("Clear All")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const disableBtn = new ButtonBuilder()
      .setCustomId("automod_btn_disable")
      .setLabel("Disable AutoMod")
      .setEmoji("🛑")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled);

    const buttonRow = new ActionRowBuilder().addComponents(continueBtn, enableAllBtn, clearBtn, disableBtn);

    return [menuRow, buttonRow];
  }

  // ── Discord Native Rules Sync ─────────────────────────
  async _syncDiscordAutoModRules(guild, features) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) return;
    try {
      const existingRules = await guild.autoModerationRules.fetch().catch(() => null);
      if (!existingRules) return;

      const linkRuleName = "Synapse AutoMod - Anti Link";
      const mentionRuleName = "Synapse AutoMod - Anti Mention";

      const existingLinkRule = existingRules.find((r) => r.name === linkRuleName);
      const existingMentionRule = existingRules.find((r) => r.name === mentionRuleName);

      if (features.antiLink) {
        if (!existingLinkRule) {
          await guild.autoModerationRules.create({
            name: linkRuleName, creatorId: this.client.user.id, enabled: true,
            eventType: 1, triggerType: 1,
            triggerMetadata: { keywordFilter: ["*discord.gg*", "*discord.com/invite*", "*http://*", "*https://*"] },
            actions: [{ type: 1, metadata: { customMessage: "🚫 Links are not permitted in this server!" } }],
          }).catch(() => { });
        }
      } else {
        for (const rule of existingRules.values()) {
          const n = rule.name.toLowerCase();
          if ((n.includes("anti-link") || n.includes("anti link") || n.includes("link")) && rule.creatorId === this.client.user.id) {
            await rule.delete().catch(() => { });
          }
        }
      }

      if (features.antiMention) {
        if (!existingMentionRule) {
          await guild.autoModerationRules.create({
            name: mentionRuleName, creatorId: this.client.user.id, enabled: true,
            eventType: 1, triggerType: 5,
            triggerMetadata: { mentionTotalLimit: features.mentionLimit || 3 },
            actions: [{ type: 1, metadata: { customMessage: "⚠️ Excessive mentions are prohibited!" } }],
          }).catch(() => { });
        }
      } else {
        for (const rule of existingRules.values()) {
          const n = rule.name.toLowerCase();
          if ((n.includes("anti-mention") || n.includes("anti mention") || n.includes("mention")) && rule.creatorId === this.client.user.id) {
            await rule.delete().catch(() => { });
          }
        }
      }
    } catch (e) {
      console.error("AutoMod rule sync error:", e);
    }
  }

  // ── Interactive Setup ─────────────────────────────────
  async _startInteractiveSetup(ctx, guild, user, isSlash = false) {
    const data = await this._getAutoModData(guild.id);
    let selectedModules = AUTOMOD_MODULES.filter((m) => Boolean(data.enabled && data.features?.[m.id])).map((m) => m.id);

    const embed = this._buildSetupEmbed(guild, data, selectedModules);
    const components = this._buildComponents(selectedModules);

    const replyMsg = isSlash
      ? await ctx.reply({ embeds: [embed], components, fetchReply: true })
      : await ctx.channel.send({ embeds: [embed], components });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 180000,
      filter: (i) => i.user.id === user.id,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.customId === "automod_select_modules") {
          selectedModules = interaction.values || [];
          return interaction.update({
            embeds: [this._buildSetupEmbed(guild, data, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        if (interaction.customId === "automod_btn_enable_all") {
          selectedModules = AUTOMOD_MODULES.map((m) => m.id);
          return interaction.update({
            embeds: [this._buildSetupEmbed(guild, data, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        if (interaction.customId === "automod_btn_clear") {
          selectedModules = [];
          return interaction.update({
            embeds: [this._buildSetupEmbed(guild, data, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        if (interaction.customId === "automod_btn_disable") {
          data.enabled = false;
          await this.client.database.autoModData.post(guild.id, data);
          await this.client.cache.set("automod_" + guild.id, data);
          await this._syncDiscordAutoModRules(guild, { antiLink: false, antiMention: false });

          collector.stop("disabled");
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.disabled)
                .setAuthor({ name: "OnyxGuard AutoMod", iconURL: this.client.user?.displayAvatarURL({ dynamic: true }) })
                .setTitle("🛑  AutoMod Disabled")
                .setDescription(
                  "```ansi\n\u001b[1;31mAutoMod protection is now OFFLINE!\u001b[0m\n```\n" +
                  `> ⚠️ AutoMod protections have been **disabled** for **${guild.name}**.\n` +
                  "> Your server is unprotected until you re-enable AutoMod."
                )
                .setFooter({ text: "OnyxGuard AutoMod • Protection Offline", iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp(),
            ],
            components: [],
          });
        }

        if (interaction.customId === "automod_btn_continue") {
          data.enabled = true;
          if (!data.features) data.features = {};
          AUTOMOD_MODULES.forEach((m) => { data.features[m.id] = selectedModules.includes(m.id); });

          await this.client.database.autoModData.post(guild.id, data);
          await this.client.cache.set("automod_" + guild.id, data);
          await this._syncDiscordAutoModRules(guild, data.features);

          const activeList = AUTOMOD_MODULES.map((m) => {
            const on = data.features[m.id];
            return `${on ? "🟢" : "🔴"} ${m.emoji} **${m.label}:** ${on ? "`Enabled`" : "`Disabled`"}`;
          }).join("\n");

          collector.stop("enabled");
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.active)
                .setAuthor({ name: "OnyxGuard AutoMod", iconURL: this.client.user?.displayAvatarURL({ dynamic: true }) })
                .setTitle("✅  AutoMod Enabled Successfully!")
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                  {
                    name: "⚡ System Status",
                    value: "```ansi\n\u001b[1;32m● ACTIVE & ENFORCING\u001b[0m\n```",
                    inline: false,
                  },
                  {
                    name: `🛡️ Active Modules (${selectedModules.length}/${AUTOMOD_MODULES.length})`,
                    value: activeList,
                    inline: false,
                  },
                  {
                    name: "📌 Note",
                    value: "> *Server members violating these security rules will be automatically moderated.*",
                    inline: false,
                  }
                )
                .setFooter({
                  text: `AutoMod Enabled by ${interaction.user.tag}`,
                  iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp(),
            ],
            components: [],
          });
        }
      } catch (err) {
        console.error("AutoMod collector error:", err);
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        try {
          await replyMsg.edit({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.neutral)
                .setAuthor({ name: "OnyxGuard AutoMod", iconURL: this.client.user?.displayAvatarURL() })
                .setTitle("⏱️  Setup Session Expired")
                .setDescription(`> Configuration timed out after 3 minutes.\n> Run \`${guild?.config?.prefix || "$"}automod enable\` to start a new session.`)
                .setTimestamp(),
            ],
            components: [],
          }).catch(() => { });
        } catch { }
      }
    });
  }

  // ── MESSAGE COMMAND ───────────────────────────────────
  async run({ message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setDescription("🔒 You need **Administrator** permissions to manage AutoMod."),
        ],
      });
    }

    const prefix = message.guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const sub = (args[0] || "").toLowerCase();
    const guild = message.guild;

    if (sub === "enable") return this._startInteractiveSetup(message, guild, message.author, false);

    if (sub === "disable") {
      const data = await this._getAutoModData(guild.id);
      data.enabled = false;
      await this.client.database.autoModData.post(guild.id, data);
      await this.client.cache.set("automod_" + guild.id, data);
      await this._syncDiscordAutoModRules(guild, { antiLink: false, antiMention: false });
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setAuthor({ name: "OnyxGuard AutoMod", iconURL: this.client.user?.displayAvatarURL() })
            .setTitle("🛑  AutoMod Disabled")
            .setDescription(
              "```ansi\n\u001b[1;31mProtection is now OFFLINE!\u001b[0m\n```\n" +
              `> AutoMod has been **disabled** for **${guild.name}**.`
            )
            .setTimestamp(),
        ],
      });
    }

    if (sub === "status" || sub === "config") {
      const data = await this._getAutoModData(guild.id);
      return message.channel.send({ embeds: [this._buildStatusEmbed(guild, data)] });
    }

    if (sub === "setlog") {
      const channel = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      if (!channel) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.warning)
              .setDescription(`⚠️ Please mention a valid channel!\n**Usage:** \`${prefix}automod setlog <#channel>\``),
          ],
        });
      }
      const data = await this._getAutoModData(guild.id);
      data.logchannelid = channel.id;
      await this.client.database.autoModData.post(guild.id, data);
      await this.client.cache.set("automod_" + guild.id, data);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.active)
            .setDescription(`✅ AutoMod log channel set to <#${channel.id}>!`),
        ],
      });
    }

    if (sub === "whitelist") {
      const user = message.mentions.users.first() || await this.client.users.fetch(args[1]).catch(() => null);
      if (!user) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.warning)
              .setDescription(`⚠️ Please mention a valid user!\n**Usage:** \`${prefix}automod whitelist <@user>\``),
          ],
        });
      }
      const data = await this._getAutoModData(guild.id);
      if (!Array.isArray(data.whitelistusers)) data.whitelistusers = [];
      const idx = data.whitelistusers.indexOf(user.id);
      if (idx > -1) {
        data.whitelistusers.splice(idx, 1);
        await this.client.database.autoModData.post(guild.id, data);
        await this.client.cache.set("automod_" + guild.id, data);
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.info)
              .setDescription(`✅ Removed **${user.tag}** from AutoMod whitelist.`),
          ],
        });
      } else {
        data.whitelistusers.push(user.id);
        await this.client.database.autoModData.post(guild.id, data);
        await this.client.cache.set("automod_" + guild.id, data);
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.active)
              .setDescription(`✅ Added **${user.tag}** to AutoMod whitelist.`),
          ],
        });
      }
    }

    // Default → status
    const data = await this._getAutoModData(guild.id);
    return message.channel.send({ embeds: [this._buildStatusEmbed(guild, data)] });
  }

  // ── SLASH COMMAND ─────────────────────────────────────
  async exec({ interaction }) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setDescription("🔒 You need **Administrator** permissions to manage AutoMod."),
        ],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === "enable") return this._startInteractiveSetup(interaction, guild, interaction.user, true);

    if (sub === "disable") {
      const data = await this._getAutoModData(guild.id);
      data.enabled = false;
      await this.client.database.autoModData.post(guild.id, data);
      await this.client.cache.set("automod_" + guild.id, data);
      await this._syncDiscordAutoModRules(guild, { antiLink: false, antiMention: false });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setAuthor({ name: "OnyxGuard AutoMod", iconURL: this.client.user?.displayAvatarURL() })
            .setTitle("🛑  AutoMod Disabled")
            .setDescription(
              "```ansi\n\u001b[1;31mProtection is now OFFLINE!\u001b[0m\n```\n" +
              `> AutoMod has been **disabled** for **${guild.name}**.`
            )
            .setTimestamp(),
        ],
      });
    }

    if (sub === "status") {
      const data = await this._getAutoModData(guild.id);
      return interaction.reply({ embeds: [this._buildStatusEmbed(guild, data)] });
    }

    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel");
      const data = await this._getAutoModData(guild.id);
      data.logchannelid = channel.id;
      await this.client.database.autoModData.post(guild.id, data);
      await this.client.cache.set("automod_" + guild.id, data);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.active)
            .setDescription(`✅ AutoMod log channel set to <#${channel.id}>!`),
        ],
      });
    }

    if (sub === "whitelist") {
      const user = interaction.options.getUser("user");
      const data = await this._getAutoModData(guild.id);
      if (!Array.isArray(data.whitelistusers)) data.whitelistusers = [];
      const idx = data.whitelistusers.indexOf(user.id);
      if (idx > -1) {
        data.whitelistusers.splice(idx, 1);
        await this.client.database.autoModData.post(guild.id, data);
        await this.client.cache.set("automod_" + guild.id, data);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.info)
              .setDescription(`✅ Removed **${user.tag}** from AutoMod whitelist.`),
          ],
        });
      } else {
        data.whitelistusers.push(user.id);
        await this.client.database.autoModData.post(guild.id, data);
        await this.client.cache.set("automod_" + guild.id, data);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.active)
              .setDescription(`✅ Added **${user.tag}** to AutoMod whitelist.`),
          ],
        });
      }
    }
  }
};
