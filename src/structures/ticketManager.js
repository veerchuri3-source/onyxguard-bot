/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = class TicketManager {
  /**
   * @param {import('../base/SynapseClient')} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Build the main Ticket Panel message payload
   */
  buildPanelMessage(guild) {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`🎫 ${guild.name} • Support Tickets`)
      .setDescription(
        `Welcome to our support desk! If you require assistance, have questions, or wish to report an issue, please open a private ticket below.\n\n` +
          `• 📩 **Click "Open Ticket"** below to start\n` +
          `• 💬 A dedicated channel will be created for you\n` +
          `• 🛡️ Only you and the support staff can view your ticket\n\n` +
          `*Please do not open multiple tickets for the same inquiry.*`
      )
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({
        text: `Protected by Synapse Ticket System`,
        iconURL: this.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Open Ticket")
        .setEmoji("📩")
        .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Show Modal for Ticket Reason
   */
  async showCreateModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("ticket_modal_create")
      .setTitle("Create Support Ticket");

    const reasonInput = new TextInputBuilder()
      .setCustomId("ticket_reason")
      .setLabel("What is the reason for this ticket?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Please explain your inquiry or problem in detail...")
      .setRequired(false)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }

  /**
   * Check if a member is authorized staff
   */
  async isStaff(member, guildData) {
    if (!member) return false;
    if (member.id === member.guild.ownerId) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return true;
    if (guildData?.role && member.roles.cache.has(guildData.role)) return true;
    return false;
  }

  /**
   * Handle modal submission to create a new ticket
   */
  async handleModalCreate(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;
    const reason =
      interaction.fields.getTextInputValue("ticket_reason")?.trim() ||
      "No reason provided";

    const guildTicketConfig = await this.client.database.guildTicketData.get(
      guild.id
    );

    if (!guildTicketConfig || !guildTicketConfig.enabled) {
      return interaction.reply({
        content: "❌ Ticket system is currently disabled on this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check user's current open tickets
    const openTickets = await this.client.database.ticketData.getOpenByUser(
      guild.id,
      user.id
    );
    const limit = guildTicketConfig.limit || 1;

    if (openTickets && openTickets.length >= limit) {
      const activeTicket = openTickets[0];
      return interaction.reply({
        content: `❌ You already have an open ticket in this server: <#${activeTicket.channelId}>! Please resolve it before creating a new one.`,
        flags: MessageFlags.Ephemeral,
      });
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
      return interaction.reply({
        content:
          "❌ I do not have permission to **Manage Channels**! Please grant this permission to my role.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Increment ticket count
    guildTicketConfig.ticketCount = (guildTicketConfig.ticketCount || 0) + 1;
    await this.client.database.guildTicketData.post(
      guild.id,
      guildTicketConfig
    );
    const ticketNum = guildTicketConfig.ticketCount;
    const channelName = `ticket-${String(ticketNum).padStart(4, "0")}`;

    // Permissions
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
      {
        id: this.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
    ];

    if (
      guildTicketConfig.role &&
      guild.roles.cache.has(guildTicketConfig.role)
    ) {
      permissionOverwrites.push({
        id: guildTicketConfig.role,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      });
    }

    // Category parent
    let parentCategory = null;
    if (guildTicketConfig.category) {
      parentCategory =
        guild.channels.cache.get(guildTicketConfig.category) ||
        (await guild.channels.fetch(guildTicketConfig.category).catch(() => null));
      if (parentCategory && parentCategory.type !== ChannelType.GuildCategory) {
        parentCategory = null;
      }
    }

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentCategory ? parentCategory.id : undefined,
        topic: `Ticket #${ticketNum} | User: ${user.tag} (${user.id}) | Reason: ${reason}`,
        permissionOverwrites,
      });
    } catch (err) {
      console.error("Ticket channel create error:", err);
      return interaction.editReply({
        content: `❌ Failed to create ticket channel: ${err.message}`,
      });
    }

    // Save ticket record
    await this.client.database.ticketData.create({
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: user.id,
      ticketNumber: ticketNum,
      reason: reason,
      openedAt: new Date(),
    });

    // Send Welcome message in Ticket channel
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`🎫 Ticket #${ticketNum}`)
      .setDescription(
        `Welcome <@${user.id}>! Staff has been notified and will be with you shortly.\n` +
          `Please provide any relevant details or screenshots while you wait.\n\n` +
          `📋 **Reason:** \`${reason}\`\n` +
          `👤 **Opened by:** <@${user.id}> (\`${user.tag}\`)\n` +
          `📌 **Status:** \`Open / Unclaimed\``
      )
      .setFooter({
        text: `Synapse Tickets • Use the buttons below to manage`,
        iconURL: guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim Ticket")
        .setEmoji("🙋‍♂️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_transcript")
        .setLabel("Transcript")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary)
    );

    const pingContent = `${user} ${
      guildTicketConfig.role ? `<@&${guildTicketConfig.role}>` : ""
    }`;

    await ticketChannel.send({
      content: pingContent,
      embeds: [welcomeEmbed],
      components: [row],
    });

    return interaction.editReply({
      content: `✅ Your ticket has been created: <#${ticketChannel.id}>`,
    });
  }

  /**
   * Handle Claim Ticket button
   */
  async handleClaim(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    const guildTicketConfig = await this.client.database.guildTicketData.get(
      guild.id
    );
    const isStaffMember = await this.isStaff(member, guildTicketConfig);

    if (!isStaffMember) {
      return interaction.reply({
        content: "❌ Only support staff can claim tickets!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const ticket = await this.client.database.ticketData.getByChannel(channel.id);
    if (!ticket || ticket.closed) {
      return interaction.reply({
        content: "❌ This channel is not an active ticket!",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (ticket.claimedBy) {
      return interaction.reply({
        content: `⚠️ This ticket has already been claimed by <@${ticket.claimedBy}>!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    ticket.claimedBy = member.id;
    await this.client.database.ticketData.post(channel.id, ticket);

    // Update topic
    await channel
      .setTopic(
        `Ticket #${ticket.ticketNumber} | Claimed by ${member.user.tag} | Creator: <@${ticket.userId}>`
      )
      .catch(() => {});

    const claimEmbed = new EmbedBuilder()
      .setColor("#00ff7f")
      .setDescription(
        `🙋‍♂️ **Ticket Claimed**\n<@${member.id}> has claimed this ticket and will be assisting you!`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [claimEmbed] });
  }

  /**
   * Prompt confirmation before closing
   */
  async handleCloseRequest(interaction) {
    const channel = interaction.channel;
    const ticket = await this.client.database.ticketData.getByChannel(channel.id);

    if (!ticket || ticket.closed) {
      return interaction.reply({
        content: "❌ This channel is not an active ticket!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor("#ffcc00")
      .setTitle("🔒 Close Confirmation")
      .setDescription(
        `Are you sure you want to close **Ticket #${ticket.ticketNumber}**?\n` +
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

    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  }

  /**
   * Cancel close confirmation
   */
  async handleCloseCancel(interaction) {
    await interaction.message.delete().catch(() => {});
  }

  /**
   * Execute closing, archiving, transcript generation, DM, and channel deletion
   */
  async handleCloseConfirm(interaction) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    const ticket = await this.client.database.ticketData.getByChannel(channel.id);
    if (!ticket || ticket.closed) {
      return interaction.reply({
        content: "❌ This channel is already closed or not a ticket!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate().catch(() => {});

    // Mark as closed
    await this.client.database.ticketData.close(channel.id, interaction.user.id);

    // Disable buttons on confirmation message
    await interaction.editReply({
      components: [],
    }).catch(() => {});

    // Generate Transcript
    const transcript = await this.generateTranscript(channel, ticket);

    // Guild Ticket Config
    const guildTicketConfig = await this.client.database.guildTicketData.get(
      guild.id
    );

    // Send to Logs Channel
    if (guildTicketConfig && guildTicketConfig.logsChannel) {
      const logChannel =
        guild.channels.cache.get(guildTicketConfig.logsChannel) ||
        (await guild.channels
          .fetch(guildTicketConfig.logsChannel)
          .catch(() => null));

      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#ff3344")
          .setTitle(`📑 Ticket Closed • #${ticket.ticketNumber}`)
          .addFields(
            {
              name: "Ticket",
              value: `#${ticket.ticketNumber}`,
              inline: true,
            },
            {
              name: "Opened By",
              value: `<@${ticket.userId}> (\`${ticket.userId}\`)`,
              inline: true,
            },
            {
              name: "Closed By",
              value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
              inline: true,
            },
            {
              name: "Claimed By",
              value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "None",
              inline: true,
            },
            {
              name: "Reason",
              value: `\`${ticket.reason || "None"}\``,
              inline: false,
            },
            {
              name: "Opened",
              value: `<t:${Math.floor(
                new Date(ticket.openedAt).getTime() / 1000
              )}:R>`,
              inline: true,
            },
            {
              name: "Closed",
              value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true,
            }
          )
          .setFooter({
            text: `Server: ${guild.name}`,
            iconURL: guild.iconURL({ dynamic: true }),
          })
          .setTimestamp();

        await logChannel
          .send({
            embeds: [logEmbed],
            files: transcript ? [transcript] : [],
          })
          .catch(() => {});
      }
    }

    // Send DM to Ticket Creator
    try {
      const creator = await guild.members
        .fetch(ticket.userId)
        .catch(() => null);
      if (creator) {
        const dmEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle(`🎫 Ticket Closed • ${guild.name}`)
          .setDescription(
            `Your ticket **#${ticket.ticketNumber}** in **${guild.name}** has been closed.\n` +
              `A copy of your conversation transcript is attached below.`
          )
          .addFields(
            {
              name: "Closed By",
              value: `${interaction.user.tag}`,
              inline: true,
            },
            {
              name: "Reason",
              value: `\`${ticket.reason || "None"}\``,
              inline: true,
            }
          )
          .setTimestamp();

        await creator
          .send({
            embeds: [dmEmbed],
            files: transcript ? [transcript] : [],
          })
          .catch(() => {});
      }
    } catch {}

    // Countdown and Delete Channel
    const closingEmbed = new EmbedBuilder()
      .setColor("#ff3344")
      .setTitle("🔒 Closing Ticket")
      .setDescription("This ticket channel will be deleted in **5 seconds**...");

    await channel.send({ embeds: [closingEmbed] }).catch(() => {});

    setTimeout(async () => {
      await channel.delete("Ticket Closed").catch(() => {});
    }, 5000);
  }

  /**
   * Handle Transcript button/command
   */
  async handleTranscript(interaction) {
    const channel = interaction.channel;
    const ticket = await this.client.database.ticketData.getByChannel(channel.id);

    if (!ticket) {
      return interaction.reply({
        content: "❌ This channel is not a ticket!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();
    const transcript = await this.generateTranscript(channel, ticket);

    if (!transcript) {
      return interaction.editReply({
        content: "❌ Failed to generate transcript for this ticket.",
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`📜 Transcript • Ticket #${ticket.ticketNumber}`)
      .setDescription(`Here is the full transcript of this ticket channel.`)
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [transcript],
    });
  }

  /**
   * Generate sleek HTML transcript file
   */
  async generateTranscript(channel, ticket) {
    try {
      let messages = [];
      let lastId = null;

      // Fetch up to 200 messages safely
      for (let i = 0; i < 2; i++) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const fetched = await channel.messages.fetch(options).catch(() => null);
        if (!fetched || fetched.size === 0) break;
        messages.push(...fetched.values());
        lastId = fetched.last().id;
        if (fetched.size < 100) break;
      }

      messages.reverse();

      const guildName = channel.guild.name;
      const ticketNum = ticket?.ticketNumber || channel.name;
      const openedAt = ticket?.openedAt
        ? new Date(ticket.openedAt).toLocaleString()
        : "Unknown";

      // Build HTML
      let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transcript - ${channel.name}</title>
  <style>
    body {
      background-color: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .header {
      background: #2b2d31;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 4px solid #5865F2;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 22px;
      color: #fff;
    }
    .header p {
      margin: 4px 0;
      font-size: 14px;
      color: #949ba4;
    }
    .message {
      display: flex;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 4px;
      transition: background-color 0.1s;
    }
    .message:hover {
      background-color: #2e3035;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 14px;
      flex-shrink: 0;
    }
    .content-box {
      flex: 1;
    }
    .author-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .author-name {
      font-weight: 600;
      color: #f2f3f5;
      font-size: 15px;
      margin-right: 8px;
    }
    .bot-tag {
      background: #5865f2;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 8px;
    }
    .timestamp {
      color: #949ba4;
      font-size: 12px;
    }
    .text {
      color: #dbdee1;
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .attachments {
      margin-top: 8px;
    }
    .attachment-item {
      font-size: 13px;
      color: #00a8fc;
      text-decoration: none;
      display: block;
      margin-top: 4px;
    }
    .attachment-img {
      max-width: 400px;
      max-height: 300px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .embed {
      background: #2b2d31;
      border-left: 4px solid #5865F2;
      border-radius: 4px;
      padding: 12px;
      margin-top: 8px;
      max-width: 520px;
    }
    .embed-title {
      font-weight: 700;
      color: #fff;
      font-size: 15px;
      margin-bottom: 6px;
    }
    .embed-desc {
      font-size: 13px;
      color: #dbdee1;
      line-height: 1.4;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 ${escapeHtml(guildName)} • Ticket #${ticketNum}</h1>
    <p><strong>Channel:</strong> #${escapeHtml(channel.name)} (${channel.id})</p>
    <p><strong>Opened At:</strong> ${openedAt}</p>
    <p><strong>Total Messages:</strong> ${messages.length}</p>
  </div>
  <div class="messages">`;

      for (const msg of messages) {
        const avatarUrl =
          msg.author.displayAvatarURL({ extension: "png", size: 128 }) ||
          "https://cdn.discordapp.com/embed/avatars/0.png";
        const isBot = msg.author.bot;
        const timeStr = msg.createdAt.toLocaleString();
        const contentStr = escapeHtml(msg.cleanContent || "");

        html += `
    <div class="message">
      <img class="avatar" src="${avatarUrl}" alt="avatar" />
      <div class="content-box">
        <div class="author-line">
          <span class="author-name">${escapeHtml(msg.author.tag)}</span>
          ${isBot ? '<span class="bot-tag">BOT</span>' : ""}
          <span class="timestamp">${timeStr}</span>
        </div>
        ${contentStr ? `<div class="text">${contentStr}</div>` : ""}`;

        // Embeds
        if (msg.embeds && msg.embeds.length > 0) {
          for (const emb of msg.embeds) {
            const col = emb.hexColor || "#5865F2";
            html += `
        <div class="embed" style="border-left-color: ${col}">
          ${emb.title ? `<div class="embed-title">${escapeHtml(emb.title)}</div>` : ""}
          ${emb.description ? `<div class="embed-desc">${escapeHtml(emb.description)}</div>` : ""}
        </div>`;
          }
        }

        // Attachments
        if (msg.attachments && msg.attachments.size > 0) {
          html += `<div class="attachments">`;
          for (const [, att] of msg.attachments) {
            const isImg = att.contentType?.startsWith("image/");
            if (isImg) {
              html += `<a href="${att.url}" target="_blank"><img class="attachment-img" src="${att.url}" alt="${escapeHtml(att.name)}" /></a>`;
            } else {
              html += `<a class="attachment-item" href="${att.url}" target="_blank">📎 ${escapeHtml(att.name)}</a>`;
            }
          }
          html += `</div>`;
        }

        html += `
      </div>
    </div>`;
      }

      html += `
  </div>
</body>
</html>`;

      return new AttachmentBuilder(Buffer.from(html, "utf-8"), {
        name: `transcript-${channel.name}.html`,
      });
    } catch (err) {
      console.error("Transcript generation error:", err);
      return null;
    }
  }

  /**
   * Add user to ticket channel
   */
  async addUser(channel, member) {
    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });
  }

  /**
   * Remove user from ticket channel
   */
  async removeUser(channel, member) {
    await channel.permissionOverwrites.delete(member.id).catch(() => {});
  }
};

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
