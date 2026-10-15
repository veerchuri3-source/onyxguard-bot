const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");

module.exports = class CaseCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "case",
      description: "View a case by ID or list all cases for a user",
      usage: ["case <id | @user>"],
      category: "Moderation",
      userPerms: ["ManageMessages"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    if (!args[0]) return message.reply("❌ Provide a case ID or user.");
    await this.handleCaseLookup(message, args[0], message);
  }

  async exec({ interaction, args }) {
    if (!args[0])
      return interaction.reply({
        content: "❌ Provide a case ID or user.",
        ephemeral: true,
      });
    await this.handleCaseLookup(interaction, args[0], interaction);
  }

  async handleCaseLookup(ctx, query, replyCtx) {
    // Case ID lookup
    if (!isNaN(query)) {
      const caseId = parseInt(query, 10);
      const found = await Case.findOne({ guildId: ctx.guild.id, caseId });

      if (!found)
        return (
          replyCtx.reply?.({
            content: "⚠️ Case not found.",
            ephemeral: true,
          }) || replyCtx.reply("⚠️ Case not found.")
        );

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle(`📂 Case #${found.caseId}`)
        .addFields(
          { name: "Action", value: found.action, inline: true },
          { name: "User", value: `<@${found.userId}>`, inline: true },
          { name: "Moderator", value: `<@${found.moderatorId}>`, inline: true },
          { name: "Reason", value: found.reason, inline: false }
        )
        .setTimestamp(found.date);

      return (
        replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
        replyCtx.reply({ embeds: [embed] })
      );
    }

    // User lookup
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
          content: `✅ ${member.user.tag} has no cases.`,
          ephemeral: true,
        }) || replyCtx.reply(`✅ ${member.user.tag} has no cases.`)
      );
    }

    const list = cases
      .map(
        (c) =>
          `#${c.caseId} — **${c.action}** by <@${c.moderatorId}>: ${c.reason}`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle(`📜 Cases for ${member.user.tag}`)
      .setDescription(list.length > 4000 ? list.slice(0, 4000) + "..." : list)
      .setTimestamp();

    return (
      replyCtx.reply?.({ embeds: [embed], ephemeral: true }) ||
      replyCtx.reply({ embeds: [embed] })
    );
  }
};
