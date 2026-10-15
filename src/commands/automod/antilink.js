const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class AntiLink extends Command {
  constructor(...args) {
    super(...args, {
      name: "antilink",
      aliases: ["linkblock"],
      description:
        "Create or disable Anti-Link AutoMod rule with a custom block message",
      usage: ["antilink enable", "antilink disable"],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["ManageGuild"],
      guildOnly: true,
      options: [
        {
          type: 1,
          name: "enable",
          description: "Enable Anti-Link AutoMod rule",
        },
        {
          type: 1,
          name: "disable",
          description: "Disable Anti-Link AutoMod rule",
        },
      ],
    });
  }

  async run({ message, args }) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "❌ You need **Administrator** permissions to use this command."
      );
    }

    const sub = args[0]?.toLowerCase();
    let data = await this.client.database.autoModData.get(message.guild.id);
    if (!data) data = { id: message.guild.id, features: {} };
    if (!data.features) data.features = {};

    if (sub === "disable") {
      try {
        data.features.antiLink = false;
        await this.client.database.autoModData.post(message.guild.id, data);
        await this.client.cache.set("automod_" + message.guild.id, data);

        const rules = await message.guild.autoModerationRules.fetch().catch(() => null);
        if (rules && rules.size > 0) {
          for (const rule of rules.values()) {
            const rName = rule.name.toLowerCase();
            if (
              rName.includes("anti-link") ||
              rName.includes("anti link") ||
              rName.includes("link block") ||
              (rName.includes("link") && rule.creatorId === this.client.user?.id)
            ) {
              await rule.delete(`Disabled by ${message.author.tag}`).catch(() => {});
            }
          }
        }
        const embed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription("✅ **Anti-Link** protection and AutoMod rules have been successfully **disabled**!");
        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.channel.send("❌ Failed to disable **Anti-Link** rule.");
      }
    }

    try {
      data.features.antiLink = true;
      await this.client.database.autoModData.post(message.guild.id, data);
      await this.client.cache.set("automod_" + message.guild.id, data);

      const existingRules = await message.guild.autoModerationRules.fetch().catch(() => null);
      if (existingRules) {
        for (const rule of existingRules.values()) {
          const rName = rule.name.toLowerCase();
          if (
            rName.includes("anti-link") ||
            rName.includes("anti link") ||
            rName.includes("link block") ||
            (rName.includes("link") && rule.creatorId === this.client.user?.id)
          ) {
            await rule.delete("Replacing existing Anti-Link rule").catch(() => {});
          }
        }
      }

      await message.guild.autoModerationRules.create({
        name: "Anti-Link",
        creatorId: message.author.id,
        enabled: true,
        eventType: 1, // MESSAGE_SEND
        triggerType: 1, // KEYWORD
        triggerMetadata: {
          keywordFilter: ["*discord.gg*", "*discord.com/invite*", "*http://*", "*https://*", "*www.*"],
        },
        actions: [
          {
            type: 1, // BLOCK_MESSAGE
            metadata: {
              customMessage:
                "🚫 Links are not allowed here! Please avoid posting links.",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription("✅ **Anti-Link** rule enabled successfully!");
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.channel.send(
        "❌ Failed to create **Anti-Link** rule. Check my permissions and try again."
      );
    }
  }

  async exec({ interaction }) {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content:
          "❌ You need **Administrator** permissions to use this command.",
        ephemeral: true,
      });
    }

    const sub = interaction.options?.getSubcommand(false) || "enable";
    let data = await this.client.database.autoModData.get(interaction.guild.id);
    if (!data) data = { id: interaction.guild.id, features: {} };
    if (!data.features) data.features = {};

    if (sub === "disable") {
      try {
        data.features.antiLink = false;
        await this.client.database.autoModData.post(interaction.guild.id, data);
        await this.client.cache.set("automod_" + interaction.guild.id, data);

        const rules = await interaction.guild.autoModerationRules.fetch().catch(() => null);
        if (rules && rules.size > 0) {
          for (const rule of rules.values()) {
            const rName = rule.name.toLowerCase();
            if (
              rName.includes("anti-link") ||
              rName.includes("anti link") ||
              rName.includes("link block") ||
              (rName.includes("link") && rule.creatorId === this.client.user?.id)
            ) {
              await rule.delete(`Disabled by ${interaction.user.tag}`).catch(() => {});
            }
          }
        }
        const embed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription("✅ **Anti-Link** protection and AutoMod rules have been successfully **disabled**!");
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "❌ Failed to disable **Anti-Link** rule.",
          ephemeral: true,
        });
      }
    }

    try {
      data.features.antiLink = true;
      await this.client.database.autoModData.post(interaction.guild.id, data);
      await this.client.cache.set("automod_" + interaction.guild.id, data);

      const existingRules = await interaction.guild.autoModerationRules.fetch().catch(() => null);
      if (existingRules) {
        for (const rule of existingRules.values()) {
          const rName = rule.name.toLowerCase();
          if (
            rName.includes("anti-link") ||
            rName.includes("anti link") ||
            rName.includes("link block") ||
            (rName.includes("link") && rule.creatorId === this.client.user?.id)
          ) {
            await rule.delete("Replacing existing Anti-Link rule").catch(() => {});
          }
        }
      }

      await interaction.guild.autoModerationRules.create({
        name: "Anti-Link",
        creatorId: interaction.user.id,
        enabled: true,
        eventType: 1,
        triggerType: 1,
        triggerMetadata: {
          keywordFilter: ["*discord.gg*", "*discord.com/invite*", "*http://*", "*https://*", "*www.*"],
        },
        actions: [
          {
            type: 1,
            metadata: {
              customMessage:
                "🚫 Links are not allowed here! Please avoid posting links.",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription("✅ **Anti-Link** rule enabled successfully!");
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content:
          "❌ Failed to create **Anti-Link** rule. Check my permissions and try again.",
        ephemeral: true,
      });
    }
  }
};
