const Command = require("../../abstract/command");

module.exports = class Membercount extends Command {
  constructor(...args) {
    super(...args, {
      name: "membercount",
      aliases: ["mc"],
      description: "Shows the member count of the server.",
      usage: ["mc", "members"],
      category: "Utilities",
      userPerms: ["ViewChannel", "SendMessages"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
      cooldown: 2,
      image: "",
    });
  }

  buildEmbed(guild) {
    return this.client.util
      .embed()
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
      .setTitle("Membercount")
      .setColor(this.client.config.Client.PrimaryColor)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setDescription(
        `👥 Total Members:\n\`\`\`${guild.memberCount}\`\`\``
      );
  }

  async run({ message }) {
    try {
      const guild = message?.guild;
      if (!guild) return;

      const embed = this.buildEmbed(guild);
      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Membercount Error (message):", error);
    }
  }

  async exec({ interaction }) {
    try {
      const guild = interaction?.guild;
      if (!guild) return;

      const embed = this.buildEmbed(guild);
      interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Membercount Error (interaction):", error);
    }
  }
};
