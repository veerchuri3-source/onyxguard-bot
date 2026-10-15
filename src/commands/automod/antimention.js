const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class AntiMention extends Command {
  constructor(...args) {
    super(...args, {
      name: "antimention",
      aliases: ["mentionblock", "antimassmention"],
      description: "Protect your server against excessive user, role, and mass pings",
      usage: [
        "antimention",
        "antimention enable",
        "antimention disable",
        "antimention limit <number>",
        "antimention test",
      ],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["ManageGuild", "ModerateMembers", "EmbedLinks", "SendMessages"],
      guildOnly: true,
      options: [
        {
          type: 1,
          name: "panel",
          description: "View Anti-Mention status and control panel",
        },
        {
          type: 1,
          name: "enable",
          description: "Enable Anti-Mention AutoMod protection",
        },
        {
          type: 1,
          name: "disable",
          description: "Disable Anti-Mention AutoMod protection",
        },
        {
          type: 1,
          name: "limit",
          description: "Set maximum allowed mentions before deletion and timeout",
          options: [
            {
              type: 4,
              name: "count",
              description: "Maximum allowed mentions (default: 3)",
              required: true,
            },
          ],
        },
        {
          type: 1,
          name: "test",
          description: "Test Anti-Mention status and active configuration",
        },
      ],
    });
  }

  _buildDashboardEmbed(guild, data) {
    const isEnabled = Boolean(data?.enabled && data?.features?.antiMention !== false);
    const limit = data?.features?.mentionLimit || data?.mentionLimit || 3;
    const prefix = guild.config?.prefix || this.client.config.Client.Prefix;

    return this.client.util
      .embed()
      .setTitle(`📯 Anti-Mention Protection System — ${guild.name}`)
      .setColor(isEnabled ? "#5FFD0A" : "#FF3344")
      .setDescription(
        `Automatically detect, delete, and timeout users who send excessive user, role, or mass mentions in your server.`
      )
      .addFields(
        {
          name: "📊 Current Status",
          value: [
            `• **Protection:** ${isEnabled ? "🟢 **Active & Enabled**" : "🔴 **Disabled**"}`,
            `• **Mention Threshold:** \`${limit}\` mentions (Blocked at \`≥ ${limit}\`)`,
            `• **Punishment:** Immediate Message Deletion + 5-minute Timeout`,
            `• **Log Channel:** ${data?.logchannelid ? `<#${data.logchannelid}>` : "*None configured*"}`,
          ].join("\n"),
        },
        {
          name: "🛠️ Available Commands",
          value: [
            `• \`${prefix}antimention enable\` — Enable Anti-Mention protection`,
            `• \`${prefix}antimention disable\` — Disable Anti-Mention protection`,
            `• \`${prefix}antimention limit <number>\` — Set maximum allowed mentions`,
            `• \`${prefix}antimention test\` — Verify Anti-Mention active status`,
          ].join("\n"),
        },
        {
          name: "🛡️ What gets blocked?",
          value: "User mentions (`@User`), Role mentions (`@Role`), and Mass pings (`@everyone` / `@here`). Whitelisted users/roles are exempt.",
        }
      )
      .setFooter({
        text: "Synapse AutoMod System",
        iconURL: guild.iconURL({ dynamic: true }) || this.client.user.displayAvatarURL(),
      });
  }

  _buildButtons(isEnabled) {
    return [
      this.client.util.row().setComponents(
        this.client.util
          .button()
          .setCustomId("antimention_enable")
          .setLabel("Enable")
          .setEmoji("✅")
          .setStyle(3)
          .setDisabled(isEnabled),
        this.client.util
          .button()
          .setCustomId("antimention_disable")
          .setLabel("Disable")
          .setEmoji("❌")
          .setStyle(4)
          .setDisabled(!isEnabled),
        this.client.util
          .button()
          .setCustomId("antimention_test")
          .setLabel("Test Status")
          .setEmoji("🧪")
          .setStyle(2)
      ),
    ];
  }

  async _enableAntiMention(guild, authorId) {
    let data = (await this.client.database.autoModData.get(guild.id)) || {};
    data.enabled = true;
    if (!data.features || typeof data.features !== "object") {
      data.features = {
        antiSpam: true,
        antiCaps: true,
        antiLink: true,
        antiMention: true,
        antiWord: true,
      };
    }
    data.features.antiMention = true;
    if (!data.mentionLimit && !data.features.mentionLimit) {
      data.features.mentionLimit = 3;
      data.mentionLimit = 3;
    }

    await this.client.database.autoModData.post(guild.id, data);
    await this.client.cache.set("automod_" + guild.id, data);

    // Try to sync with native Discord AutoMod rule if server supports it
    try {
      const existingRules = await guild.autoModerationRules.fetch().catch(() => null);
      if (existingRules) {
        for (const rule of existingRules.values()) {
          if (rule.name === "Anti-Mention" || rule.name.includes("Anti Mention")) {
            await rule.delete("Updating Anti-Mention rule").catch(() => {});
          }
        }

        await guild.autoModerationRules.create({
          name: "Anti-Mention",
          creatorId: authorId || this.client.user.id,
          enabled: true,
          eventType: 1, // MESSAGE_SEND
          triggerType: 5, // MENTION_SPAM
          triggerMetadata: {
            mentionTotalLimit: data.features.mentionLimit || 3,
          },
          actions: [
            {
              type: 1, // BLOCK_MESSAGE
              metadata: {
                customMessage: "🚫 Excessive mentions are not allowed in this server.",
              },
            },
          ],
        }).catch(() => {});
      }
    } catch (e) {}

    return data;
  }

  async _disableAntiMention(guild, authorTag) {
    let data = (await this.client.database.autoModData.get(guild.id)) || {};
    if (!data.features) data.features = {};
    data.features.antiMention = false;

    await this.client.database.autoModData.post(guild.id, data);
    await this.client.cache.set("automod_" + guild.id, data);

    try {
      const rules = await guild.autoModerationRules.fetch().catch(() => null);
      if (rules) {
        const existingRule = rules.find((r) => r.name === "Anti-Mention" || r.name.includes("Anti Mention"));
        if (existingRule) {
          await existingRule.delete(`Disabled by ${authorTag}`).catch(() => {});
        }
      }
    } catch (e) {}

    return data;
  }

  async run({ message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You need **Administrator** permissions to use this command.");
    }

    const sub = args[0]?.toLowerCase();
    const data = await this.client.database.autoModData.get(message.guild.id);
    const isEnabled = Boolean(data?.enabled && data?.features?.antiMention !== false);

    if (!sub || sub === "panel" || sub === "status" || sub === "menu") {
      const embed = this._buildDashboardEmbed(message.guild, data);
      const components = this._buildButtons(isEnabled);
      const msg = await message.reply({ embeds: [embed], components });

      const filter = (i) => i.user.id === message.author.id;
      const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async (i) => {
        if (i.customId === "antimention_enable") {
          await i.deferUpdate().catch(() => {});
          const updated = await this._enableAntiMention(message.guild, message.author.id);
          await msg.edit({
            embeds: [this._buildDashboardEmbed(message.guild, updated)],
            components: this._buildButtons(true),
          }).catch(() => {});
          message.channel.send("✅ **Anti-Mention** protection has been enabled successfully!").then((m) => {
            setTimeout(() => m.delete().catch(() => {}), 5000);
          });
        } else if (i.customId === "antimention_disable") {
          await i.deferUpdate().catch(() => {});
          const updated = await this._disableAntiMention(message.guild, message.author.tag);
          await msg.edit({
            embeds: [this._buildDashboardEmbed(message.guild, updated)],
            components: this._buildButtons(false),
          }).catch(() => {});
          message.channel.send("❌ **Anti-Mention** protection has been disabled.").then((m) => {
            setTimeout(() => m.delete().catch(() => {}), 5000);
          });
        } else if (i.customId === "antimention_test") {
          await i.deferUpdate().catch(() => {});
          const current = (await this.client.database.autoModData.get(message.guild.id)) || {};
          const active = Boolean(current.enabled && current.features?.antiMention !== false);
          const limit = current.features?.mentionLimit || current.mentionLimit || 3;
          message.channel.send(
            active
              ? `🧪 **Anti-Mention Status:** Active (Limit: \`≥ ${limit}\` mentions will be blocked & timed out).`
              : "⚠️ **Anti-Mention Status:** Currently **Disabled**! Use `antimention enable` to activate."
          );
        }
      });
      return;
    }

    if (sub === "enable" || sub === "on") {
      const updated = await this._enableAntiMention(message.guild, message.author.id);
      const limit = updated.features?.mentionLimit || updated.mentionLimit || 3;
      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setTitle("✅ Anti-Mention Protection Enabled")
        .setDescription(`**Anti-Mention** rule is now active!\nAny user sending **${limit} or more mentions** will have their message deleted and receive a 5-minute timeout.`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (sub === "disable" || sub === "off") {
      await this._disableAntiMention(message.guild, message.author.tag);
      const embed = new EmbedBuilder()
        .setColor("#FF3344")
        .setTitle("❌ Anti-Mention Protection Disabled")
        .setDescription("**Anti-Mention** rule has been deactivated.")
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (sub === "limit" || sub === "threshold") {
      const newLimit = parseInt(args[1]);
      if (isNaN(newLimit) || newLimit < 1 || newLimit > 20) {
        return message.reply("❌ Please provide a valid mention limit between **1** and **20**! Example: `antimention limit 3`");
      }
      let curData = (await this.client.database.autoModData.get(message.guild.id)) || {};
      if (!curData.features) curData.features = {};
      curData.features.mentionLimit = newLimit;
      curData.mentionLimit = newLimit;
      await this.client.database.autoModData.post(message.guild.id, curData);
      await this.client.cache.set("automod_" + message.guild.id, curData);

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setTitle("⚙️ Mention Limit Updated")
        .setDescription(`Maximum allowed mentions set to **${newLimit}**.\nMessages with **${newLimit} or more mentions** will be blocked.`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (sub === "test") {
      const curData = (await this.client.database.autoModData.get(message.guild.id)) || {};
      const active = Boolean(curData.enabled && curData.features?.antiMention !== false);
      const limit = curData.features?.mentionLimit || curData.mentionLimit || 3;
      const embed = new EmbedBuilder()
        .setColor(active ? "#5FFD0A" : "#FF3344")
        .setTitle("🧪 Anti-Mention Diagnostics")
        .setDescription(
          active
            ? `🟢 **Active!** Server is protected against mention spam.\n• **Threshold:** \`≥ ${limit}\` mentions\n• **Action:** Message Deletion + 5-minute Timeout`
            : "🔴 **Inactive!** Anti-Mention is currently disabled. Use `antimention enable` to turn it on."
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    return message.reply({
      embeds: [this._buildDashboardEmbed(message.guild, data)],
      components: this._buildButtons(isEnabled),
    });
  }

  async exec({ interaction }) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ You need **Administrator** permissions to use this command.",
        ephemeral: true,
      });
    }

    const sub = interaction.options?.getSubcommand(false) || "panel";
    const data = await this.client.database.autoModData.get(interaction.guild.id);
    const isEnabled = Boolean(data?.enabled && data?.features?.antiMention !== false);

    if (sub === "panel") {
      return interaction.reply({
        embeds: [this._buildDashboardEmbed(interaction.guild, data)],
        components: this._buildButtons(isEnabled),
      });
    }

    if (sub === "enable") {
      const updated = await this._enableAntiMention(interaction.guild, interaction.user.id);
      const limit = updated.features?.mentionLimit || updated.mentionLimit || 3;
      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setTitle("✅ Anti-Mention Protection Enabled")
        .setDescription(`**Anti-Mention** rule is now active!\nAny user sending **${limit} or more mentions** will have their message deleted and receive a 5-minute timeout.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "disable") {
      await this._disableAntiMention(interaction.guild, interaction.user.tag);
      const embed = new EmbedBuilder()
        .setColor("#FF3344")
        .setTitle("❌ Anti-Mention Protection Disabled")
        .setDescription("**Anti-Mention** rule has been deactivated.")
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "limit") {
      const newLimit = interaction.options.getInteger("count");
      if (newLimit < 1 || newLimit > 20) {
        return interaction.reply({ content: "❌ Limit must be between 1 and 20.", ephemeral: true });
      }
      let curData = (await this.client.database.autoModData.get(interaction.guild.id)) || {};
      if (!curData.features) curData.features = {};
      curData.features.mentionLimit = newLimit;
      curData.mentionLimit = newLimit;
      await this.client.database.autoModData.post(interaction.guild.id, curData);
      await this.client.cache.set("automod_" + interaction.guild.id, curData);

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setTitle("⚙️ Mention Limit Updated")
        .setDescription(`Maximum allowed mentions set to **${newLimit}**.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "test") {
      const curData = (await this.client.database.autoModData.get(interaction.guild.id)) || {};
      const active = Boolean(curData.enabled && curData.features?.antiMention !== false);
      const limit = curData.features?.mentionLimit || curData.mentionLimit || 3;
      const embed = new EmbedBuilder()
        .setColor(active ? "#5FFD0A" : "#FF3344")
        .setTitle("🧪 Anti-Mention Diagnostics")
        .setDescription(
          active
            ? `🟢 **Active!** Server is protected against mention spam.\n• **Threshold:** \`≥ ${limit}\` mentions`
            : "🔴 **Inactive!** Anti-Mention is currently disabled."
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  }
};
