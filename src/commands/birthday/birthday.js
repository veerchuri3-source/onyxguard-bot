const Command = require("../../abstract/command");
const Birthday = require("../../models/birthday");
const BirthdaySettings = require("../../models/birthdaySettings");

module.exports = class BirthdayCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "birthday",
      aliases: ["bday"],
      description: "Manage birthdays",
      usage: [
        "birthday set <YYYY-MM-DD>",
        "birthday check [@user]",
        "birthday channel <#channel>",
        "birthday role <@role>",
        "birthday message <custom message>",
      ],
      category: "Utilities",
      userPerms: ["SendMessages"],
      botPerms: ["EmbedLinks"],
    });
  }

  async run({ message, args }) {
    const sub = args[0]?.toLowerCase();
    const guildId = message.guild.id;
    const userId = message.author.id;

    switch (sub) {
      case "set":
        const date = args[1];
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
          return message.reply("❌ Please use the format `YYYY-MM-DD`.");

        await Birthday.findOneAndUpdate(
          { userId, guildId },
          { date },
          { upsert: true }
        );

        return message.reply(`✅ Your birthday has been set to ${date}.`);

      case "check":
        const target = message.mentions.users.first() || message.author;
        const userBday = await Birthday.findOne({ userId: target.id, guildId });
        if (!userBday)
          return message.reply("This user hasn't set their birthday yet.");
        return message.reply(
          `${target.username}'s birthday is on ${userBday.date}.`
        );

      case "channel":
        if (!message.member.permissions.has("Administrator"))
          return message.reply("❌ Only admins can set the birthday channel.");
        const channel = message.mentions.channels.first();
        if (!channel)
          return message.reply("❌ Please mention a valid channel.");
        await BirthdaySettings.findOneAndUpdate(
          { guildId },
          { channelId: channel.id },
          { upsert: true }
        );
        return message.reply(
          `✅ Birthday messages will be sent in ${channel}.`
        );

      case "role":
        if (!message.member.permissions.has("Administrator"))
          return message.reply("❌ Only admins can set the birthday role.");
        const role = message.mentions.roles.first();
        if (!role) return message.reply("❌ Please mention a valid role.");
        await BirthdaySettings.findOneAndUpdate(
          { guildId },
          { roleId: role.id },
          { upsert: true }
        );
        return message.reply(`✅ Birthday role set to ${role.name}.`);

      case "message":
        if (!message.member.permissions.has("Administrator"))
          return message.reply("❌ Only admins can set the birthday message.");
        const customMsg = args.slice(1).join(" ");
        if (!customMsg)
          return message.reply("❌ Please provide a custom message.");
        await BirthdaySettings.findOneAndUpdate(
          { guildId },
          { message: customMsg },
          { upsert: true }
        );
        return message.reply("✅ Custom birthday message updated.");

      default:
        return message.reply(
          "❌ Usage:\n" +
            "`birthday set <YYYY-MM-DD>`\n" +
            "`birthday check [@user]`\n" +
            "`birthday channel <#channel>`\n" +
            "`birthday role <@role>`\n" +
            "`birthday message <custom message>`"
        );
    }
  }
};
