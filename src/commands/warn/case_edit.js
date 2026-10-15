const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");

module.exports = class CaseEditCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "caseedit",
      description: "Edit the reason of a case",
      usage: ["caseedit <id> <new reason>"],
      category: "Moderation",
      userPerms: ["ManageMessages"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    await this.handleEdit(message, args, message);
  }

  async exec({ interaction, args }) {
    await this.handleEdit(interaction, args, interaction);
  }

  async handleEdit(ctx, args, replyCtx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return replyCtx.reply?.({ content: "❌ You don’t have permission to use this.", ephemeral: true }) ||
             replyCtx.reply("❌ You don’t have permission to use this.");
    }

    if (!args[0]) return replyCtx.reply?.({ content: "❌ Provide a case ID.", ephemeral: true }) ||
                         replyCtx.reply("❌ Provide a case ID.");

    const caseId = parseInt(args[0], 10);
    const newReason = args.slice(1).join(" ");
    if (!newReason) return replyCtx.reply?.({ content: "❌ Provide a new reason.", ephemeral: true }) ||
                         replyCtx.reply("❌ Provide a new reason.");

    const found = await Case.findOne({ guildId: ctx.guild.id, caseId });
    if (!found) return replyCtx.reply?.({ content: "⚠️ Case not found.", ephemeral: true }) ||
                         replyCtx.reply("⚠️ Case not found.");

    found.reason = newReason;
    await found.save();

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle(`✏️ Case #${found.caseId} Updated`)
      .addFields(
        { name: "User", value: `<@${found.userId}>`, inline: true },
        { name: "Moderator", value: `<@${found.moderatorId}>`, inline: true },
        { name: "New Reason", value: newReason, inline: false }
      )
      .setTimestamp();

    return replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
           replyCtx.reply({ embeds: [embed] });
  }
};
