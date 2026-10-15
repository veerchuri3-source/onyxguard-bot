/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Parser = require("rss-parser");
const parser = new Parser();
const Command = require("../../abstract/command");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionsBitField,
} = require("discord.js");

/**
 * Resolves any YouTube URL, handle (@name), or Channel ID into a 24-char UC channel ID
 */
async function resolveChannelId(input) {
  if (!input || typeof input !== "string") return null;
  let cleaned = input.trim();

  // 1. Direct Channel ID (UC...)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(cleaned)) {
    return cleaned;
  }

  // 2. Standard Channel URL (/channel/UC...)
  const channelMatch = cleaned.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelMatch) return channelMatch[1];

  // 3. Handle or custom URL (@handle, youtube.com/@handle, youtube.com/c/...)
  let url = cleaned;
  if (cleaned.startsWith("@")) {
    url = `https://www.youtube.com/${cleaned}`;
  } else if (!cleaned.startsWith("http")) {
    url = `https://www.youtube.com/@${cleaned}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    const match =
      html.match(/"channelId":\s*"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/itemprop="channelId"\s+content="(UC[a-zA-Z0-9_-]{22})"/);
    if (match) return match[1];

    const canonicalMatch = html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (canonicalMatch) return canonicalMatch[1];
  } catch (e) {
    console.error("YouTube URL resolve error:", e.message);
  }
  return null;
}

module.exports = class YoutubeNotificationCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "ytnotifier",
      aliases: [
        "youtube",
        "yt",
        "ytnotification",
        "ytchannel",
        "ytchannelnotifier",
        "ytnotify",
      ],
      description:
        "Configure and manage YouTube channel upload notifications for your server",
      usage: [
        "youtube",
        "youtube enable <url/handle> <#channel> [everyone: true/false]",
        "youtube disable",
        "youtube status",
        "youtube test",
      ],
      category: "Utilities",
      examples: [
        "youtube",
        "youtube enable https://www.youtube.com/@MrBeast #announcements true",
        "youtube disable",
        "youtube test",
      ],
      userPerms: ["Administrator"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
      cooldown: 5,
      image: "https://imgur.com/iEZrusL",
      options: [
        {
          type: 1,
          name: "enable",
          description: "Enable YouTube upload notifications for a channel",
          options: [
            {
              name: "link",
              description: "YouTube channel URL, handle (@name), or Channel ID",
              type: 3,
              required: true,
            },
            {
              name: "channel",
              description: "The text channel to send notifications in",
              type: 7,
              required: true,
            },
            {
              name: "everyone",
              description:
                "Whether to ping @everyone on new upload (default: false)",
              type: 5,
              required: false,
            },
          ],
        },
        {
          type: 1,
          name: "disable",
          description: "Disable YouTube upload notifications for this server",
        },
        {
          type: 1,
          name: "status",
          description: "Check the current YouTube notification settings",
        },
        {
          type: 1,
          name: "test",
          description: "Send a test notification to the configured channel",
        },
      ],
    });
  }

  _buildDashboardEmbed(guild, guildData) {
    const isConfigured = Boolean(guildData && guildData.ytchannel && guildData.channel);
    const prefix = guild.config?.prefix || this.client.config.Client.Prefix || "!";

    const embed = new EmbedBuilder()
      .setColor(this.client.config.Client.PrimaryColor || "#FF0000")
      .setTitle(`📺 YouTube Upload Notifier — ${guild.name}`)
      .setDescription(
        "Receive instant Discord alerts whenever your favorite YouTube channel uploads a new video!"
      )
      .addFields(
        {
          name: "📊 Current Configuration",
          value: [
            `• **Status:** ${isConfigured ? "🟢 **Active & Enabled**" : "🔴 **Disabled / Not Configured**"}`,
            `• **YouTube Channel ID:** ${isConfigured ? `\`${guildData.ytchannel}\`` : "*None*"}`,
            `• **Notification Channel:** ${isConfigured ? `<#${guildData.channel}>` : "*None*"}`,
            `• **Ping Everyone:** ${isConfigured ? (guildData.ping ? "🔔 `@everyone`" : "🔕 `No ping`") : "*N/A*"}`,
          ].join("\n"),
        },
        {
          name: "🛠️ Quick Commands",
          value: [
            `• \`${prefix}youtube enable <url/handle> <#channel> [true/false]\` — Quick setup`,
            `• \`${prefix}youtube disable\` — Turn off notifications`,
            `• \`${prefix}youtube test\` — Send a test notification to the channel`,
            `• \`${prefix}youtube status\` — View current configuration`,
          ].join("\n"),
        }
      )
      .setFooter({
        text: "Synapse YouTube Notifier",
        iconURL: guild.iconURL({ dynamic: true }) || this.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    return embed;
  }

  _buildDashboardButtons(isConfigured) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("yt_btn_enable")
        .setLabel(isConfigured ? "Reconfigure Channel" : "Enable Notifier")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("yt_btn_test")
        .setLabel("Test Notifier")
        .setEmoji("🧪")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!isConfigured),
      new ButtonBuilder()
        .setCustomId("yt_btn_disable")
        .setLabel("Disable")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isConfigured)
    );
    return [row];
  }

  async run({ message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You need **Administrator** permissions to manage YouTube notifications.");
    }

    let guildData = (await this.client.database.ytData.get(message.guild.id)) || {};
    const sub = args[0]?.toLowerCase();

    // 1. DISABLE
    if (sub === "disable" || sub === "off") {
      guildData.ytchannel = null;
      guildData.channel = null;
      guildData.ping = false;
      await this.client.database.ytData.post(message.guild.id, guildData);

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription("✅ YouTube upload notifications have been **disabled** for this server.");
      return message.channel.send({ embeds: [embed] });
    }

    // 2. STATUS
    if (sub === "status" || sub === "config") {
      const embed = this._buildDashboardEmbed(message.guild, guildData);
      return message.channel.send({ embeds: [embed] });
    }

    // 3. TEST
    if (sub === "test") {
      if (!guildData.ytchannel || !guildData.channel) {
        return message.reply("❌ YouTube notifications have not been configured yet! Run `youtube enable <url> <#channel>` first.");
      }
      const channel = message.guild.channels.cache.get(guildData.channel) || await message.guild.channels.fetch(guildData.channel).catch(() => null);
      if (!channel) {
        return message.reply("❌ Could not find the configured notification channel. Please reconfigure it.");
      }

      const feed = await parser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${guildData.ytchannel}`
      ).catch(() => null);

      if (!feed?.items?.length) {
        return message.reply("❌ Could not fetch videos from the configured YouTube channel.");
      }

      const latestItem = feed.items[0];
      const author = latestItem.author || feed.title || "YouTube Creator";
      const title = latestItem.title || "New Video";
      const link = latestItem.link || `https://www.youtube.com/watch?v=${(latestItem.id || "").replace("yt:video:", "")}`;
      const pingText = guildData.ping ? "@everyone" : "Hey everyone";

      const testMsg = `🧪 **[TEST NOTIFICATION]** ${pingText}, **${author}** just uploaded a new video! | **${title}**\n${link}`;
      await channel.send({ content: testMsg }).catch((err) => {
        return message.reply(`❌ Failed to send message to <#${guildData.channel}>. Check bot permissions.`);
      });

      return message.reply(`✅ Sent test notification to <#${guildData.channel}>!`);
    }

    // 4. DIRECT ENABLE (via arguments: youtube enable <link> <#channel> [everyone])
    if (sub === "enable" || sub === "set" || (args[0] && (args[0].startsWith("http") || args[0].startsWith("@") || args[0].startsWith("UC")))) {
      const linkArg = (sub === "enable" || sub === "set") ? args[1] : args[0];
      const channelArg = (sub === "enable" || sub === "set") ? args[2] : args[1];
      const pingArg = (sub === "enable" || sub === "set") ? args[3] : args[2];

      if (!linkArg || !channelArg) {
        return message.reply(
          `❌ **Usage:** \`${message.guild.config?.prefix || "!"}youtube enable <YouTube URL / @Handle> <#channel> [everyone: true/false]\``
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(channelArg) ||
        message.guild.channels.cache.find(
          (c) => c.name.toLowerCase() === channelArg.toLowerCase()
        );

      if (!channel || !channel.isTextBased()) {
        return message.reply("❌ Please mention or specify a valid text channel.");
      }

      const statusMsg = await message.reply("🔍 Resolving YouTube channel...");
      const channelId = await resolveChannelId(linkArg);
      if (!channelId) {
        return statusMsg.edit("❌ Could not resolve YouTube channel ID. Please provide a valid channel URL or handle (e.g. `https://www.youtube.com/@MrBeast`).");
      }

      const feed = await parser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      ).catch(() => null);

      if (!feed || !feed.title) {
        return statusMsg.edit("❌ Failed to fetch YouTube RSS feed. Please check that the channel exists and has public videos.");
      }

      const shouldPing = pingArg ? ["true", "yes", "1", "everyone", "ping"].includes(pingArg.toLowerCase()) : false;
      const latestVideoId = feed.items?.[0]?.id || feed.items?.[0]?.link;

      guildData.ytchannel = channelId;
      guildData.channel = channel.id;
      guildData.ping = shouldPing;
      guildData.postedvids = latestVideoId ? [latestVideoId] : [];
      await this.client.database.ytData.post(message.guild.id, guildData);

      const successEmbed = new EmbedBuilder()
        .setColor("#00ff7f")
        .setTitle("✅ YouTube Notifier Configured Successfully!")
        .setDescription(
          `Upload notifications for **${feed.title}** are now active on this server!\n\n` +
            `• **YouTube Channel:** [${feed.title}](https://www.youtube.com/channel/${channelId}) (\`${channelId}\`)\n` +
            `• **Alert Channel:** <#${channel.id}>\n` +
            `• **Ping Everyone:** ${shouldPing ? "🔔 `@everyone`" : "🔕 `Disabled`"}\n` +
            `• **Latest Video:** [${feed.items?.[0]?.title || "None"}](${feed.items?.[0]?.link || "#"})\n\n` +
            `*Run \`${message.guild.config?.prefix || "!"}youtube test\` to verify.*`
        )
        .setTimestamp();

      return statusMsg.edit({ content: null, embeds: [successEmbed] });
    }

    // 5. INTERACTIVE DASHBOARD (Default when no or unknown arguments)
    const isConfigured = Boolean(guildData.ytchannel && guildData.channel);
    const dashboardEmbed = this._buildDashboardEmbed(message.guild, guildData);
    const components = this._buildDashboardButtons(isConfigured);

    const msg = await message.reply({ embeds: [dashboardEmbed], components });
    const filter = (i) => i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 90000 });

    collector.on("collect", async (i) => {
      if (i.customId === "yt_btn_disable") {
        await i.deferUpdate().catch(() => {});
        guildData.ytchannel = null;
        guildData.channel = null;
        guildData.ping = false;
        await this.client.database.ytData.post(message.guild.id, guildData);

        const updatedEmbed = this._buildDashboardEmbed(message.guild, guildData);
        await msg.edit({
          embeds: [updatedEmbed],
          components: this._buildDashboardButtons(false),
        }).catch(() => {});
        message.channel.send("✅ YouTube notifications have been **disabled**.");
        return;
      }

      if (i.customId === "yt_btn_test") {
        await i.deferUpdate().catch(() => {});
        if (!guildData.ytchannel || !guildData.channel) {
          return message.channel.send("❌ YouTube notifications have not been configured yet.");
        }
        const ch = message.guild.channels.cache.get(guildData.channel) || await message.guild.channels.fetch(guildData.channel).catch(() => null);
        if (!ch) return message.channel.send("❌ Configured notification channel not found.");

        const feed = await parser.parseURL(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${guildData.ytchannel}`
        ).catch(() => null);

        if (!feed?.items?.length) return message.channel.send("❌ Could not fetch videos from YouTube channel.");
        const latestItem = feed.items[0];
        const pingText = guildData.ping ? "@everyone" : "Hey everyone";
        const author = latestItem.author || feed.title || "YouTube Creator";
        const title = latestItem.title || "New Video";
        const link = latestItem.link || `https://www.youtube.com/watch?v=${(latestItem.id || "").replace("yt:video:", "")}`;

        await ch.send(`🧪 **[TEST NOTIFICATION]** ${pingText}, **${author}** just uploaded a new video! | **${title}**\n${link}`).catch(() => {});
        message.channel.send(`✅ Sent test notification to <#${guildData.channel}>!`);
        return;
      }

      if (i.customId === "yt_btn_enable") {
        await i.reply({
          content: `To set up YouTube notifications, use:\n\`${message.guild.config?.prefix || "!"}youtube enable <URL / @Handle> <#channel> [everyone: true/false]\`\n\n*Example:* \`${message.guild.config?.prefix || "!"}youtube enable https://www.youtube.com/@MrBeast <#${message.channel.id}> true\``,
          ephemeral: true,
        });
      }
    });

    collector.on("end", async () => {
      // Clean up components on timeout
      msg.edit({ components: [] }).catch(() => {});
    });
  }

  async exec({ interaction }) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ You need **Administrator** permissions to manage YouTube notifications.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    let guildData = (await this.client.database.ytData.get(interaction.guild.id)) || {};

    if (sub === "status") {
      const embed = this._buildDashboardEmbed(interaction.guild, guildData);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "disable") {
      guildData.ytchannel = null;
      guildData.channel = null;
      guildData.ping = false;
      await this.client.database.ytData.post(interaction.guild.id, guildData);
      return interaction.reply("✅ YouTube notifications have been **disabled** for this server.");
    }

    if (sub === "test") {
      if (!guildData.ytchannel || !guildData.channel) {
        return interaction.reply({
          content: "❌ YouTube notifications are not currently configured for this server.",
          ephemeral: true,
        });
      }
      await interaction.deferReply();
      const channel = interaction.guild.channels.cache.get(guildData.channel) || await interaction.guild.channels.fetch(guildData.channel).catch(() => null);
      if (!channel) {
        return interaction.editReply("❌ Could not find the configured notification channel.");
      }

      const feed = await parser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${guildData.ytchannel}`
      ).catch(() => null);

      if (!feed?.items?.length) {
        return interaction.editReply("❌ Could not fetch videos from the configured YouTube channel.");
      }

      const latestItem = feed.items[0];
      const author = latestItem.author || feed.title || "YouTube Creator";
      const title = latestItem.title || "New Video";
      const link = latestItem.link || `https://www.youtube.com/watch?v=${(latestItem.id || "").replace("yt:video:", "")}`;
      const pingText = guildData.ping ? "@everyone" : "Hey everyone";

      await channel.send(`🧪 **[TEST NOTIFICATION]** ${pingText}, **${author}** just uploaded a new video! | **${title}**\n${link}`).catch(() => {});
      return interaction.editReply(`✅ Sent test notification to <#${guildData.channel}>!`);
    }

    if (sub === "enable") {
      const linkArg = interaction.options.getString("link");
      const channel = interaction.options.getChannel("channel");
      const shouldPing = interaction.options.getBoolean("everyone") ?? false;

      await interaction.deferReply();

      const channelId = await resolveChannelId(linkArg);
      if (!channelId) {
        return interaction.editReply("❌ Could not resolve YouTube channel ID. Please provide a valid channel URL or handle (e.g. `https://www.youtube.com/@MrBeast`).");
      }

      const feed = await parser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      ).catch(() => null);

      if (!feed || !feed.title) {
        return interaction.editReply("❌ Failed to fetch YouTube RSS feed. Please check that the channel exists and has public videos.");
      }

      const latestVideoId = feed.items?.[0]?.id || feed.items?.[0]?.link;

      guildData.ytchannel = channelId;
      guildData.channel = channel.id;
      guildData.ping = shouldPing;
      guildData.postedvids = latestVideoId ? [latestVideoId] : [];
      await this.client.database.ytData.post(interaction.guild.id, guildData);

      const successEmbed = new EmbedBuilder()
        .setColor("#00ff7f")
        .setTitle("✅ YouTube Notifier Configured Successfully!")
        .setDescription(
          `Upload notifications for **${feed.title}** are now active on this server!\n\n` +
            `• **YouTube Channel:** [${feed.title}](https://www.youtube.com/channel/${channelId}) (\`${channelId}\`)\n` +
            `• **Alert Channel:** <#${channel.id}>\n` +
            `• **Ping Everyone:** ${shouldPing ? "🔔 `@everyone`" : "🔕 `Disabled`"}\n` +
            `• **Latest Video:** [${feed.items?.[0]?.title || "None"}](${feed.items?.[0]?.link || "#"})\n\n` +
            `*Run \`/ytnotifier test\` to verify.*`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    }
  }
};
