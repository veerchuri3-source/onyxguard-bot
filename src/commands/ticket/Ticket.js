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
} = require("discord.js");

module.exports = class Ticket extends Command {
  constructor(...args) {
    super(...args, {
      name: "ticket",
      aliases: ["tickets", "ticketsystem", "tkt"],
      description: "Set up and manage the server ticket support system",
      category: "Ticket",
      usage: [
        "ticket setup [channel] [category] [role] [logs]",
        "ticket panel [channel]",
        "ticket close [reason]",
        "ticket add <@user>",
        "ticket remove <@user>",
        "ticket claim",
        "ticket transcript",
        "ticket status",
        "ticket disable",
      ],
      userPerms: ["SendMessages"],
      botPerms: [
        "ViewChannel",
        "SendMessages",
        "ManageChannels",
        "ManageMessages",
        "EmbedLinks",
        "AttachFiles",
      ],
      guildOnly: true,
      cooldown: 3,
      options: [
        {
          name: "setup",
          description: "Configure and activate the ticket system with a ticket panel",
          type: 1,
          options: [
            {
              name: "channel",
              description: "Channel where the ticket creation panel will be posted",
              type: 7,
              channelTypes: [ChannelType.GuildText],
              required: false,
            },
            {
              name: "category",
              description: "Category where new ticket channels will be created",
              type: 7,
              channelTypes: [ChannelType.GuildCategory],
              required: false,
            },
            {
              name: "role",
              description: "Support staff role allowed to view and manage tickets",
              type: 8,
              required: false,
            },
            {
              name: "logs",
              description: "Channel where closed ticket logs and transcripts are sent",
              type: 7,
              channelTypes: [ChannelType.GuildText],
              required: false,
            },
          ],
        },
        {
          name: "panel",
          description: "Send or re-send the ticket creation panel",
          type: 1,
          options: [
            {
              name: "channel",
              description: "Channel to send the panel in",
              type: 7,
              channelTypes: [ChannelType.GuildText],
              required: false,
            },
          ],
        },
        {
          name: "close",
          description: "Close the current ticket channel",
          type: 1,
          options: [
            {
              name: "reason",
              description: "Reason for closing the ticket",
              type: 3,
              required: false,
            },
          ],
        },
        {
          name: "add",
          description: "Add a member to this ticket channel",
          type: 1,
          options: [
            {
              name: "user",
              description: "Member to add",
              type: 6,
              required: true,
            },
          ],
        },
        {
          name: "remove",
          description: "Remove a member from this ticket channel",
          type: 1,
          options: [
            {
              name: "user",
              description: "Member to remove",
              type: 6,
              required: true,
            },
          ],
        },
        {
          name: "claim",
          description: "Claim the current ticket as support staff",
          type: 1,
        },
        {
          name: "transcript",
          description: "Generate and save a transcript of the current ticket",
          type: 1,
        },
        {
          name: "status",
          description: "View current ticket system settings and status",
          type: 1,
        },
        {
          name: "disable",
          description: "Disable the ticket system for this server",
          type: 1,
        },
      ],
    });
  }

  async _handleSetup(ctx, guild, channelArg, categoryArg, roleArg, logsArg, isSlash = false) {
    const member = isSlash ? ctx.member : ctx.member;
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const err = "❌ You need **Administrator** permissions to set up the ticket system.";
      return isSlash ? ctx.reply({ content: err, ephemeral: true }) : ctx.reply(err);
    }

    const botMember =
      guild.members.me ||
      (await guild.members.fetch(this.client.user.id).catch(() => null));

    if (
      !botMember.permissions.has([
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
      ])
    ) {
      const err = "❌ I need **Manage Channels** and **Send Messages** permissions to set up tickets!";
      return isSlash ? ctx.reply({ content: err, ephemeral: true }) : ctx.reply(err);
    }

    const progressMsg = isSlash
      ? await ctx.reply({ content: "⏳ Configuring ticket system...", fetchReply: true })
      : await ctx.reply("⏳ Configuring ticket system...");

    // 1. Resolve or Create Panel Channel
    let channel = channelArg;
    if (!channel) {
      channel = guild.channels.cache.find(
        (c) =>
          (c.name === "tickets" || c.name === "ticket-panel" || c.name === "support") &&
          c.type === ChannelType.GuildText
      );
      if (!channel) {
        channel = await guild.channels
          .create({
            name: "tickets",
            type: ChannelType.GuildText,
            topic: "Open support tickets here",
          })
          .catch(() => null);
      }
    }

    if (!channel) {
      const err = "❌ Failed to find or create the ticket panel channel. Please specify one: `ticket setup #channel`";
      return isSlash ? ctx.editReply({ content: err }) : progressMsg.edit(err);
    }

    // 2. Resolve or Create Category
    let category = categoryArg;
    if (!category) {
      category = guild.channels.cache.find(
        (c) =>
          (c.name.toLowerCase() === "tickets" || c.name.toLowerCase() === "support tickets") &&
          c.type === ChannelType.GuildCategory
      );
      if (!category) {
        category = await guild.channels
          .create({
            name: "Tickets",
            type: ChannelType.GuildCategory,
          })
          .catch(() => null);
      }
    }

    // 3. Resolve or Create Support Role
    let role = roleArg;
    if (!role) {
      role = guild.roles.cache.find(
        (r) =>
          r.name.toLowerCase() === "support team" ||
          r.name.toLowerCase() === "ticket support" ||
          r.name.toLowerCase() === "staff"
      );
      if (!role) {
        role = await guild.roles
          .create({
            name: "Support Team",
            color: "#5865F2",
            reason: "Ticket System Support Role",
          })
          .catch(() => null);
      }
    }

    // 4. Resolve Logs Channel (optional)
    let logsChannel = logsArg || null;

    // 5. Send Panel Embed
    const panelPayload = this.client.ticketManager.buildPanelMessage(guild);
    const panelMsg = await channel.send(panelPayload).catch(() => null);

    // 6. Save in DB
    const config = await this.client.database.guildTicketData.get(guild.id);
    config.enabled = true;
    config.channel = channel.id;
    if (panelMsg) config.messageId = panelMsg.id;
    if (category) config.category = category.id;
    if (role) config.role = role.id;
    if (logsChannel) config.logsChannel = logsChannel.id;
    await this.client.database.guildTicketData.post(guild.id, config);

    // 7. Success confirmation
    const successEmbed = new EmbedBuilder()
      .setColor("#00ff7f")
      .setTitle("✅ Ticket System Configured Successfully!")
      .setDescription(
        `Your server support desk is now **fully active**!\n\n` +
          `• **Ticket Panel Channel:** <#${channel.id}>\n` +
          `• **Ticket Category:** ${category ? `<#${category.id}>` : "`None`"}\n` +
          `• **Support Role:** ${role ? `<@&${role.id}>` : "`None`"}\n` +
          `• **Logs Channel:** ${logsChannel ? `<#${logsChannel.id}>` : "`Not configured`"}\n\n` +
          `**How it works:**\n` +
          `1. Members click the **Open Ticket** button in <#${channel.id}>.\n` +
          `2. A private channel is instantly generated under ${category ? `<#${category.id}>` : "your server"}.\n` +
          `3. Only the ticket creator and staff with ${role ? `<@&${role.id}>` : "Manage Channels"} can view it!\n` +
          `4. When closed, full chat transcripts can be saved and logged.`
      )
      .setFooter({
        text: `Synapse Tickets • Setup Complete`,
        iconURL: this.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    if (isSlash) {
      return ctx.editReply({ content: null, embeds: [successEmbed] });
    } else {
      return progressMsg.edit({ content: null, embeds: [successEmbed] });
    }
  }

  async run({ message, args }) {
    const sub = (args[0] || "").toLowerCase();
    const guild = message.guild;

    if (sub === "setup") {
      const channel =
        message.mentions.channels.first() ||
        guild.channels.cache.get(args[1]) ||
        null;

      // Category
      let category = null;
      if (args[2]) {
        category =
          guild.channels.cache.get(args[2]) ||
          guild.channels.cache.find(
            (c) => c.name.toLowerCase() === args[2].toLowerCase() && c.type === ChannelType.GuildCategory
          ) ||
          null;
      }

      // Role
      const role =
        message.mentions.roles.first() ||
        guild.roles.cache.get(args[3]) ||
        null;

      // Logs
      const logs =
        message.mentions.channels.filter((c) => c.id !== channel?.id).first() ||
        guild.channels.cache.get(args[4]) ||
        null;

      return await this._handleSetup(message, guild, channel, category, role, logs, false);
    }

    if (sub === "panel" || sub === "send") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to send the ticket panel.");
      }

      const targetChannel =
        message.mentions.channels.first() ||
        guild.channels.cache.get(args[1]) ||
        message.channel;

      const panelPayload = this.client.ticketManager.buildPanelMessage(guild);
      const sent = await targetChannel.send(panelPayload).catch((err) => {
        return message.reply(`❌ Failed to send panel: ${err.message}`);
      });

      if (sent) {
        const config = await this.client.database.guildTicketData.get(guild.id);
        config.enabled = true;
        config.channel = targetChannel.id;
        config.messageId = sent.id;
        await this.client.database.guildTicketData.post(guild.id, config);
        return message.reply(`✅ Ticket panel successfully sent to <#${targetChannel.id}>!`);
      }
      return;
    }

    if (sub === "close") {
      const ticket = await this.client.database.ticketData.getByChannel(message.channel.id);
      if (!ticket || ticket.closed) {
        return message.reply("❌ This channel is not an active ticket!");
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      const isStaff = await this.client.ticketManager.isStaff(message.member, config);
      const isOwner = ticket.userId === message.author.id;

      if (!isStaff && !isOwner) {
        return message.reply("❌ Only the ticket creator or support staff can close this ticket!");
      }

      const reason = args.slice(1).join(" ") || "No reason provided";
      ticket.reason = reason;
      await this.client.database.ticketData.post(message.channel.id, ticket);

      // Trigger confirmation
      const confirmEmbed = new EmbedBuilder()
        .setColor("#ffcc00")
        .setTitle("🔒 Close Confirmation")
        .setDescription(
          `Are you sure you want to close **Ticket #${ticket.ticketNumber}**?\n` +
            `**Reason:** \`${reason}\`\n` +
            `A transcript will be saved and this channel will be deleted.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_confirm_close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_cancel_close")
          .setLabel("Cancel")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Secondary)
      );

      return message.channel.send({ embeds: [confirmEmbed], components: [row] });
    }

    if (sub === "add") {
      const ticket = await this.client.database.ticketData.getByChannel(message.channel.id);
      if (!ticket || ticket.closed) {
        return message.reply("❌ This channel is not an active ticket!");
      }

      const target =
        message.mentions.members.first() ||
        (await guild.members.fetch(args[1]).catch(() => null));

      if (!target) {
        return message.reply("❌ Please mention or provide the ID of a user to add: `ticket add @user`");
      }

      await this.client.ticketManager.addUser(message.channel, target);
      return message.reply(`✅ Added ${target} to this ticket.`);
    }

    if (sub === "remove") {
      const ticket = await this.client.database.ticketData.getByChannel(message.channel.id);
      if (!ticket || ticket.closed) {
        return message.reply("❌ This channel is not an active ticket!");
      }

      const target =
        message.mentions.members.first() ||
        (await guild.members.fetch(args[1]).catch(() => null));

      if (!target) {
        return message.reply("❌ Please mention or provide the ID of a user to remove: `ticket remove @user`");
      }

      if (target.id === ticket.userId) {
        return message.reply("❌ You cannot remove the ticket creator from their own ticket!");
      }

      await this.client.ticketManager.removeUser(message.channel, target);
      return message.reply(`✅ Removed ${target} from this ticket.`);
    }

    if (sub === "claim") {
      const ticket = await this.client.database.ticketData.getByChannel(message.channel.id);
      if (!ticket || ticket.closed) {
        return message.reply("❌ This channel is not an active ticket!");
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      const isStaff = await this.client.ticketManager.isStaff(message.member, config);
      if (!isStaff) {
        return message.reply("❌ Only support staff can claim tickets!");
      }

      if (ticket.claimedBy) {
        return message.reply(`⚠️ This ticket has already been claimed by <@${ticket.claimedBy}>!`);
      }

      ticket.claimedBy = message.author.id;
      await this.client.database.ticketData.post(message.channel.id, ticket);

      await message.channel
        .setTopic(
          `Ticket #${ticket.ticketNumber} | Claimed by ${message.author.tag} | Creator: <@${ticket.userId}>`
        )
        .catch(() => {});

      const claimEmbed = new EmbedBuilder()
        .setColor("#00ff7f")
        .setDescription(
          `🙋‍♂️ **Ticket Claimed**\n<@${message.author.id}> has claimed this ticket and will be assisting you!`
        )
        .setTimestamp();

      return message.channel.send({ embeds: [claimEmbed] });
    }

    if (sub === "transcript") {
      const ticket = await this.client.database.ticketData.getByChannel(message.channel.id);
      if (!ticket) {
        return message.reply("❌ This channel is not a ticket!");
      }

      const statusMsg = await message.reply("⏳ Generating transcript...");
      const transcript = await this.client.ticketManager.generateTranscript(message.channel, ticket);

      if (!transcript) {
        return statusMsg.edit("❌ Failed to generate transcript.");
      }

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📜 Transcript • Ticket #${ticket.ticketNumber}`)
        .setDescription("Here is the chat transcript of this ticket channel.")
        .setTimestamp();

      return statusMsg.edit({
        content: null,
        embeds: [embed],
        files: [transcript],
      });
    }

    if (sub === "status" || sub === "config") {
      const config = await this.client.database.guildTicketData.get(guild.id);
      const isEnabled = Boolean(config && config.enabled);

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? "#00ff7f" : "#ff3344")
        .setTitle(`🎫 ${guild.name} • Ticket System Status`)
        .setDescription(
          `**Status:** ${isEnabled ? "🟢 **Active & Enabled**" : "🔴 **Disabled**"}\n` +
            `**Panel Channel:** ${config?.channel ? `<#${config.channel}>` : "`Not configured`"}\n` +
            `**Ticket Category:** ${config?.category ? `<#${config.category}>` : "`Not configured`"}\n` +
            `**Support Role:** ${config?.role ? `<@&${config.role}>` : "`Not configured`"}\n` +
            `**Logs Channel:** ${config?.logsChannel ? `<#${config.logsChannel}>` : "`Not configured`"}\n` +
            `**Total Tickets Created:** \`${config?.ticketCount || 0}\`\n\n` +
            `*To set up or reconfigure, run \`${guild.config?.prefix || this.client.config.Client.Prefix || "$"}ticket setup\`.*`
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (sub === "disable" || sub === "off") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to disable tickets.");
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      config.enabled = false;
      await this.client.database.guildTicketData.post(guild.id, config);

      const embed = new EmbedBuilder()
        .setColor("#ff3344")
        .setDescription("🛑 Ticket system has been **disabled** for this server.");
      return message.reply({ embeds: [embed] });
    }

    // Help fallback
    const prefix = guild.config?.prefix || this.client.config.Client.Prefix || "$";
    const helpEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎫 Ticket System Commands")
      .setDescription(
        `\`${prefix}ticket setup [channel] [category] [role] [logs]\` • Configure and activate ticket system\n` +
          `\`${prefix}ticket panel [channel]\` • Send the ticket creation panel\n` +
          `\`${prefix}ticket close [reason]\` • Close the current ticket\n` +
          `\`${prefix}ticket add <@user>\` • Add a member to the ticket\n` +
          `\`${prefix}ticket remove <@user>\` • Remove a member from the ticket\n` +
          `\`${prefix}ticket claim\` • Claim the ticket as support staff\n` +
          `\`${prefix}ticket transcript\` • Export full chat transcript\n` +
          `\`${prefix}ticket status\` • View ticket settings\n` +
          `\`${prefix}ticket disable\` • Disable ticket system`
      )
      .setFooter({ text: `Synapse Tickets` });

    return message.reply({ embeds: [helpEmbed] });
  }

  async exec({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel");
      const category = interaction.options.getChannel("category");
      const role = interaction.options.getRole("role");
      const logs = interaction.options.getChannel("logs");
      return await this._handleSetup(interaction, guild, channel, category, role, logs, true);
    }

    if (sub === "panel") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: "❌ You need **Administrator** permissions to send the ticket panel.",
          ephemeral: true,
        });
      }

      const targetChannel =
        interaction.options.getChannel("channel") || interaction.channel;

      const panelPayload = this.client.ticketManager.buildPanelMessage(guild);
      const sent = await targetChannel.send(panelPayload).catch((err) => {
        return interaction.reply({
          content: `❌ Failed to send panel: ${err.message}`,
          ephemeral: true,
        });
      });

      if (sent) {
        const config = await this.client.database.guildTicketData.get(guild.id);
        config.enabled = true;
        config.channel = targetChannel.id;
        config.messageId = sent.id;
        await this.client.database.guildTicketData.post(guild.id, config);
        return interaction.reply({
          content: `✅ Ticket panel successfully sent to <#${targetChannel.id}>!`,
          ephemeral: true,
        });
      }
      return;
    }

    if (sub === "close") {
      const ticket = await this.client.database.ticketData.getByChannel(interaction.channel.id);
      if (!ticket || ticket.closed) {
        return interaction.reply({
          content: "❌ This channel is not an active ticket!",
          ephemeral: true,
        });
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      const isStaff = await this.client.ticketManager.isStaff(interaction.member, config);
      const isOwner = ticket.userId === interaction.user.id;

      if (!isStaff && !isOwner) {
        return interaction.reply({
          content: "❌ Only the ticket creator or support staff can close this ticket!",
          ephemeral: true,
        });
      }

      const reason =
        interaction.options.getString("reason") || "No reason provided";
      ticket.reason = reason;
      await this.client.database.ticketData.post(interaction.channel.id, ticket);

      const confirmEmbed = new EmbedBuilder()
        .setColor("#ffcc00")
        .setTitle("🔒 Close Confirmation")
        .setDescription(
          `Are you sure you want to close **Ticket #${ticket.ticketNumber}**?\n` +
            `**Reason:** \`${reason}\`\n` +
            `A transcript will be saved and this channel will be deleted.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_confirm_close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_cancel_close")
          .setLabel("Cancel")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ embeds: [confirmEmbed], components: [row] });
    }

    if (sub === "add") {
      const ticket = await this.client.database.ticketData.getByChannel(interaction.channel.id);
      if (!ticket || ticket.closed) {
        return interaction.reply({
          content: "❌ This channel is not an active ticket!",
          ephemeral: true,
        });
      }

      const target = interaction.options.getMember("user");
      if (!target) {
        return interaction.reply({
          content: "❌ Member not found in this server.",
          ephemeral: true,
        });
      }

      await this.client.ticketManager.addUser(interaction.channel, target);
      return interaction.reply({ content: `✅ Added ${target} to this ticket.` });
    }

    if (sub === "remove") {
      const ticket = await this.client.database.ticketData.getByChannel(interaction.channel.id);
      if (!ticket || ticket.closed) {
        return interaction.reply({
          content: "❌ This channel is not an active ticket!",
          ephemeral: true,
        });
      }

      const target = interaction.options.getMember("user");
      if (!target) {
        return interaction.reply({
          content: "❌ Member not found in this server.",
          ephemeral: true,
        });
      }

      if (target.id === ticket.userId) {
        return interaction.reply({
          content: "❌ You cannot remove the ticket creator from their own ticket!",
          ephemeral: true,
        });
      }

      await this.client.ticketManager.removeUser(interaction.channel, target);
      return interaction.reply({ content: `✅ Removed ${target} from this ticket.` });
    }

    if (sub === "claim") {
      const ticket = await this.client.database.ticketData.getByChannel(interaction.channel.id);
      if (!ticket || ticket.closed) {
        return interaction.reply({
          content: "❌ This channel is not an active ticket!",
          ephemeral: true,
        });
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      const isStaff = await this.client.ticketManager.isStaff(interaction.member, config);
      if (!isStaff) {
        return interaction.reply({
          content: "❌ Only support staff can claim tickets!",
          ephemeral: true,
        });
      }

      if (ticket.claimedBy) {
        return interaction.reply({
          content: `⚠️ This ticket has already been claimed by <@${ticket.claimedBy}>!`,
          ephemeral: true,
        });
      }

      ticket.claimedBy = interaction.user.id;
      await this.client.database.ticketData.post(interaction.channel.id, ticket);

      await interaction.channel
        .setTopic(
          `Ticket #${ticket.ticketNumber} | Claimed by ${interaction.user.tag} | Creator: <@${ticket.userId}>`
        )
        .catch(() => {});

      const claimEmbed = new EmbedBuilder()
        .setColor("#00ff7f")
        .setDescription(
          `🙋‍♂️ **Ticket Claimed**\n<@${interaction.user.id}> has claimed this ticket and will be assisting you!`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [claimEmbed] });
    }

    if (sub === "transcript") {
      const ticket = await this.client.database.ticketData.getByChannel(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({
          content: "❌ This channel is not a ticket!",
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const transcript = await this.client.ticketManager.generateTranscript(
        interaction.channel,
        ticket
      );

      if (!transcript) {
        return interaction.editReply({
          content: "❌ Failed to generate transcript.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📜 Transcript • Ticket #${ticket.ticketNumber}`)
        .setDescription("Here is the chat transcript of this ticket channel.")
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        files: [transcript],
      });
    }

    if (sub === "status") {
      const config = await this.client.database.guildTicketData.get(guild.id);
      const isEnabled = Boolean(config && config.enabled);

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? "#00ff7f" : "#ff3344")
        .setTitle(`🎫 ${guild.name} • Ticket System Status`)
        .setDescription(
          `**Status:** ${isEnabled ? "🟢 **Active & Enabled**" : "🔴 **Disabled**"}\n` +
            `**Panel Channel:** ${config?.channel ? `<#${config.channel}>` : "`Not configured`"}\n` +
            `**Ticket Category:** ${config?.category ? `<#${config.category}>` : "`Not configured`"}\n` +
            `**Support Role:** ${config?.role ? `<@&${config.role}>` : "`Not configured`"}\n` +
            `**Logs Channel:** ${config?.logsChannel ? `<#${config.logsChannel}>` : "`Not configured`"}\n` +
            `**Total Tickets Created:** \`${config?.ticketCount || 0}\`\n\n` +
            `*To set up or reconfigure, run \`/ticket setup\`.*`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "disable") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: "❌ You need **Administrator** permissions to disable tickets.",
          ephemeral: true,
        });
      }

      const config = await this.client.database.guildTicketData.get(guild.id);
      config.enabled = false;
      await this.client.database.guildTicketData.post(guild.id, config);

      const embed = new EmbedBuilder()
        .setColor("#ff3344")
        .setDescription("🛑 Ticket system has been **disabled** for this server.");
      return interaction.reply({ embeds: [embed] });
    }
  }
};
