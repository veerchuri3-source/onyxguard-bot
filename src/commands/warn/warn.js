const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const Case = require("../../models/Case");
const WarnPunish = require("../../models/WarnPunish");

module.exports = class WarnCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "warn",
      aliases: [],
      description: "Warn a user (creates a case)",
      usage: ["warn <user> <reason>"],
      category: "Moderation",
      userPerms: ["KickMembers"],
      botPerms: ["SendMessages", "EmbedLinks", "ModerateMembers"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    await this.handleWarn(message, args);
  }

  async exec({ interaction, args }) {
    await this.handleWarn(interaction, args);
  }

  async handleWarn(ctx, args) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return (
        ctx.reply?.({
          content: "❌ You don’t have permission.",
          ephemeral: true,
        }) || ctx.reply("❌ You don’t have permission.")
      );
    }

    const member =
      ctx.mentions?.members?.first() || ctx.guild.members.cache.get(args[0]);
    if (!member)
      return (
        ctx.reply?.({
          content: "❌ Please mention a valid user.",
          ephemeral: true,
        }) || ctx.reply("❌ Please mention a valid user.")
      );

    const reason = args.slice(1).join(" ") || "No reason provided";

    // Count existing cases for the guild
    const count = await Case.countDocuments({ guildId: ctx.guild.id });
    const caseId = count + 1;

    // Create case
    const newCase = await Case.create({
      guildId: ctx.guild.id,
      caseId,
      userId: member.id,
      moderatorId: ctx.user?.id || ctx.author.id,
      action: "warn",
      reason,
    });

    // Count warnings for this user
    const userWarns = await Case.countDocuments({
      guildId: ctx.guild.id,
      userId: member.id,
      action: "warn",
    });

    // Fetch any punishments configured for this warn count
    const punishmentConfig = await WarnPunish.findOne({
      guildId: ctx.guild.id,
      warnCount: userWarns,
    });

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle(`⚠️ Case #${newCase.caseId} | Warn Issued`)
      .addFields(
        { name: "User", value: `${member.user.tag} (${member.id})` },
        { name: "Moderator", value: ctx.user?.tag || ctx.author.tag },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    // Try DM
    try {
      await member.send(
        `⚠️ You have been warned in **${ctx.guild.name}**. Reason: ${reason}`
      );
    } catch {
      ctx.channel?.send?.(`⚠️ Could not DM ${member.user.tag}.`);
    }

    // Apply punishment if configured
    if (punishmentConfig) {
      let punishmentText = "";
      switch (punishmentConfig.action) {
        case "mute":
          const durationMs = (punishmentConfig.duration || 1) * 60 * 60 * 1000; // hours to ms
          await member.timeout(
            durationMs,
            `Auto punishment: ${userWarns} warns`
          );
          punishmentText = `MUTE for ${punishmentConfig.duration || 1}h`;
          break;
        case "kick":
          await member.kick(`Auto punishment: ${userWarns} warns`);
          punishmentText = "KICK";
          break;
        case "ban":
          await member.ban({ reason: `Auto punishment: ${userWarns} warns` });
          punishmentText = "BAN";
          break;
      }

      if (punishmentText) {
        embed.addFields({
          name: "Auto Punishment",
          value: `${punishmentText} applied due to ${userWarns} warns.`,
        });
      }
    }

    return (
      ctx.reply?.({ embeds: [embed], ephemeral: true }) ||
      ctx.reply({ embeds: [embed] })
    );
  }
};
