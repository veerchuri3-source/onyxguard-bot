const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");

module.exports = class CaseDeleteCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "casedelete",
      description: "Delete a specific case",
      usage: ["casedelete <id>"],
      category: "Moderation",
      userPerms: ["ManageMessages"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    await this.handleDelete(message, args[0], message);
  }

  async exec({ interaction, args }) {
    await this.handleDelete(interaction, args[0], interaction);
  }

  async handleDelete(ctx, caseIdArg, replyCtx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return (
        replyCtx.reply?.({
          content: "❌ You don’t have permission to use this.",
          ephemeral: true,
        }) || replyCtx.reply("❌ You don’t have permission to use this.")
      );
    }

    if (!caseIdArg)
      return (
        replyCtx.reply?.({
          content: "❌ Provide a case ID.",
          ephemeral: true,
        }) || replyCtx.reply("❌ Provide a case ID.")
      );

    const caseId = parseInt(caseIdArg, 10);

    const found = await Case.findOneAndDelete({
      guildId: ctx.guild.id,
      caseId,
    });

    if (!found)
      return (
        replyCtx.reply?.({ content: "⚠️ Case not found.", ephemeral: true }) ||
        replyCtx.reply("⚠️ Case not found.")
      );

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle(`🗑️ Case #${found.caseId} Deleted`)
      .addFields(
        { name: "User", value: `<@${found.userId}>`, inline: true },
        { name: "Moderator", value: `<@${found.moderatorId}>`, inline: true },
        { name: "Reason", value: found.reason, inline: false }
      )
      .setTimestamp();

    return (
      replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
      replyCtx.reply({ embeds: [embed] })
    );
  }
};
