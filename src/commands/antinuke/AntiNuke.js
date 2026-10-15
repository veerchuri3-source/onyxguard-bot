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
} = require("discord.js");

// ─────────────────────────────────────────────────────────
//  CONSTANTS & THEME
// ─────────────────────────────────────────────────────────
const COLORS = {
  active: 0x00E676,   // Neon Green
  disabled: 0xFF1744, // Vivid Cyber Red
  accent: 0x7C4DFF,   // Deep Purple
  info: 0x448AFF,     // Cyan Blue
  warning: 0xFFAB00,  // Amber Warning
};

const ALL_MODULES = [
  { id: "antiBan", label: "Anti Ban", description: "Bans unauthorized users who ban members", emoji: "🛡️" },
  { id: "antiUnban", label: "Anti Unban", description: "Bans unauthorized users who unban members & re-bans victim", emoji: "⚖️" },
  { id: "antiKick", label: "Anti Kick", description: "Bans unauthorized users who kick members", emoji: "👢" },
  { id: "antiBot", label: "Anti Bot Add", description: "Kicks unauthorized bots & bans the inviter", emoji: "🤖" },
  { id: "antiChannelDelete", label: "Anti Ch. Delete", description: "Restores deleted channels & bans culprit", emoji: "🗑️" },
  { id: "antiChannelCreate", label: "Anti Ch. Create", description: "Deletes unauthorized channels & bans creator", emoji: "➕" },
  { id: "antiChannelUpdate", label: "Anti Ch. Update", description: "Reverts channel edits & bans editor", emoji: "✏️" },
  { id: "antiRoleDelete", label: "Anti Role Delete", description: "Restores deleted roles & bans culprit", emoji: "❌" },
  { id: "antiRoleCreate", label: "Anti Role Create", description: "Deletes unauthorized roles & bans creator", emoji: "👑" },
  { id: "antiRoleUpdate", label: "Anti Role Update", description: "Reverts role edits & bans editor", emoji: "📝" },
  { id: "antiMemberUpdate", label: "Anti Member Update", description: "Reverts unauthorized member/role changes & bans editor", emoji: "👤" },
  { id: "antiWebhook", label: "Anti Webhook", description: "Deletes unauthorized webhooks & bans creator", emoji: "🌐" },
  { id: "antiGuildUpdate", label: "Anti Server Update", description: "Reverts server changes & bans editor", emoji: "🏢" },
  { id: "antiMemberPrune", label: "Anti Member Prune", description: "Bans unauthorized users who prune members", emoji: "🧹" },
  { id: "antiPing", label: "Anti Mass Mention", description: "Deletes @everyone/@here & bans author", emoji: "📯" },
];

module.exports = class AntiNuke extends Command {
  constructor(...args) {
    super(...args, {
      name: "antinuke",
      aliases: ["antiwizz", "an", "security"],
      description: "Complete Server Protection & Antinuke Security System",
      usage: ["antinuke [enable|disable|status|setlog|config]"],
      category: "Antinuke",
      userPerms: ["Administrator"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages", "Administrator", "BanMembers"],
      guildOwnerOnly: true,
      cooldown: 3,
      options: [
        { type: 1, name: "enable", description: "Enable Antinuke and select protection modules" },
        { type: 1, name: "disable", description: "Disable Antinuke protection" },
        { type: 1, name: "status", description: "View current Antinuke status and modules" },
        { type: 1, name: "config", description: "Open the interactive Antinuke dashboard" },
        {
          type: 1, name: "setlog", description: "Set the Antinuke alert log channel",
          options: [{ type: 7, name: "channel", description: "Channel for security alerts", required: true }],
        },
      ],
    });
  }

  // ── Data ──────────────────────────────────────────────
  async _getAntiNukeData(guildId) {
    let data = await this.client.database.antiNukeData.get(guildId);
    if (!data || typeof data !== "object") data = {};
    if (typeof data.enabled !== "boolean") data.enabled = false;
    if (!Array.isArray(data.whitelistusers)) data.whitelistusers = [];
    data.punishment = "ban";
    if (!data.features || typeof data.features !== "object") {
      // Fresh setup: do NOT auto-select all modules!
      data.features = Object.fromEntries(ALL_MODULES.map((m) => [m.id, false]));
    }
    return data;
  }

  // ── Compact Dashboard Embed (AutoMod Style) ───────────
  _buildDashboardEmbed(guild, data, selectedModules = []) {
    const prefix = guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const isEnabled = Boolean(data.enabled);
    const activeMods = ALL_MODULES.filter((m) => selectedModules.includes(m.id));
    const inactiveMods = ALL_MODULES.filter((m) => !selectedModules.includes(m.id));

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Prefix:** \`${prefix}\`\n` +
        `• **Antinuke Status:** ${isEnabled ? "`Armed & Enforcing 🟢`" : "`Offline 🔴`"}\n` +
        `• **Selected Modules:** \`${selectedModules.length}/${ALL_MODULES.length}\`\n` +
        `• **Enforcement:** \`Instant Permanent Ban\`\n` +
        `• **Whitelisted Users:** \`${data.whitelistusers?.length || 0}\` | **Logs:** ${data.logchannelid ? `<#${data.logchannelid}>` : "`Not configured`"}\n\n` +
        `• **Selected Protections (${selectedModules.length}):**\n` +
        `> ${activeMods.length > 0 ? activeMods.map((m) => `${m.emoji} \`${m.label}\``).join(" • ") : "*None selected*"}\n\n` +
        `• **Unselected Protections (${inactiveMods.length}):**\n` +
        `> ${inactiveMods.length > 0 ? inactiveMods.map((m) => `${m.emoji} \`${m.label}\``).join(" • ") : "*All selected*"}\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/YtSejhTGzw)`
      )
      .setFooter({
        text: `Powered By OnyxGuard Development™ | Designed By .veer`,
        iconURL: this.client.user?.displayAvatarURL(),
      });

    return embed;
  }

  // ── Compact Disable Embed ─────────────────────────────
  _buildDisableEmbed() {
    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Protection Status:** \`Disabled 🔴\`\n` +
        `• **Notice:** Server protections have been **deactivated**.\n` +
        `• **Action:** Click **⚡ Select All** & **✅ Continue & Enable** below to re-arm.\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ── Compact Whitelist Embed ───────────────────────────
  _buildWhitelistEmbed(guild, data) {
    const prefix = guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const wlList = data.whitelistusers?.length > 0
      ? data.whitelistusers.map((e, i) => {
        const id = typeof e === "object" ? e.id : e;
        const perms = (e && typeof e === "object" && Array.isArray(e.permissions)) ? e.permissions : [];
        const permStr = perms.length > 0
          ? perms.map((pid) => {
            const m = ALL_MODULES.find((mod) => mod.id === pid);
            return m ? `${m.emoji} \`${m.label}\`` : `\`${pid}\``;
          }).join(" • ")
          : "*No permissions granted*";
        return `> \`${String(i + 1).padStart(2, "0")}.\` <@${id}> (\`${id}\`)\n> └ **Allowed (${perms.length}/20):** ${permStr}`;
      }).join("\n\n")
      : "> *No users are currently whitelisted.*";

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Whitelist Manager:** ${guild.name}\n` +
        `• **Whitelisted Users (${data.whitelistusers?.length || 0}/10):**\n` +
        `${wlList}\n\n` +
        `• **Quick Guide:**\n` +
        `> Use \`${prefix}whitelist add @user\` or \`${prefix}whitelist remove @user\` to manage.\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ── Components (AutoMod Style) ────────────────────────
  _buildComponents(selectedModules = [], disabled = false) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("antinuke_select_modules")
      .setPlaceholder(selectedModules.length > 0 ? `❯ Active Modules (${selectedModules.length}/${ALL_MODULES.length})` : "❯ Select Antinuke Modules to Activate")
      .setMinValues(0)
      .setMaxValues(ALL_MODULES.length)
      .setDisabled(disabled)
      .addOptions(
        ALL_MODULES.map((m) => ({
          label: m.label,
          value: m.id,
          description: m.description.slice(0, 50),
          emoji: m.emoji,
          default: selectedModules.includes(m.id),
        }))
      );

    const menuRow = new ActionRowBuilder().addComponents(selectMenu);

    const continueBtn = new ButtonBuilder()
      .setCustomId("antinuke_btn_continue")
      .setLabel("Continue & Enable")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled);

    const selectAllBtn = new ButtonBuilder()
      .setCustomId("antinuke_btn_select_all")
      .setLabel("Select All")
      .setEmoji("⚡")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled);

    const clearBtn = new ButtonBuilder()
      .setCustomId("antinuke_btn_clear")
      .setLabel("Clear All")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const disableBtn = new ButtonBuilder()
      .setCustomId("antinuke_btn_disable")
      .setLabel("Disable Antinuke")
      .setEmoji("🛑")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled);

    const whitelistBtn = new ButtonBuilder()
      .setCustomId("antinuke_btn_whitelist")
      .setLabel("Whitelist")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const buttonRow = new ActionRowBuilder().addComponents(continueBtn, selectAllBtn, clearBtn, disableBtn, whitelistBtn);

    return [menuRow, buttonRow];
  }

  // ── Collector ─────────────────────────────────────────
  _attachCollector(replyMessage, guild, antiNukeData, initialSelected = []) {
    let selectedModules = [...initialSelected];

    const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 300000,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.user.id !== guild.ownerId) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.disabled)
                .setDescription(`🔒 Only the **Server Owner** (<@${guild.ownerId}>) can modify Antinuke settings!`),
            ],
            ephemeral: true,
          });
        }

        // Dropdown Multi-Select Selection
        if (interaction.customId === "antinuke_select_modules") {
          selectedModules = interaction.values || [];
          return interaction.update({
            embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        // Select All Button
        if (interaction.customId === "antinuke_btn_select_all") {
          selectedModules = ALL_MODULES.map((m) => m.id);
          return interaction.update({
            embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        // Clear All Button
        if (interaction.customId === "antinuke_btn_clear") {
          selectedModules = [];
          return interaction.update({
            embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        // Continue & Enable Button
        if (interaction.customId === "antinuke_btn_continue") {
          antiNukeData.enabled = selectedModules.length > 0;
          if (!antiNukeData.features) antiNukeData.features = {};
          ALL_MODULES.forEach((m) => {
            antiNukeData.features[m.id] = selectedModules.includes(m.id);
          });

          await this.client.database.antiNukeData.post(guild.id, antiNukeData);
          await this.client.cache.set(guild.id, antiNukeData);

          return interaction.update({
            embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        // Disable Antinuke Button
        if (interaction.customId === "antinuke_btn_disable") {
          antiNukeData.enabled = false;
          if (!antiNukeData.features) antiNukeData.features = {};
          ALL_MODULES.forEach((m) => {
            antiNukeData.features[m.id] = false;
          });
          selectedModules = [];

          await this.client.database.antiNukeData.post(guild.id, antiNukeData);
          await this.client.cache.set(guild.id, antiNukeData);

          return interaction.update({
            embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
            components: this._buildComponents(selectedModules),
          });
        }

        // Whitelist Button
        if (interaction.customId === "antinuke_btn_whitelist") {
          return interaction.reply({
            embeds: [this._buildWhitelistEmbed(guild, antiNukeData)],
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error("Antinuke component interaction error:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await replyMessage.edit({ components: this._buildComponents(selectedModules, true) }).catch(() => { });
      } catch (_) { }
    });
  }

  // ── MESSAGE COMMAND ───────────────────────────────────
  async run({ message, args }) {
    const guild = message.guild;
    const isOwner = message.author.id === guild.ownerId;

    if (!isOwner) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setAuthor({ name: "OnyxGuard Antinuke", iconURL: this.client.user?.displayAvatarURL() })
            .setDescription(`🔒 **Access Denied** — Only the **Server Owner** (<@${guild.ownerId}>) can configure Antinuke!`),
        ],
      });
    }

    let antiNukeData = await this._getAntiNukeData(guild.id);
    let selectedModules = ALL_MODULES.filter((m) => antiNukeData.enabled && Boolean(antiNukeData.features?.[m.id])).map((m) => m.id);
    const sub = args[0]?.toLowerCase();

    // ENABLE
    if (sub === "enable") {
      const replyMsg = await message.channel.send({
        embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
        components: this._buildComponents(selectedModules),
      });
      return this._attachCollector(replyMsg, guild, antiNukeData, selectedModules);
    }

    // DISABLE
    if (sub === "disable") {
      antiNukeData.enabled = false;
      if (!antiNukeData.features) antiNukeData.features = {};
      ALL_MODULES.forEach((m) => {
        antiNukeData.features[m.id] = false;
      });
      selectedModules = [];
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);

      const replyMsg = await message.channel.send({
        embeds: [this._buildDashboardEmbed(guild, antiNukeData, [])],
        components: this._buildComponents([]),
      });
      return this._attachCollector(replyMsg, guild, antiNukeData, []);
    }

    const prefix = message.guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";

    // SET LOG CHANNEL
    if (sub === "setlog" || sub === "logchannel") {
      const channel = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      if (!channel) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.warning)
              .setDescription(`⚠️ Please mention a valid channel!\n**Usage:** \`${prefix}antinuke setlog <#channel>\``),
          ],
        });
      }
      antiNukeData.logchannelid = channel.id;
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.active)
            .setDescription(`✅ **Security log channel set!** Security alerts will now be dispatched to <#${channel.id}>.`),
        ],
      });
    }

    // STATUS or CONFIG or DEFAULT -> Full Dashboard
    const replyMsg = await message.channel.send({
      embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
      components: this._buildComponents(selectedModules),
    });
    this._attachCollector(replyMsg, guild, antiNukeData, selectedModules);
  }

  // ── SLASH COMMAND ─────────────────────────────────────
  async exec({ interaction }) {
    const guild = interaction.guild;
    const isOwner = interaction.user.id === guild.ownerId;

    if (!isOwner) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.disabled)
            .setDescription(`🔒 Only the **Server Owner** (<@${guild.ownerId}>) can configure Antinuke!`),
        ],
        ephemeral: true,
      });
    }

    let antiNukeData = await this._getAntiNukeData(guild.id);
    let selectedModules = ALL_MODULES.filter((m) => antiNukeData.enabled && Boolean(antiNukeData.features?.[m.id])).map((m) => m.id);
    const sub = interaction.options.getSubcommand(false);

    if (sub === "enable") {
      const replyMsg = await interaction.reply({
        embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
        components: this._buildComponents(selectedModules),
        fetchReply: true,
      });
      return this._attachCollector(replyMsg, guild, antiNukeData, selectedModules);
    }

    if (sub === "disable") {
      antiNukeData.enabled = false;
      if (!antiNukeData.features) antiNukeData.features = {};
      ALL_MODULES.forEach((m) => {
        antiNukeData.features[m.id] = false;
      });
      selectedModules = [];
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);

      const replyMsg = await interaction.reply({
        embeds: [this._buildDashboardEmbed(guild, antiNukeData, [])],
        components: this._buildComponents([]),
        fetchReply: true,
      });
      return this._attachCollector(replyMsg, guild, antiNukeData, []);
    }

    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel");
      antiNukeData.logchannelid = channel.id;
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.active)
            .setDescription(`✅ Antinuke alert logs configured to <#${channel.id}> successfully!`),
        ],
        ephemeral: true,
      });
    }

    // Default → Full Dashboard
    const replyMsg = await interaction.reply({
      embeds: [this._buildDashboardEmbed(guild, antiNukeData, selectedModules)],
      components: this._buildComponents(selectedModules),
      fetchReply: true,
    });
    this._attachCollector(replyMsg, guild, antiNukeData, selectedModules);
  }
};
