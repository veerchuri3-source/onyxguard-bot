const Profile = require("../../models/Profile");
const Command = require("../../abstract/command");

const TICK = "✅";
const CROSS = "❌";

module.exports = class SetBioCommand extends Command {
  constructor(client) {
    super(client, "setbio", {
      name: "setbio",
      aliases: ["bio"],
      category: "Profile",
      description: "Set your profile bio (max 200 chars)",
      usage: ["setbio <text>"],
      examples: ["setbio I love coding!", "bio Just a gamer."],
      cooldown: 5,
    });
  }

  async run({ message, args }) {
    const bio = args.join(" ");

    // ❌ no input
    if (!bio) {
      return message.reply(`${CROSS} Please write your bio after the command.`);
    }

    // ❌ too long
    if (bio.length > 200) {
      return message.reply(
        `${CROSS} Your bio cannot be longer than **200 characters**.`
      );
    }

    // Upsert profile
    let profile = await Profile.findOne({ userId: message.author.id });
    if (!profile) {
      profile = await Profile.create({
        userId: message.author.id,
        bio: "",
        badges: [],
        backgroundKey: null,
        backgroundPath: null,
      });
    }

    profile.bio = bio;
    await profile.save();

    // ✅ confirmation
    return message.reply(`${TICK} Your bio has been updated to:\n\`${bio}\``);
  }
};
