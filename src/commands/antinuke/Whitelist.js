const Command = require("../../abstract/command");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} = require("discord.js");

const WHITELIST_PERMISSIONS = [
  // Antinuke Protections
  { id: "antiBan", label: "Anti Ban", category: "Antinuke", emoji: "🛡️", description: "Allow banning members without penalty" },
  { id: "antiUnban", label: "Anti Unban", category: "Antinuke", emoji: "⚖️", description: "Allow unbanning members without penalty" },
  { id: "antiKick", label: "Anti Kick", category: "Antinuke", emoji: "👢", description: "Allow kicking members without penalty" },
  { id: "antiBot", label: "Anti Bot Add", category: "Antinuke", emoji: "🤖", description: "Allow inviting bots without penalty" },
  { id: "antiChannelDelete", label: "Anti Channel Delete", category: "Antinuke", emoji: "🗑️", description: "Allow channel delete & no restore" },
  { id: "antiChannelCreate", label: "Anti Channel Create", category: "Antinuke", emoji: "➕", description: "Allow channel creation & no delete" },
  { id: "antiChannelUpdate", label: "Anti Channel Update", category: "Antinuke", emoji: "✏️", description: "Allow editing channels & no revert" },
  { id: "antiRoleDelete", label: "Anti Role Delete", category: "Antinuke", emoji: "❌", description: "Allow role delete & no restore" },
  { id: "antiRoleCreate", label: "Anti Role Create", category: "Antinuke", emoji: "👑", description: "Allow role creation & no delete" },
  { id: "antiRoleUpdate", label: "Anti Role Update", category: "Antinuke", emoji: "📝", description: "Allow editing roles & no revert" },
  { id: "antiMemberUpdate", label: "Anti Member Update", category: "Antinuke", emoji: "👤", description: "Allow member role edits & no penalty" },
  { id: "antiWebhook", label: "Anti Webhook", category: "Antinuke", emoji: "🌐", description: "Allow creating/editing webhooks" },
  { id: "antiGuildUpdate", label: "Anti Server Update", category: "Antinuke", emoji: "🏢", description: "Allow server edits & no revert" },
  { id: "antiMemberPrune", label: "Anti Member Prune", category: "Antinuke", emoji: "🧹", description: "Allow pruning members without penalty" },
  { id: "antiPing", label: "Anti Mass Mention", category: "Antinuke", emoji: "📯", description: "Allow @everyone and mass pings" },

  // AutoMod Protections
  { id: "antiSpam", label: "Anti Spam", category: "AutoMod", emoji: "⚡", description: "Bypass message flooding & rate limit" },
  { id: "antiCaps", label: "Anti Caps", category: "AutoMod", emoji: "🔠", description: "Bypass excessive capital letters filter" },
  { id: "antiLink", label: "Anti Link", category: "AutoMod", emoji: "🔗", description: "Bypass server invite & link filter" },
  { id: "antiMention", label: "Anti Mention", category: "AutoMod", emoji: "📢", description: "Bypass mass user/role mention filter" },
  { id: "antiWord", label: "Anti Bad Words", category: "AutoMod", emoji: "🚫", description: "Bypass vulgar / blacklist words filter" },
];

module.exports = class Whitelist extends Command {
  constructor(...args) {
    super(...args, {
      name: "whitelist",
      aliases: ["wl"],
      description: "Manage Antinuke & AutoMod granular whitelist permissions",
      usage: ["whitelist <add|remove|show|reset> [@user]"],
      category: "Antinuke",
      userPerms: ["Administrator"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
      guildOwnerOnly: true,
      cooldown: 3,
      options: [
        {
          type: 1,
          name: "add",
          description: "Configure whitelist permissions for a user",
          options: [
            { type: 6, name: "user", description: "User to whitelist", required: true },
          ],
        },
        {
          type: 1,
          name: "remove",
          description: "Remove a user from whitelist",
          options: [
            { type: 6, name: "user", description: "User to remove", required: true },
          ],
        },
        {
          type: 1,
          name: "show",
          description: "View all whitelisted users and their permissions",
        },
        {
          type: 1,
          name: "reset",
          description: "Clear all whitelisted users",
        },
      ],
    });
  }

  // ── Helper: Format Links ──────────────────────────────
  _getLinks() {
    return `[Invite Me](https://discord.com/oauth2/authorize?client_id=${this.client.user?.id}&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`;
  }

  // ── Helper: Embed Builder for Config ──────────────────
  _buildConfigEmbed(targetUser, selected = []) {
    const activeList = selected.length > 0
      ? selected
          .map((id) => {
            const m = WHITELIST_PERMISSIONS.find((p) => p.id === id);
            return m ? `\`${m.emoji} ${m.label}\`` : `\`${id}\``;
          })
          .join(" • ")
      : "*None selected — Bot will enforce full actions & restorations on all violations*";

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
        `• **Whitelist Configuration:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n` +
        `• **Selected Permissions:** \`${selected.length}/${WHITELIST_PERMISSIONS.length}\`\n\n` +
        `• **Allowed Protections (${selected.length}):**\n` +
        `> ${activeList}\n\n` +
        `• **Security Rule:**\n` +
        `> Actions selected above will **NOT** be punished or restored (e.g. deleted channels will not be cloned).\n` +
        `> Any unselected actions will result in **Instant Ban & Full Revert/Restore**.\n\n` +
        `**🔗 Links**\n` +
        `${this._getLinks()}`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ── Helper: Build Components ──────────────────────────
  _buildComponents(selected = [], disabled = false) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("wl_perm_select")
      .setPlaceholder(selected.length > 0 ? `❯ Granted Permissions (${selected.length}/${WHITELIST_PERMISSIONS.length})` : "❯ Select AutoMod & AntiNuke Permissions to Allow")
      .setMinValues(0)
      .setMaxValues(WHITELIST_PERMISSIONS.length)
      .setDisabled(disabled)
      .addOptions(
        WHITELIST_PERMISSIONS.map((p) => ({
          label: p.label,
          value: p.id,
          description: `[${p.category}] ${p.description}`.slice(0, 100),
          emoji: p.emoji,
          default: selected.includes(p.id),
        }))
      );

    const menuRow = new ActionRowBuilder().addComponents(selectMenu);

    const saveBtn = new ButtonBuilder()
      .setCustomId("wl_btn_save")
      .setLabel("Save & Whitelist")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled);

    const selectAllBtn = new ButtonBuilder()
      .setCustomId("wl_btn_all")
      .setLabel("Select All")
      .setEmoji("⚡")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled);

    const clearBtn = new ButtonBuilder()
      .setCustomId("wl_btn_clear")
      .setLabel("Clear All")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const cancelBtn = new ButtonBuilder()
      .setCustomId("wl_btn_cancel")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled);

    const antinukeBtn = new ButtonBuilder()
      .setCustomId("wl_btn_antinuke")
      .setLabel("AntiNuke Only")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const automodBtn = new ButtonBuilder()
      .setCustomId("wl_btn_automod")
      .setLabel("AutoMod Only")
      .setEmoji("🤖")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const row1 = new ActionRowBuilder().addComponents(saveBtn, selectAllBtn, clearBtn, cancelBtn);
    const row2 = new ActionRowBuilder().addComponents(antinukeBtn, automodBtn);

    return [menuRow, row1, row2];
  }

  // ── Helper: Interactive Whitelist Collector ───────────
  async _startInteractiveConfig(ctx, guild, targetUser, isSlash = false) {
    let antiNukeData = await this.client.database.antiNukeData.get(guild.id);
    if (!antiNukeData || typeof antiNukeData !== "object") antiNukeData = {};
    if (!Array.isArray(antiNukeData.whitelistusers)) antiNukeData.whitelistusers = [];

    // Find existing entry if user is already whitelisted
    const existingEntry = antiNukeData.whitelistusers.find((e) =>
      (typeof e === "string" && e === targetUser.id) ||
      (e && typeof e === "object" && e.id === targetUser.id)
    );

    let selected = [];
    if (existingEntry) {
      if (typeof existingEntry === "string") {
        selected = [];
      } else if (Array.isArray(existingEntry.permissions)) {
        selected = [...existingEntry.permissions];
      }
    } else {
      // Check whitelist capacity (max 10)
      if (antiNukeData.whitelistusers.length >= 10) {
        const fullMsg = "❌ You have reached the maximum limit of **10 whitelisted users**.";
        return isSlash ? ctx.reply({ content: fullMsg, ephemeral: true }) : ctx.reply(fullMsg);
      }
      // Start with empty array so owner selects what to grant!
      selected = [];
    }

    const embed = this._buildConfigEmbed(targetUser, selected);
    const components = this._buildComponents(selected);

    const replyMsg = isSlash
      ? await ctx.reply({ embeds: [embed], components, fetchReply: true, ephemeral: false })
      : await ctx.channel.send({ embeds: [embed], components });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 180000,
      filter: (i) => i.user.id === guild.ownerId,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.customId === "wl_perm_select") {
          selected = interaction.values || [];
          return interaction.update({
            embeds: [this._buildConfigEmbed(targetUser, selected)],
            components: this._buildComponents(selected),
          });
        }

        if (interaction.customId === "wl_btn_all") {
          selected = WHITELIST_PERMISSIONS.map((p) => p.id);
          return interaction.update({
            embeds: [this._buildConfigEmbed(targetUser, selected)],
            components: this._buildComponents(selected),
          });
        }

        if (interaction.customId === "wl_btn_clear") {
          selected = [];
          return interaction.update({
            embeds: [this._buildConfigEmbed(targetUser, selected)],
            components: this._buildComponents(selected),
          });
        }

        if (interaction.customId === "wl_btn_antinuke") {
          selected = WHITELIST_PERMISSIONS.filter((p) => p.category === "Antinuke").map((p) => p.id);
          return interaction.update({
            embeds: [this._buildConfigEmbed(targetUser, selected)],
            components: this._buildComponents(selected),
          });
        }

        if (interaction.customId === "wl_btn_automod") {
          selected = WHITELIST_PERMISSIONS.filter((p) => p.category === "AutoMod").map((p) => p.id);
          return interaction.update({
            embeds: [this._buildConfigEmbed(targetUser, selected)],
            components: this._buildComponents(selected),
          });
        }

        if (interaction.customId === "wl_btn_cancel") {
          collector.stop("cancelled");
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF1744)
                .setTitle("Hey , I'm OnyxGuard™")
                .setDescription(`❌ Whitelist configuration for <@${targetUser.id}> was **cancelled**.`)
                .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() }),
            ],
            components: [],
          });
        }

        if (interaction.customId === "wl_btn_save") {
          const entry = { id: targetUser.id, permissions: selected };
          const idx = antiNukeData.whitelistusers.findIndex((e) =>
            (typeof e === "string" && e === targetUser.id) ||
            (e && typeof e === "object" && e.id === targetUser.id)
          );

          if (idx > -1) {
            antiNukeData.whitelistusers[idx] = entry;
          } else {
            antiNukeData.whitelistusers.push(entry);
          }

          await this.client.database.antiNukeData.post(guild.id, antiNukeData);
          await this.client.cache.set(guild.id, antiNukeData);

          collector.stop("saved");
          const successEmbed = new EmbedBuilder()
            .setColor(0x00E676)
            .setTitle("Hey , I'm OnyxGuard™")
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
              `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
              `• **Whitelist Updated:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n` +
              `• **Status:** \`Successfully Saved 🟢\`\n` +
              `• **Granted Permissions (${selected.length}/${WHITELIST_PERMISSIONS.length}):**\n` +
              `> ${selected.length > 0 ? selected.map((id) => {
                const m = WHITELIST_PERMISSIONS.find((p) => p.id === id);
                return m ? `\`${m.emoji} ${m.label}\`` : `\`${id}\``;
              }).join(" • ") : "*None (All actions blocked)*"}\n\n` +
              `• **Whitelisted Users:** \`${antiNukeData.whitelistusers.length}/10\`\n\n` +
              `**🔗 Links**\n` +
              `${this._getLinks()}`
            )
            .setFooter({
              text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
              iconURL: this.client.user?.displayAvatarURL(),
            });

          return interaction.update({
            embeds: [successEmbed],
            components: [],
          });
        }
      } catch (err) {
        console.error("Whitelist component interaction error:", err);
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        try {
          await replyMsg.edit({
            components: this._buildComponents(selected, true),
          }).catch(() => {});
        } catch {}
      }
    });
  }

  // ── Show Whitelisted Users ─────────────────────────────
  _buildShowEmbed(guild, antiNukeData) {
    const entries = antiNukeData.whitelistusers || [];
    const prefix = guild.config?.prefix || this.client.config?.Client?.Prefix || "$";

    if (!entries.length) {
      return new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle("Hey , I'm OnyxGuard™")
        .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
          `• **Whitelist Manager:** ${guild.name}\n` +
          `• **Whitelisted Users (0/10):**\n` +
          `> *No users are currently whitelisted.*\n\n` +
          `• **Quick Guide:**\n` +
          `> Use \`${prefix}whitelist add @user\` to whitelist and configure permissions.\n\n` +
          `**🔗 Links**\n` +
          `${this._getLinks()}`
        )
        .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() });
    }

    const listStr = entries
      .map((e, i) => {
        const userId = typeof e === "string" ? e : e?.id;
        const perms = (e && typeof e === "object" && Array.isArray(e.permissions))
          ? e.permissions
          : [];

        const permLabels = perms.length > 0
          ? perms
              .map((pid) => {
                const m = WHITELIST_PERMISSIONS.find((p) => p.id === pid);
                return m ? `\`${m.emoji} ${m.label}\`` : `\`${pid}\``;
              })
              .join(" • ")
          : "*No permissions granted (Full restrictions apply)*";

        return `> \`${String(i + 1).padStart(2, "0")}.\` <@${userId}> (\`${userId}\`)\n> └ **Allowed Permissions (${perms.length}/${WHITELIST_PERMISSIONS.length}):**\n> ${permLabels}`;
      })
      .join("\n\n");

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
        `• **Whitelist Manager:** ${guild.name}\n` +
        `• **Whitelisted Users (${entries.length}/10):**\n` +
        `${listStr}\n\n` +
        `• **Quick Guide:**\n` +
        `> Use \`${prefix}whitelist add @user\` to modify permissions.\n` +
        `> Use \`${prefix}whitelist remove @user\` to revoke access.\n\n` +
        `**🔗 Links**\n` +
        `${this._getLinks()}`
      )
      .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() });
  }

  // ── MESSAGE COMMAND ───────────────────────────────────
  async run({ message, args, prefix }) {
    const guild = message.guild;
    const resolvedPrefix = prefix || guild.config?.prefix || this.client.config?.Client?.Prefix || "$";

    if (message.author.id !== guild.ownerId) {
      return message.reply({ content: "🔒 Only the **Server Owner** can manage Whitelist permissions." });
    }

    const sub = (args[0] || "").toLowerCase();
    let antiNukeData = await this.client.database.antiNukeData.get(guild.id);
    if (!antiNukeData || typeof antiNukeData !== "object") antiNukeData = {};
    if (!Array.isArray(antiNukeData.whitelistusers)) antiNukeData.whitelistusers = [];

    // SHOW / LIST or default without args
    if (!sub || sub === "show" || sub === "list") {
      return message.channel.send({ embeds: [this._buildShowEmbed(guild, antiNukeData)] });
    }

    // RESET
    if (sub === "reset" || sub === "clear") {
      antiNukeData.whitelistusers = [];
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);

      const embed = new EmbedBuilder()
        .setColor(0x00E676)
        .setTitle("Hey , I'm OnyxGuard™")
        .setDescription("✅ **All whitelisted users have been cleared successfully.**")
        .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() });
      return message.channel.send({ embeds: [embed] });
    }

    // Target user extraction
    const targetUserId = await this.client.util.userQuery(args[1]);
    const targetUser = targetUserId
      ? await this.client.users.fetch(targetUserId).catch(() => null)
      : message.mentions.users.first();

    if (!targetUser) {
      return message.reply({
        content: `⚠️ Please specify a valid user!\n**Usage:** \`${resolvedPrefix}whitelist <add|remove|show> @user\``,
      });
    }

    // ADD / CONFIG
    if (sub === "add" || sub === "config" || sub === "set") {
      return this._startInteractiveConfig(message, guild, targetUser, false);
    }

    // REMOVE
    if (sub === "remove" || sub === "del" || sub === "delete") {
      const exists = antiNukeData.whitelistusers.some((e) =>
        (typeof e === "string" && e === targetUser.id) ||
        (e && typeof e === "object" && e.id === targetUser.id)
      );

      if (!exists) {
        return message.reply({ content: "⚠️ That user is not currently whitelisted." });
      }

      antiNukeData.whitelistusers = antiNukeData.whitelistusers.filter((e) => {
        const uid = typeof e === "string" ? e : e?.id;
        return uid !== targetUser.id;
      });

      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);

      const embed = new EmbedBuilder()
        .setColor(0xFF1744)
        .setTitle("Hey , I'm OnyxGuard™")
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
          `• **Action:** Whitelist Revoked\n` +
          `• **User:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n` +
          `• **Status:** \`Successfully Removed 🔴\`\n` +
          `• **Total Whitelisted:** \`${antiNukeData.whitelistusers.length}/10\``
        )
        .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() });

      return message.channel.send({ embeds: [embed] });
    }

    return message.channel.send({ embeds: [this._buildShowEmbed(guild, antiNukeData)] });
  }

  // ── SLASH COMMAND ─────────────────────────────────────
  async exec({ interaction }) {
    const guild = interaction.guild;
    if (interaction.user.id !== guild.ownerId) {
      return interaction.reply({
        content: "🔒 Only the **Server Owner** can manage Whitelist permissions.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    let antiNukeData = await this.client.database.antiNukeData.get(guild.id);
    if (!antiNukeData || typeof antiNukeData !== "object") antiNukeData = {};
    if (!Array.isArray(antiNukeData.whitelistusers)) antiNukeData.whitelistusers = [];

    if (sub === "show") {
      return interaction.reply({ embeds: [this._buildShowEmbed(guild, antiNukeData)] });
    }

    if (sub === "reset") {
      antiNukeData.whitelistusers = [];
      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);
      return interaction.reply({ content: "✅ **All whitelisted users have been cleared.**" });
    }

    const targetUser = interaction.options.getUser("user");
    if (!targetUser) {
      return interaction.reply({ content: "⚠️ Please specify a valid user.", ephemeral: true });
    }

    if (sub === "add") {
      return this._startInteractiveConfig(interaction, guild, targetUser, true);
    }

    if (sub === "remove") {
      const exists = antiNukeData.whitelistusers.some((e) =>
        (typeof e === "string" && e === targetUser.id) ||
        (e && typeof e === "object" && e.id === targetUser.id)
      );

      if (!exists) {
        return interaction.reply({ content: "⚠️ That user is not currently whitelisted.", ephemeral: true });
      }

      antiNukeData.whitelistusers = antiNukeData.whitelistusers.filter((e) => {
        const uid = typeof e === "string" ? e : e?.id;
        return uid !== targetUser.id;
      });

      await this.client.database.antiNukeData.post(guild.id, antiNukeData);
      await this.client.cache.set(guild.id, antiNukeData);

      const embed = new EmbedBuilder()
        .setColor(0xFF1744)
        .setTitle("Hey , I'm OnyxGuard™")
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
          `• **Action:** Whitelist Revoked\n` +
          `• **User:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n` +
          `• **Status:** \`Successfully Removed 🔴\`\n` +
          `• **Total Whitelisted:** \`${antiNukeData.whitelistusers.length}/10\``
        )
        .setFooter({ text: "Powered By OnyxGuard Development™ | Designed By .1xylen", iconURL: this.client.user?.displayAvatarURL() });

      return interaction.reply({ embeds: [embed] });
    }
  }
};
