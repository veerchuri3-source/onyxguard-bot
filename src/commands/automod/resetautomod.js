const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class ResetAutoMod extends Command {
  constructor(...args) {
    super(...args, {
      name: "resetautomod",
      aliases: ["automodreset", "amreset"],
      description: "Remove all AutoMod rules from your server",
      usage: ["resetautomod"],
      category: "AutoMod",
      userPerms: ["Administrator"],
      botPerms: ["ManageGuild"],
      guildOnly: true,
    });
  }

  async run({ message }) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "❌ You need **Administrator** permissions to use this command."
      );
    }

    try {
      const rules = await message.guild.autoModerationRules.fetch();
      if (!rules.size) {
        return message.channel.send("ℹ️ No AutoMod rules found on this server.");
      }
      for (const rule of rules.values()) {
        await rule.delete(`Reset by ${message.author.tag}`).catch(() => {});
      }

      const data = await this.client.database.autoModData.get(message.guild.id);
      data.enabled = false;
      await this.client.database.autoModData.post(message.guild.id, data);
      await this.client.cache.set("automod_" + message.guild.id, data);

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription(
          "✅ All AutoMod rules and configurations have been successfully **reset & disabled**!"
        );
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.channel.send(
        "❌ Failed to reset AutoMod rules. Check my permissions and try again."
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const rules = await interaction.guild.autoModerationRules.fetch();
      if (!rules.size) {
        return interaction.editReply({
          content: "ℹ️ No AutoMod rules found on this server.",
        });
      }
      for (const rule of rules.values()) {
        await rule.delete(`Reset by ${interaction.user.tag}`).catch(() => {});
      }

      const data = await this.client.database.autoModData.get(interaction.guild.id);
      data.enabled = false;
      await this.client.database.autoModData.post(interaction.guild.id, data);
      await this.client.cache.set("automod_" + interaction.guild.id, data);

      const embed = new EmbedBuilder()
        .setColor("#5FFD0A")
        .setDescription(
          "✅ All AutoMod rules and configurations have been successfully **reset & disabled**!"
        );
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.editReply({
        content:
          "❌ Failed to reset AutoMod rules. Check my permissions and try again.",
      });
    }
  }
};
