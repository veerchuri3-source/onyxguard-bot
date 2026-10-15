const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class AntiCaps extends Command {
  constructor(...args) {
    super(...args, {
      name: "anticaps",
      aliases: ["capsblock", "anticap"],
      description: "Enable or disable Anti-Caps AutoMod protection against excessive capital letters",
      usage: ["anticaps enable", "anticaps disable"],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["ManageMessages", "EmbedLinks", "SendMessages"],
      guildOnly: true,
      options: [
        {
          type: 1,
          name: "enable",
          description: "Enable Anti-Caps AutoMod rule",
        },
        {
          type: 1,
          name: "disable",
          description: "Disable Anti-Caps AutoMod rule",
        },
      ],
    });
  }

  async run({ message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You need **Administrator** permissions to use this command.");
    }

    const prefix = message.guild?.config?.prefix || this.client.config?.Client?.Prefix || "$";
    const sub = args[0]?.toLowerCase();
    let data = await this.client.database.autoModData.get(message.guild.id);
    if (!data) data = { id: message.guild.id, features: {} };
    if (!data.features) data.features = {};

    if (sub === "disable") {
      try {
        data.features.antiCaps = false;
        await this.client.database.autoModData.post(message.guild.id, data);
        await this.client.cache.set("automod_" + message.guild.id, data);

        const embed = new EmbedBuilder()
          .setColor("#FF1744")
          .setTitle("Hey , I'm OnyxGuard™")
          .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
            `• **System:** Anti Caps Protection\n` +
            `• **Status:** \`Disabled 🔴\`\n` +
            `• **Notice:** Members can now send messages with capital letters freely.\n\n` +
            `**Quick Command:** \`${prefix}anticaps enable\` to re-enable.`
          )
          .setFooter({
            text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
            iconURL: this.client.user?.displayAvatarURL(),
          });
        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.channel.send("❌ Failed to disable **Anti-Caps** rule.");
      }
    }

    if (sub === "enable") {
      try {
        data.enabled = true;
        data.features.antiCaps = true;
        await this.client.database.autoModData.post(message.guild.id, data);
        await this.client.cache.set("automod_" + message.guild.id, data);

        const embed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("Hey , I'm OnyxGuard™")
          .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
            `• **System:** Anti Caps Protection\n` +
            `• **Status:** \`Active & Enforcing 🟢\`\n` +
            `• **Notice:** Messages with excessive capital letters (≥70% caps) will be automatically deleted.\n\n` +
            `**Quick Command:** \`${prefix}anticaps disable\` to turn off.`
          )
          .setFooter({
            text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
            iconURL: this.client.user?.displayAvatarURL(),
          });
        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.channel.send("❌ Failed to enable **Anti-Caps** rule.");
      }
    }

    // Default / Help message with prefix
    const isCurrentlyActive = Boolean(data.enabled && data.features.antiCaps !== false);
    const infoEmbed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
        `• **Anti-Caps Status:** ${isCurrentlyActive ? "`Active 🟢`" : "`Disabled 🔴`"}\n` +
        `• **Description:** Automatically deletes messages containing excessive uppercase letters.\n\n` +
        `• **Usage:**\n` +
        `> \`${prefix}anticaps enable\` — Turn on Anti Caps\n` +
        `> \`${prefix}anticaps disable\` — Turn off Anti Caps\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
    return message.channel.send({ embeds: [infoEmbed] });
  }

  async exec({ interaction }) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ You need **Administrator** permissions to use this command.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    let data = await this.client.database.autoModData.get(interaction.guild.id);
    if (!data) data = { id: interaction.guild.id, features: {} };
    if (!data.features) data.features = {};

    if (sub === "disable") {
      try {
        data.features.antiCaps = false;
        await this.client.database.autoModData.post(interaction.guild.id, data);
        await this.client.cache.set("automod_" + interaction.guild.id, data);

        const embed = new EmbedBuilder()
          .setColor("#FF1744")
          .setTitle("Hey , I'm OnyxGuard™")
          .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
            `• **System:** Anti Caps Protection\n` +
            `• **Status:** \`Disabled 🔴\`\n` +
            `• **Notice:** Members can now send messages with capital letters freely.`
          )
          .setFooter({
            text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
            iconURL: this.client.user?.displayAvatarURL(),
          });
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return interaction.reply({ content: "❌ Failed to disable **Anti-Caps** rule.", ephemeral: true });
      }
    }

    if (sub === "enable") {
      try {
        data.enabled = true;
        data.features.antiCaps = true;
        await this.client.database.autoModData.post(interaction.guild.id, data);
        await this.client.cache.set("automod_" + interaction.guild.id, data);

        const embed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("Hey , I'm OnyxGuard™")
          .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `A powerful multipurpose bot with Fastest Antinuke & AutoMod\n\n` +
            `• **System:** Anti Caps Protection\n` +
            `• **Status:** \`Active & Enforcing 🟢\`\n` +
            `• **Notice:** Messages with excessive capital letters (≥70% caps) will be automatically deleted.`
          )
          .setFooter({
            text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
            iconURL: this.client.user?.displayAvatarURL(),
          });
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return interaction.reply({ content: "❌ Failed to enable **Anti-Caps** rule.", ephemeral: true });
      }
    }
  }
};
