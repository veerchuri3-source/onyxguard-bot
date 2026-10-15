const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");

module.exports = class CaseRestoreCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "caserestore",
      description: "Restore (undo) a case",
      usage: ["caserestore <caseId>"],
      category: "Moderation",
      userPerms: ["KickMembers"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    await this.handleRestore(message, args, message);
  }

  async exec({ interaction, args }) {
    await this.handleRestore(interaction, args, interaction);
  }

  async handleRestore(ctx, args, replyCtx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return (
        replyCtx.reply?.({
          content: "❌ You don’t have permission.",
          ephemeral: true,
        }) || replyCtx.reply("❌ You don’t have permission.")
      );
    }

    const caseId = args[0];
    if (!caseId)
      return (
        replyCtx.reply?.({
          content: "❌ Please provide a case ID.",
          ephemeral: true,
        }) || replyCtx.reply("❌ Please provide a case ID.")
      );

    const foundCase = await Case.findOne({
      guildId: ctx.guild.id,
      caseId,
    });

    if (!foundCase)
      return (
        replyCtx.reply?.({ content: "❌ Case not found.", ephemeral: true }) ||
        replyCtx.reply("❌ Case not found.")
      );

    // Restore by deleting the case (or you can implement a restored flag instead)
    await Case.deleteOne({ _id: foundCase._id });

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle(`✅ Case #${caseId} Restored`)
      .setDescription(
        `The punishment for <@${foundCase.userId}> has been restored/undone.`
      )
      .addFields({ name: "Moderator", value: ctx.user?.tag || ctx.author.tag })
      .setTimestamp();

    return (
      replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
      replyCtx.reply({ embeds: [embed] })
    );
  }
};
