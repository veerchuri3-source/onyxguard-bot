/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Command = require("../../abstract/command");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  MessageFlags,
} = require("discord.js");

const VERIFIED_NAME = "Verified";
const UNVERIFIED_NAME = "Unverified";
const DEFAULT_CHANNEL_NAME = "verification";

module.exports = class Verification extends Command {
  constructor(...args) {
    super(...args, {
      name: "verification",
      aliases: ["verify", "verify-setup", "verifysetup", "vsetup"],
      description: "Set up and manage server verification with Unverified role protection",
      category: "Verification",
      usage: [
        "verify setup [channel] [verifiedRole] [unverifiedRole]",
        "verify fixperms",
        "verify ignore <#channel>",
        "verify unignore <#channel>",
        "verify disable",
        "verify status",
        "verify send",
      ],
      userPerms: ["Administrator"],
      botPerms: ["ViewChannel", "SendMessages", "ManageRoles", "ManageChannels", "EmbedLinks"],
      guildOnly: true,
      cooldown: 5,
      options: [
        {
          name: "setup",
          description: "Configure verification with verified and unverified roles.",
          type: 1,
          options: [
            {
              name: "channel",
              description: "The channel for verification (created automatically if omitted).",
              type: 7,
              required: false,
            },
            {
              name: "role",
              description: "The role given upon verification (cosmetic display role).",
              type: 8,
              required: false,
            },
            {
              name: "unverified_role",
              description: "The role given to new unverified members (created automatically if omitted).",
              type: 8,
              required: false,
            },
          ],
        },
        {
          name: "fixperms",
          description: "Audit channels to ensure proper unverified role permissions.",
          type: 1,
        },
        {
          name: "ignore",
          description: "Exclude a channel or category from verification.",
          type: 1,
          options: [
            {
              name: "channel",
              description: "Channel or category to ignore",
              type: 7,
              required: true,
            },
          ],
        },
        {
          name: "unignore",
          description: "Remove a channel or category from the ignored list.",
          type: 1,
          options: [
            {
              name: "channel",
              description: "Channel or category to re-include",
              type: 7,
              required: true,
            },
          ],
        },
        {
          name: "enable",
          description: "Enable the verification system for your server.",
          type: 1,
        },
        {
          name: "disable",
          description: "Disable the verification system for your server.",
          type: 1,
        },
        {
          name: "status",
          description: "View current verification settings, roles, and channels.",
          type: 1,
        },
        {
          name: "send",
          description: "Re-send the verification button message to the channel.",
          type: 1,
        },
      ],
    });
  }

  /**
   * Find an existing role or create it safely.
   */
  async _getOrCreateRole(guild, name, color, defaultName) {
    let role = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    );

    if (!role) {
      role = await guild.roles.create({
        name: defaultName || name,
        color: color,
        permissions: [],
        reason: "Automatic verification system setup",
      }).catch(() => null);
    }

    return role;
  }

  /**
   * Accurately detects whether a channel is a private staff/admin/audit/ticket channel
   */
  _isPrivateOrStaffChannel(ch, guild, everyoneRole, verifiedRole, unverifiedRole, ignoredChannels = []) {
    if (ch.isThread && ch.isThread()) return true;

    // 1. Explicitly in ignoredChannels list or parent category ignored
    if (
      ignoredChannels.includes(ch.id) ||
      (ch.parent && ignoredChannels.includes(ch.parent.id))
    ) {
      return true;
    }

    const chName = (ch.name || "").toLowerCase();
    const parentName = (ch.parent?.name || "").toLowerCase();

    // 2. Name check for staff, admin, moderation, ticket, log keywords
    const privateKeywords = [
      "admin", "staff", "mod-", "mod_", "-mod", "_mod", "moderator",
      "audit", "log", "logs", "ticket", "tickets", "private", "secret",
      "owner", "founder", "head-", "dev-", "developer", "vip-staff",
      "management", "team", "security", "jail", "mute", "bot-log",
      "bot-logs", "bot-command", "bot-commands", "archive", "test",
      "confidential", "hidden", "internal", "exec", "officer", "council"
    ];
    if (privateKeywords.some((kw) => chName.includes(kw) || parentName.includes(kw))) {
      return true;
    }

    // 3. User-specific permission overwrites (type 1) granting ViewChannel (tickets, private chats)
    const hasUserOverwrites = ch.permissionOverwrites.cache.some(
      (ow) =>
        ow.type === 1 &&
        ow.id !== guild.client.user.id &&
        ow.allow.has(PermissionsBitField.Flags.ViewChannel)
    );
    if (hasUserOverwrites) return true;

    // 4. Check for staff role overwrites
    const hasStaffRoleOverwrite = ch.permissionOverwrites.cache.some((ow) => {
      if (ow.type !== 0) return false;
      if (
        ow.id === everyoneRole.id ||
        (verifiedRole && ow.id === verifiedRole.id) ||
        (unverifiedRole && ow.id === unverifiedRole.id)
      ) {
        return false;
      }
      const r = guild.roles.cache.get(ow.id);
      if (!r) return false;
      const isStaffRole =
        r.permissions.has([
          PermissionsBitField.Flags.ManageGuild,
          PermissionsBitField.Flags.Administrator,
          PermissionsBitField.Flags.BanMembers,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ModerateMembers,
          PermissionsBitField.Flags.ManageRoles,
          PermissionsBitField.Flags.KickMembers,
        ]) ||
        /admin|staff|mod|founder|owner|management|team|security/i.test(r.name);
      return isStaffRole && ow.allow.has(PermissionsBitField.Flags.ViewChannel);
    });
    if (hasStaffRoleOverwrite) return true;

    // 5. Check if parent category denies ViewChannel to @everyone
    if (ch.parent) {
      const parentEveryoneOw = ch.parent.permissionOverwrites?.cache?.get(everyoneRole.id);
      if (parentEveryoneOw && parentEveryoneOw.deny.has(PermissionsBitField.Flags.ViewChannel)) {
        return true;
      }
      if (ch.parent.permissionsFor(everyoneRole)?.has(PermissionsBitField.Flags.ViewChannel) === false) {
        return true;
      }
    }

    // 6. Check if @everyone overwrite on the channel itself denies ViewChannel
    const everyoneOw = ch.permissionOverwrites.cache.get(everyoneRole.id);
    if (everyoneOw && everyoneOw.deny.has(PermissionsBitField.Flags.ViewChannel)) {
      // If it was never explicitly unlocked for verified role before, it is definitely private!
      const verifiedOw = verifiedRole ? ch.permissionOverwrites.cache.get(verifiedRole.id) : null;
      const wasExplicitlyUnlocked = verifiedOw && verifiedOw.allow.has(PermissionsBitField.Flags.ViewChannel);
      if (!wasExplicitlyUnlocked) {
        return true;
      }
    }

    // 7. Check if @everyone cannot view this channel by default
    if (ch.permissionsFor(everyoneRole)?.has(PermissionsBitField.Flags.ViewChannel) === false) {
      const verifiedOw = verifiedRole ? ch.permissionOverwrites.cache.get(verifiedRole.id) : null;
      const wasExplicitlyUnlocked = verifiedOw && verifiedOw.allow.has(PermissionsBitField.Flags.ViewChannel);
      if (!wasExplicitlyUnlocked) {
        return true;
      }
    }

    return false;
  }

  /**
   * Configures channel permissions:
   * - Verification channel: Unverified role has ViewChannel: true, SendMessages: false
   * - All other channels: Unverified role has ViewChannel: false (hidden)
   * - Channels are NOT made private (@everyone is never locked/denied)
   * - Verified role has no permissions configured (cosmetic/display only)
   */
  async _applyVerificationPermissions(guild, verifyChannel, verifiedRole, unverifiedRole, ignoredChannels = []) {
    // 1. Configure Verification Channel
    if (unverifiedRole && verifyChannel && verifyChannel.permissionOverwrites) {
      await verifyChannel.permissionOverwrites.edit(unverifiedRole.id, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        AddReactions: false,
      }).catch(() => {});
    }

    // Ensure verified role has NO overwrite on verification channel (cosmetic only)
    if (verifiedRole && verifyChannel && verifyChannel.permissionOverwrites) {
      const verifiedOw = verifyChannel.permissionOverwrites.cache.get(verifiedRole.id);
      if (verifiedOw) {
        await verifyChannel.permissionOverwrites.delete(verifiedRole.id, "Verified role is cosmetic").catch(() => {});
      }
    }

    // Allow Bot
    const botId = guild.client.user.id;
    if (verifyChannel && verifyChannel.permissionOverwrites) {
      await verifyChannel.permissionOverwrites.edit(botId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        EmbedLinks: true,
        AttachFiles: true,
      }).catch(() => {});
    }

    // 2. Configure all other channels in the guild
    const channels = guild.channels.cache.filter((c) => c.id !== verifyChannel?.id);
    let configuredCount = 0;

    for (const [, ch] of channels) {
      try {
        if (!ch.permissionOverwrites) continue;

        if (
          ignoredChannels.includes(ch.id) ||
          (ch.parent && ignoredChannels.includes(ch.parent.id))
        ) {
          continue;
        }

        // Hide channel from Unverified role
        if (unverifiedRole) {
          await ch.permissionOverwrites.edit(unverifiedRole.id, {
            ViewChannel: false,
          }, { reason: "Hide channel from unverified members" }).catch(() => {});
        }

        // Ensure verified role has NO overwrite on this channel
        if (verifiedRole) {
          const verifiedOw = ch.permissionOverwrites.cache.get(verifiedRole.id);
          if (verifiedOw) {
            // If the old system unlocked this channel for verified role and locked @everyone,
            // unlock @everyone so the channel is NOT private anymore!
            if (verifiedOw.allow.has(PermissionsBitField.Flags.ViewChannel)) {
              const everyoneOw = ch.permissionOverwrites.cache.get(guild.roles.everyone.id);
              if (everyoneOw && everyoneOw.deny.has(PermissionsBitField.Flags.ViewChannel)) {
                await ch.permissionOverwrites.edit(guild.roles.everyone.id, {
                  ViewChannel: null,
                }).catch(() => {});
              }
            }
            await ch.permissionOverwrites.delete(verifiedRole.id, "Verified role is cosmetic").catch(() => {});
          }
        }

        configuredCount++;
        // Small delay to be rate-limit safe
        await new Promise((r) => setTimeout(r, 60));
      } catch {}
    }

    return { configuredCount };
  }

  _buildVerificationMessage(guild) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🛡️ Server Verification")
      .setDescription(
        "Welcome to the server!\n\n" +
        "Click **Verify Now** below to complete verification and unlock server channels."
      )
      .setFooter({ text: "Secure Verification System" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_button")
        .setLabel("Verify Now")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row] };
  }

  // Find an existing role or create it.
  async getOrCreateRole(guild, name, color) {
    let role = guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());

    if (!role) {
      role = await guild.roles.create({
        name,
        color,
        permissions: [],
        reason: "Automatic verification system setup",
      });
      console.log(`[${guild.name}] Created role: ${name}`);
    }

    return role;
  }

  // Create roles and the private channel separately for each guild.
  async setupVerification(guild, channelArg, roleArg, unverifiedRoleArg) {
    const me = await guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      throw new Error("Bot needs Manage Roles permission.");
    }

    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      throw new Error("Bot needs Manage Channels permission.");
    }

    const verified = roleArg || (await this.getOrCreateRole(
      guild, VERIFIED_NAME, 0x2ECC71
    ));

    const unverified = unverifiedRoleArg || (await this.getOrCreateRole(
      guild, UNVERIFIED_NAME, 0xF1C40F
    ));

    const botMember = await guild.members.fetchMe();

    if (
      verified.position >= botMember.roles.highest.position ||
      unverified.position >= botMember.roles.highest.position
    ) {
      throw new Error(
        "Move the bot's highest role above Verified and Unverified."
      );
    }

    let channel = channelArg || guild.channels.cache.find(
      (c) => c.name.toLowerCase() === DEFAULT_CHANNEL_NAME.toLowerCase() &&
             c.type === ChannelType.GuildText
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: DEFAULT_CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: "Server Verification",
        permissionOverwrites: [
          {
            id: unverified.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
            deny: [
              PermissionsBitField.Flags.SendMessages,
            ],
          },
          {
            id: this.client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.EmbedLinks,
            ],
          },
        ],
        reason: "Automatic verification channel setup",
      });
    } else {
      // Configure unverified role on existing verification channel
      await channel.permissionOverwrites.edit(unverified.id, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
      }).catch(() => {});

      await channel.permissionOverwrites.edit(this.client.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        EmbedLinks: true,
      }).catch(() => {});

      if (verified) {
        const verifiedOw = channel.permissionOverwrites.cache.get(verified.id);
        if (verifiedOw) {
          await channel.permissionOverwrites.delete(verified.id).catch(() => {});
        }
      }
    }

    const verifyPayload = this._buildVerificationMessage(guild);
    await channel.send(verifyPayload);

    // Secure all other channels (hidden for unverified role, channels remain public, verified role cosmetic)
    const verification = (await this.client.database.guildVerificationData.get(guild.id)) || {};
    const ignoredChannels = verification?.ignoredChannels || [];
    await this._applyVerificationPermissions(
      guild,
      channel,
      verified,
      unverified,
      ignoredChannels
    );

    verification.enabled = true;
    verification.channel = channel.id;
    verification.role = verified.id;
    verification.unverifiedRole = unverified.id;
    await this.client.database.guildVerificationData.post(guild.id, verification);

    return { verified, unverified, channel };
  }

  // Shared setup function for prefix and slash commands.
  async handleSetup(guild, reply, channelArg, roleArg, unverifiedRoleArg) {
    try {
      const { verified, unverified, channel } =
        await this.setupVerification(guild, channelArg, roleArg, unverifiedRoleArg);

      await reply(
        `✅ Verification setup complete!\n` +
        `• **Channel:** ${channel}\n` +
        `• **Unverified role:** ${unverified.name} *(All other channels hidden, visible only here)*\n` +
        `• **Verified role:** ${verified.name} *(Cosmetic display role)*\n` +
        `• **Channels Status:** Normal (not private) — verifying removes unverified role to unlock access.`
      );
    } catch (error) {
      console.error(`[${guild.name}] Setup error:`, error);
      await reply(`❌ Setup failed: ${error.message}`);
    }
  }

  async _handleSetup(ctx, guild, channelArg, roleArg, unverifiedRoleArg, isSlash = false) {
    return this.handleSetup(
      guild,
      (content) => (isSlash ? ctx.editReply(content) : ctx.reply(content)),
      channelArg,
      roleArg,
      unverifiedRoleArg
    );
  }

  async run({ message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Only administrators can run this command.");
    }

    const sub = (args[0] || "").toLowerCase();
    const guild = message.guild;
    const prefix = message.guild.config?.prefix || this.client.config.Client.Prefix || "$";

    // SETUP
    if (sub === "setup" || sub === "set" || sub === "enable" || sub === "add" || !sub) {
      const channel =
        message.mentions.channels.first() ||
        guild.channels.cache.get(args[1]) ||
        null;

      const mentionedRoles = message.mentions.roles;
      let verifiedRole = null;
      let unverifiedRole = null;

      if (mentionedRoles.size > 0) {
        verifiedRole = mentionedRoles.first();
        if (mentionedRoles.size > 1) {
          unverifiedRole = mentionedRoles.at(1);
        }
      }

      // Check args for IDs or names if not mentioned
      if (!verifiedRole && args[1] && !channel) {
        verifiedRole = guild.roles.cache.get(args[1]);
      }
      if (!verifiedRole && args[2]) {
        verifiedRole = guild.roles.cache.get(args[2]);
      }
      if (!unverifiedRole && args[3]) {
        unverifiedRole = guild.roles.cache.get(args[3]);
      }

      return await this._handleSetup(message, guild, channel, verifiedRole, unverifiedRole, false);
    }

    // FIXPERMS: Scans server and cleans up private channels
    if (sub === "fixperms" || sub === "fix" || sub === "protect") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!data || !data.enabled || !data.role) {
        return message.reply(`❌ Verification is currently disabled or not configured. Run \`${prefix}verify setup\` first.`);
      }
      const role =
        guild.roles.cache.get(data.role) ||
        (await guild.roles.fetch(data.role).catch(() => null));
      if (!role) {
        return message.reply(`❌ Verification role was not found in this server. Run \`${prefix}verify setup\` first.`);
      }

      let unverifiedRole = null;
      if (data.unverifiedRole) {
        unverifiedRole =
          guild.roles.cache.get(data.unverifiedRole) ||
          (await guild.roles.fetch(data.unverifiedRole).catch(() => null));
      }
      if (!unverifiedRole) {
        unverifiedRole = guild.roles.cache.find((r) => r.name.toLowerCase() === "unverified");
      }

      const verifyChannel =
        guild.channels.cache.get(data.channel) || {
          id: "none",
          permissionOverwrites: { edit: () => {} },
        };
      const waitMsg = await message.reply("⏳ Auditing all server channels to configure permissions...");

      const { configuredCount } = await this._applyVerificationPermissions(
        guild,
        verifyChannel,
        role,
        unverifiedRole,
        data.ignoredChannels || []
      );

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🛡️ Channel Permissions Successfully Updated!")
        .setDescription(
          `All server channels have been configured:\n\n` +
            `• **Channels Configured:** **${configuredCount}** channels *(Hidden from unverified members)*\n` +
            `• **Channels are NOT private:** @everyone has standard public access\n` +
            `• **Verified Role:** Cosmetic only (no channel overwrites)\n\n` +
            `*Unverified members only see the verification channel. Verifying removes the unverified role and unlocks all channels.*`
        )
        .setTimestamp();

      return waitMsg.edit({ content: null, embeds: [embed] });
    }

    // IGNORE CHANNEL
    if (sub === "ignore") {
      const ch = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      if (!ch) {
        return message.reply(`❌ Please mention a channel or category to ignore: \`${prefix}verify ignore #channel\``);
      }
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!Array.isArray(data.ignoredChannels)) data.ignoredChannels = [];
      if (!data.ignoredChannels.includes(ch.id)) {
        data.ignoredChannels.push(ch.id);
        await this.client.database.guildVerificationData.post(guild.id, data);
      }
      if (data.role) {
        await ch.permissionOverwrites.delete(data.role).catch(() => {});
        await ch.permissionOverwrites.edit(data.role, { ViewChannel: false }).catch(() => {});
      }
      if (data.unverifiedRole) {
        await ch.permissionOverwrites.delete(data.unverifiedRole).catch(() => {});
        await ch.permissionOverwrites.edit(data.unverifiedRole, { ViewChannel: false }).catch(() => {});
      }
      return message.reply(`✅ <#${ch.id}> is now **ignored** by verification! Neither verified nor unverified users can see it.`);
    }

    // UNIGNORE CHANNEL
    if (sub === "unignore") {
      const ch = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      if (!ch) {
        return message.reply(`❌ Please mention a channel or category: \`${prefix}verify unignore #channel\``);
      }
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (Array.isArray(data.ignoredChannels)) {
        data.ignoredChannels = data.ignoredChannels.filter((id) => id !== ch.id);
        await this.client.database.guildVerificationData.post(guild.id, data);
      }
      return message.reply(`✅ Removed <#${ch.id}> from ignored list.`);
    }

    // ENABLE
    if (sub === "enable" || sub === "on") {
      const verification = await this.client.database.guildVerificationData.get(guild.id);
      if (verification && verification.role && verification.channel) {
        verification.enabled = true;
        await this.client.database.guildVerificationData.post(guild.id, verification);
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setDescription("🟢 Verification system has been **enabled** for this server.");
        return message.reply({ embeds: [embed] });
      }
      return message.reply(`❌ Verification is not fully configured yet. Run \`${prefix}verify setup\` first.`);
    }

    // DISABLE
    if (sub === "disable" || sub === "remove" || sub === "off" || sub === "delete") {
      const verification = await this.client.database.guildVerificationData.get(guild.id);
      verification.enabled = false;
      await this.client.database.guildVerificationData.post(guild.id, verification);

      const embed = new EmbedBuilder()
        .setColor(0xFF3344)
        .setDescription("🛑 Verification system has been **disabled** for this server.");
      return message.reply({ embeds: [embed] });
    }

    // STATUS
    if (sub === "status" || sub === "config") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      const isEnabled = Boolean(data && data.enabled);

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x2ECC71 : 0xFF3344)
        .setTitle(`🛡️ ${guild.name} • Verification Status`)
        .setDescription(
          `**Status:** ${isEnabled ? "🟢 **Active & Enforcing**" : "🔴 **Disabled**"}\n` +
            `**Verification Channel:** ${data?.channel ? `<#${data.channel}>` : "`Not configured`"}\n` +
            `**Verified Role:** ${data?.role ? `<@&${data.role}>` : "`Not configured`"}\n` +
            `**Unverified Role:** ${data?.unverifiedRole ? `<@&${data.unverifiedRole}>` : "`Not configured`"}\n` +
            `**Ignored Channels:** ${data?.ignoredChannels?.length ? data.ignoredChannels.map((id) => `<#${id}>`).join(", ") : "`None`"}\n\n` +
            `### 🛠️ Quick Commands:\n` +
            `• \`${prefix}verify setup [channel] [role] [unverifiedRole]\` — Configure system\n` +
            `• \`${prefix}verify fixperms\` — Re-lock private channels and ensure security\n` +
            `• \`${prefix}verify ignore <#channel>\` — Keep a channel strictly hidden\n` +
            `• \`${prefix}verify send\` — Re-send verification button message\n` +
            `• \`${prefix}verify disable\` — Turn off verification`
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // SEND BUTTON
    if (sub === "send") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!data || !data.enabled || !data.channel) {
        return message.reply(`❌ Verification is not enabled or channel is not set. Run \`${prefix}verify setup\` first.`);
      }
      const channel =
        guild.channels.cache.get(data.channel) ||
        (await guild.channels.fetch(data.channel).catch(() => null));
      if (!channel) {
        return message.reply("❌ Configured verification channel was not found.");
      }
      const verifyPayload = this._buildVerificationMessage(guild);
      await channel.send(verifyPayload);
      return message.reply(`✅ Re-sent verification message to <#${channel.id}>!`);
    }

    // Default fallback
    return message.reply(
      `⚙️ **Usage:** \`${prefix}verify setup\` | \`${prefix}verify fixperms\` | \`${prefix}verify ignore <#channel>\` | \`${prefix}verify disable\` | \`${prefix}verify status\``
    );
  }

  async exec({ interaction }) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can run this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === "setup") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");
      const unverifiedRole = interaction.options.getRole("unverified_role");
      return await this._handleSetup(interaction, guild, channel, role, unverifiedRole, true);
    }

    if (sub === "fixperms") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!data || !data.enabled || !data.role) {
        return interaction.reply({
          content: "❌ Verification is currently disabled or not configured. Run `/verify setup` first.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const role =
        guild.roles.cache.get(data.role) ||
        (await guild.roles.fetch(data.role).catch(() => null));
      if (!role) {
        return interaction.reply({
          content: "❌ Verification role was not found in this server.",
          flags: MessageFlags.Ephemeral,
        });
      }

      let unverifiedRole = null;
      if (data.unverifiedRole) {
        unverifiedRole =
          guild.roles.cache.get(data.unverifiedRole) ||
          (await guild.roles.fetch(data.unverifiedRole).catch(() => null));
      }
      if (!unverifiedRole) {
        unverifiedRole = guild.roles.cache.find((r) => r.name.toLowerCase() === "unverified");
      }

      await interaction.deferReply();
      const verifyChannel =
        guild.channels.cache.get(data.channel) || {
          id: "none",
          permissionOverwrites: { edit: () => {} },
        };
      const { configuredCount } = await this._applyVerificationPermissions(
        guild,
        verifyChannel,
        role,
        unverifiedRole,
        data.ignoredChannels || []
      );

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🛡️ Channel Permissions Successfully Updated!")
        .setDescription(
          `All server channels have been configured:\n\n` +
            `• **Channels Configured:** **${configuredCount}** channels *(Hidden from unverified members)*\n` +
            `• **Channels are NOT private:** @everyone has standard public access\n` +
            `• **Verified Role:** Cosmetic only (no channel overwrites)\n\n` +
            `*Unverified members only see the verification channel. Verifying removes the unverified role and unlocks all channels.*`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "ignore") {
      const ch = interaction.options.getChannel("channel");
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!Array.isArray(data.ignoredChannels)) data.ignoredChannels = [];
      if (!data.ignoredChannels.includes(ch.id)) {
        data.ignoredChannels.push(ch.id);
        await this.client.database.guildVerificationData.post(guild.id, data);
      }
      if (data.role) {
        await ch.permissionOverwrites.delete(data.role).catch(() => {});
        await ch.permissionOverwrites.edit(data.role, { ViewChannel: false }).catch(() => {});
      }
      if (data.unverifiedRole) {
        await ch.permissionOverwrites.delete(data.unverifiedRole).catch(() => {});
        await ch.permissionOverwrites.edit(data.unverifiedRole, { ViewChannel: false }).catch(() => {});
      }
      return interaction.reply(`✅ <#${ch.id}> is now **ignored** by verification!`);
    }

    if (sub === "unignore") {
      const ch = interaction.options.getChannel("channel");
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (Array.isArray(data.ignoredChannels)) {
        data.ignoredChannels = data.ignoredChannels.filter((id) => id !== ch.id);
        await this.client.database.guildVerificationData.post(guild.id, data);
      }
      return interaction.reply(`✅ Removed <#${ch.id}> from ignored list.`);
    }

    if (sub === "enable") {
      const verification = await this.client.database.guildVerificationData.get(guild.id);
      if (verification && verification.role && verification.channel) {
        verification.enabled = true;
        await this.client.database.guildVerificationData.post(guild.id, verification);
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setDescription("🟢 Verification system has been **enabled** for this server.");
        return interaction.reply({ embeds: [embed] });
      }
      return interaction.reply({
        content: "❌ Verification is not fully configured yet. Run `/verify setup` first.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "disable") {
      const verification = await this.client.database.guildVerificationData.get(guild.id);
      verification.enabled = false;
      await this.client.database.guildVerificationData.post(guild.id, verification);

      const embed = new EmbedBuilder()
        .setColor(0xFF3344)
        .setDescription("🛑 Verification system has been **disabled** for this server.");
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "status") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      const isEnabled = Boolean(data && data.enabled);
      const prefix = guild.config?.prefix || this.client.config.Client.Prefix || "$";

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x2ECC71 : 0xFF3344)
        .setTitle(`🛡️ ${guild.name} • Verification Status`)
        .setDescription(
          `**Status:** ${isEnabled ? "🟢 **Active & Enforcing**" : "🔴 **Disabled**"}\n` +
            `**Verification Channel:** ${data?.channel ? `<#${data.channel}>` : "`Not configured`"}\n` +
            `**Verified Role:** ${data?.role ? `<@&${data.role}>` : "`Not configured`"}\n` +
            `**Unverified Role:** ${data?.unverifiedRole ? `<@&${data.unverifiedRole}>` : "`Not configured`"}\n` +
            `**Ignored Channels:** ${data?.ignoredChannels?.length ? data.ignoredChannels.map((id) => `<#${id}>`).join(", ") : "`None`"}\n\n` +
            `*To configure or activate, run \`${prefix}verify setup\` or \`/verify setup\`.*`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "send") {
      const data = await this.client.database.guildVerificationData.get(guild.id);
      if (!data || !data.enabled || !data.channel) {
        return interaction.reply({
          content: "❌ Verification is not enabled or channel is not set. Run `/verify setup` first.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const channel =
        guild.channels.cache.get(data.channel) ||
        (await guild.channels.fetch(data.channel).catch(() => null));
      if (!channel) {
        return interaction.reply({
          content: "❌ Configured verification channel was not found.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const verifyPayload = this._buildVerificationMessage(guild);
      await channel.send(verifyPayload);
      return interaction.reply({
        content: `✅ Re-sent verification message to <#${channel.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
