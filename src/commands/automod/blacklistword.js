const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class BlacklistWord extends Command {
  constructor(...args) {
    super(...args, {
      name: "blacklistword",
      aliases: ["badwordblock"],
      description:
        "Create or disable Blacklist Words AutoMod rule with a custom block message",
      usage: ["blacklistword enable", "blacklistword disable"],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["ManageGuild"],
      guildOnly: true,
      options: [
        {
          type: 1,
          name: "enable",
          description: "Enable Blacklist Words AutoMod rule",
        },
        {
          type: 1,
          name: "disable",
          description: "Disable Blacklist Words AutoMod rule",
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

    const sub = args?.[0]?.toLowerCase();
    const data = await this.client.database.autoModData.get(message.guild.id);

    if (sub === "disable") {
      try {
        data.features.antiWord = false;
        await this.client.database.autoModData.post(message.guild.id, data);
        await this.client.cache.set("automod_" + message.guild.id, data);

        const rules = await message.guild.autoModerationRules.fetch();
        const existingRule = rules.find((r) => r.name === "Blacklist Words" || r.name.includes("Bad Words"));
        if (existingRule) {
          await existingRule.delete(`Disabled by ${message.author.tag}`).catch(() => {});
        }
        const embed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription("✅ **Blacklist Words** rule disabled successfully!");
        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.channel.send("❌ Failed to disable **Blacklist Words** rule.");
      }
    }

    if (!data.enabled) {
      return message.reply("❌ AutoMod is currently disabled! AutoMod protections can only be activated via `automod enable`.");
    }

    // List of blocked words
    const blockedWords = [
      "fuck",
      "shit",
      "bitch",
      "asshole",
      "dick",
      "piss",
      "bastard",
      "damn",
      "cunt",
      "faggot",
      "slut",
      "whore",
      "nigger",
      "fucker",
      "motherfucker",
      "cock",
      "penis",
      "vagina",
      "douche",
      "twat",
      "arsehole",
      "prick",
    ];

    try {
      const existingRules = await message.guild.autoModerationRules.fetch();
      for (const rule of existingRules.values()) {
        if (rule.name === "Blacklist Words") {
          await rule.delete("Replacing existing Blacklist Words rule").catch(() => {});
        }
      }

      await message.guild.autoModerationRules.create({
        name: "Blacklist Words",
        creatorId: message.author.id,
        enabled: true,
        eventType: 1, // MESSAGE_SEND
        triggerType: 1, // KEYWORD
        triggerMetadata: {
          keywordFilter: blockedWords,
        },
        actions: [
          {
            type: 1, // BLOCK_MESSAGE
            metadata: {
              customMessage: "❌ That word is not allowed!",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription(
          `✅ **Blacklist Words** rule enabled successfully!\n\n**Blocked words count:** ${blockedWords.length}`
        );

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.channel.send(
        "❌ Failed to create **Blacklist Words** rule. Check my permissions and try again."
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

    if (sub === "disable") {
      try {
        const rules = await interaction.guild.autoModerationRules.fetch();
        const existingRule = rules.find((r) => r.name === "Blacklist Words");
        if (!existingRule) {
          return interaction.reply({
            content: "❌ **Blacklist Words** rule is not currently active.",
            ephemeral: true,
          });
        }
        await existingRule.delete(`Disabled by ${interaction.user.tag}`);
        const embed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription("✅ **Blacklist Words** rule disabled successfully!");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "❌ Failed to disable **Blacklist Words** rule.",
          ephemeral: true,
        });
      }
    }

    const blockedWords = [
      "fuck",
      "shit",
      "bitch",
      "asshole",
      "dick",
      "piss",
      "bastard",
      "damn",
      "cunt",
      "faggot",
      "slut",
      "whore",
      "nigger",
      "fucker",
      "motherfucker",
      "cock",
      "penis",
      "vagina",
      "douche",
      "twat",
      "arsehole",
      "prick",
    ];

    try {
      const existingRules = await interaction.guild.autoModerationRules.fetch();
      for (const rule of existingRules.values()) {
        if (rule.name === "Blacklist Words") {
          await rule.delete("Replacing existing Blacklist Words rule").catch(() => {});
        }
      }

      await interaction.guild.autoModerationRules.create({
        name: "Blacklist Words",
        creatorId: interaction.user.id,
        enabled: true,
        eventType: 1,
        triggerType: 1,
        triggerMetadata: {
          keywordFilter: blockedWords,
        },
        actions: [
          {
            type: 1,
            metadata: {
              customMessage: "❌ That word is not allowed!",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription(
          `✅ **Blacklist Words** rule enabled successfully!\n\n**Blocked words count:** ${blockedWords.length}`
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content:
          "❌ Failed to create **Blacklist Words** rule. Check my permissions and try again.",
        ephemeral: true,
      });
    }
  }
};
