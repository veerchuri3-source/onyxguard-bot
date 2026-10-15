const { AttachmentBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");
const Profile = require("../../models/Profile");
const Command = require("../../abstract/command");

module.exports = class ProfileCardCommand extends Command {
  constructor(client) {
    super(client, "profilecard", {
      name: "profilecard",
      aliases: ["pc"],
      description: "View your profile card",
      category: "Profile",
      cooldown: 5,
      usage: ["profilecard [@user]"],
      examples: ["profilecard", "profilecard @Synapse"],
    });
  }

  async run({ message, args }) {
    const user = message.mentions.users.first() || message.author;

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

    // Canvas setup
    const canvas = Canvas.createCanvas(900, 400);
    const ctx = canvas.getContext("2d");

    // Background
    let drewBg = false;
    if (profile.backgroundPath && fs.existsSync(profile.backgroundPath)) {
      try {
        const bg = await Canvas.loadImage(profile.backgroundPath);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        drewBg = true;
      } catch {}
    }

    if (!drewBg) {
      const fallback = path.join(
        process.cwd(),
        "commands",
        "profile",
        "images",
        "default.png"
      );
      if (fs.existsSync(fallback)) {
        const bg = await Canvas.loadImage(fallback);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#23272A";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Overlay for readability
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Avatar
    const avatar = await Canvas.loadImage(
      user.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(170, 200, 120, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 50, 80, 240, 240);
    ctx.restore();

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 35px Sans";
    ctx.fillText(`${user.username}`, 320, 95);

    // Bio
    ctx.fillStyle = "#cccccc";
    ctx.font = "25px Sans";
    const bio = profile.bio || "This user has no bio yet.";
    this.wrapText(ctx, `Bio: ${bio}`, 320, 145, 550, 28);

    // Badges
    ctx.fillStyle = "#00b0f4";
    ctx.font = "23px Sans";
    const badgesText =
      Array.isArray(profile.badges) && profile.badges.length > 0
        ? profile.badges.join(" • ")
        : "This user has no badge";
    this.wrapText(ctx, `Badges: ${badgesText}`, 320, 220, 550, 26);

    // Footer
    ctx.font = "20px Sans";
    ctx.fillStyle = "#999999";
    ctx.fillText(`ID: ${user.id}`, 320, 330);

    // Send image
    const buffer = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: "profile.png" });
    return message.reply({ files: [attachment] });
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }
};
