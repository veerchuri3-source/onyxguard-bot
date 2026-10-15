const Command = require("../../abstract/command");
const { PermissionsBitField } = require("discord.js");
const WarnPunish = require("../../models/WarnPunish");

module.exports = class WarnPunishCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "warnpunish",
      aliases: [],
      description: "Set auto punishments for warns",
      usage: ["warnpunish <warnCount> <action> [time in hours]"],
      category: "Moderation",
      userPerms: ["Administrator"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
    });
  }

  async run({ message, args }) {
    await this.handlePunish(message, args);
  }

  async exec({ interaction, args }) {
    await this.handlePunish(interaction, args);
  }

  async handlePunish(ctx, args) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return (
        ctx.reply?.({
          content: "❌ You need Administrator permissions.",
          ephemeral: true,
        }) || ctx.reply("❌ You need Administrator permissions.")
      );
    }

    const warnCount = parseInt(args[0]);
    if (isNaN(warnCount) || warnCount < 1) {
      return (
        ctx.reply?.({
          content: "❌ Invalid warn count. Must be a positive number.",
          ephemeral: true,
        }) || ctx.reply("❌ Invalid warn count. Must be a positive number.")
      );
    }

    const action = args[1]?.toLowerCase();
    if (!["mute", "kick", "ban"].includes(action)) {
      return (
        ctx.reply?.({
          content: "❌ Action must be `mute`, `kick`, or `ban`.",
          ephemeral: true,
        }) || ctx.reply("❌ Action must be `mute`, `kick`, or `ban`.")
      );
    }

    let duration = null;
    if (action === "mute") {
      duration = args[2] ? parseInt(args[2]) : 1; // default 1 hour
      if (isNaN(duration) || duration <= 0) {
        return (
          ctx.reply?.({
            content: "❌ Duration must be a positive number in hours.",
            ephemeral: true,
          }) || ctx.reply("❌ Duration must be a positive number in hours.")
        );
      }
    }

    // Save or update the punishment in the database
    await WarnPunish.findOneAndUpdate(
      { guildId: ctx.guild.id, warnCount },
      { action, duration },
      { upsert: true }
    );

    const displayDuration = action === "mute" ? ` for ${duration} hour(s)` : "";

    return (
      ctx.reply?.({
        content: `✅ Punishment set: **${warnCount} warns → ${action.toUpperCase()}${displayDuration}**`,
        ephemeral: true,
      }) ||
      ctx.reply(
        `✅ Punishment set: **${warnCount} warns → ${action.toUpperCase()}${displayDuration}**`
      )
    );
  }
};
