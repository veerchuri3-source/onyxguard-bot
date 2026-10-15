const Profile = require("../../models/Profile");
const Command = require("../../abstract/command");

module.exports = class AddBadgeCommand extends Command {
  constructor(client) {
    super(client, "addbadge", {
      name: "addbadge",
      description: "Add a predefined badge to a user's profile",
      category: "Profile",
      usage: ["addbadge <@user|id> <badge>"],
      examples: ["addbadge @Synapse VIP", "addbadge 1234567890 OWNER"],
      cooldown: 3,
    });
  }

  async run({ message, args }) {
    // Restrict to specific user(s)
    if (!["767979794411028491"].includes(message.author.id)) {
      return message.reply("❌ You can’t use this command.");
    }

    const user =
      message.mentions.users.first() || message.client.users.cache.get(args[0]);
    if (!user) {
      return message.reply("❌ Mention a user or provide their ID.");
    }

    // Predefined badges
    const badges = {
      VIP: "⭐ VIP",
      OWNER: "👑 Owner",
      MODERATOR: "🛡 Moderator",
      CONTRIBUTOR: "💎 Contributor",
    };

    const badgeKey = args[1]?.toUpperCase();
    if (!badgeKey || !badges[badgeKey]) {
      return message.reply(
        `❌ Invalid badge. Available badges: ${Object.keys(badges).join(", ")}`
      );
    }

    // Fetch or create profile
    let profile = await Profile.findOne({ userId: user.id });
    if (!profile) {
      profile = await Profile.create({
        userId: user.id,
        bio: "This user has no bio yet.",
        badges: [],
        backgroundKey: null,
        backgroundPath: null,
      });
    }

    // Ensure badges array exists
    if (!Array.isArray(profile.badges)) profile.badges = [];

    if (profile.badges.includes(badgeKey)) {
      return message.reply("❌ They already have this badge.");
    }

    profile.badges.push(badgeKey);
    await profile.save();

    return message.reply(
      `✅ Added badge **${badges[badgeKey]}** to ${user.tag}`
    );
  }
};
