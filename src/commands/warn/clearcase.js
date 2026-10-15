const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");

module.exports = class ClearCaseCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "clearcase",
      description: "Delete a case by ID or all cases for a user",
      usage: ["clearcase <id | @user>"],
      category: "Moderation",
      userPerms: ["ManageMessages"],
      botPerms: ["SendMessages", "EmbedLinks", "ManageMessages"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    if (!args[0])
      return message.reply("❌ Provide a case ID or user to clear.");
    await this.handleClear(message, args[0], message);
  }

  async exec({ interaction, args }) {
    if (!args[0])
      return interaction.reply({
        content: "❌ Provide a case ID or user to clear.",
        ephemeral: true,
      });
    await this.handleClear(interaction, args[0], interaction);
  }

  async handleClear(ctx, query, replyCtx) {
    // Case ID deletion
    if (!isNaN(query)) {
      const caseId = parseInt(query, 10);
      const deleted = await Case.findOneAndDelete({
        guildId: ctx.guild.id,
        caseId,
      });

      if (!deleted)
        return (
          replyCtx.reply?.({
            content: "⚠️ Case not found.",
            ephemeral: true,
          }) || replyCtx.reply("⚠️ Case not found.")
        );

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle(`🗑️ Case #${caseId} Deleted`)
        .addFields(
          { name: "User", value: `<@${deleted.userId}>`, inline: true },
          {
            name: "Moderator",
            value: `<@${deleted.moderatorId}>`,
            inline: true,
          },
          { name: "Reason", value: deleted.reason, inline: false }
        )
        .setTimestamp();

      return (
        replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
        replyCtx.reply({ embeds: [embed] })
      );
    }

    // User deletion (all cases)
    const member =
      ctx.mentions?.members?.first?.() || ctx.guild.members.cache.get(query);

    if (!member)
      return (
        replyCtx.reply?.({
          content: "❌ Invalid user or case ID.",
          ephemeral: true,
        }) || replyCtx.reply("❌ Invalid user or case ID.")
      );

    const cases = await Case.find({ guildId: ctx.guild.id, userId: member.id });

    if (!cases.length) {
      return (
        replyCtx.reply?.({
          content: `✅ ${member.user.tag} has no cases to clear.`,
          ephemeral: true,
        }) || replyCtx.reply(`✅ ${member.user.tag} has no cases to clear.`)
      );
    }

    await Case.deleteMany({ guildId: ctx.guild.id, userId: member.id });

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle(`🗑️ Cleared All Cases for ${member.user.tag}`)
      .setDescription(`Deleted ${cases.length} case(s).`)
      .setTimestamp();

    return (
      replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
      replyCtx.reply({ embeds: [embed] })
    );
  }
};
