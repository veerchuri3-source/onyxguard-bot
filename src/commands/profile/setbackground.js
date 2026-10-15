const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const Profile = require("../../models/Profile");
const Command = require("../../abstract/command");

const TICK = "✅";
const CROSS = "❌";

// keyword -> filename (under /commands/profile/images/)
const TEMPLATES = {
  mountain: "mountain.png",
  city: "city.png",
  forest: "forest.png",
  galaxy: "galaxy.png",
  aurora: "aurora.png",
};

module.exports = class SetBackgroundCommand extends Command {
  constructor(client) {
    super(client, "setbackground", {
      name: "setbackground",
      aliases: ["setbg", "background", "bg"],
      category: "Profile",
      description:
        "Set your profile background from template images stored locally",
      usage: ["setbackground <name>", "setbackground list"],
      examples: ["setbackground galaxy", "setbackground list"],
      cooldown: 5,
    });
  }

  async run({ message, args, client }) {
    const sub = (args[0] || "").toLowerCase();

    // Show list
    if (!sub || sub === "list") {
      const names = Object.keys(TEMPLATES)
        .map((n) => `\`${n}\``)
        .join(", ");
      const em = new EmbedBuilder()
        .setColor(client.color || "#2b2d31")
        .setTitle("Available Background Templates")
        .setDescription(names || "No templates found")
        .setFooter({ text: "Use: setbackground <name>" });
      return message.reply({ embeds: [em] });
    }

    // Validate template
    if (!TEMPLATES[sub]) {
      return message.reply(
        `${CROSS} Invalid template. Use \`setbackground list\` to see options.`
      );
    }

    // Resolve path
    const baseDir = path.join(process.cwd(), "commands", "profile", "images");
    const filePath = path.join(baseDir, TEMPLATES[sub]);

    if (!fs.existsSync(filePath)) {
      return message.reply(
        `${CROSS} Template file missing on disk: \`${TEMPLATES[sub]}\`. Place it in \`commands/profile/images/\`.`
      );
    }

    // Upsert profile
    let profile = await Profile.findOne({ userId: message.author.id });
    if (!profile) {
      profile = await Profile.create({
        userId: message.author.id,
        bio: "This user has no bio yet.",
        badges: [],
        backgroundKey: null,
        backgroundPath: null,
      });
    }

    profile.backgroundKey = sub;
    profile.backgroundPath = filePath;
    await profile.save();

    return message.reply(
      `${TICK} Background set to **${sub}**. Use \`profilecard\` to view it.`
    );
  }
};
