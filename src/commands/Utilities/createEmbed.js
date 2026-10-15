const Command = require("../../abstract/command"); // Fixed import
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class CreateEmbedCommand extends Command {
  constructor(client) {
    super(client, "createembed", {
      aliases: ["ce", "embed"],
      description: "Create a custom embed with variables and formatting.",
      usage: [
        "createembed {embed}$v{title: Your Title}$v{description: Your Description}$v{color: 000000}",
      ],
      category: "Utilities",
      userPerms: [PermissionsBitField.Flags.ManageMessages],
      botPerms: [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks,
      ],
      cooldown: 5,
    });
  }

  async run({ message, args }) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#efa23a")
            .setDescription(
              `⚠️ ${message.author}: You're **missing** permission: \`Manage Messages\``
            ),
        ],
      });
    }

    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#efa23a")
            .setTitle("Create Embed")
            .setDescription(
              "Example:\n```\ns?ce {embed}$v{title: Your Title}$v{description: Your Description}$v{color: 000000}\n\nNOTE: [Use your own server prefix if set] ```"
            ),
        ],
      });
    }

    try {
      let raw = args.join(" ");

      // ===== Variable replacements =====
      raw = raw
        .replace(/{guild.name}/gi, message.guild.name)
        .replace(/{guild.icon}/gi, message.guild.iconURL({ dynamic: true }))
        .replace(
          /{guild.vanity}/gi,
          message.guild.vanityURLCode || "No Vanity URL"
        );

      // ===== Role replacements =====
      raw = raw.replace(/\(role:?([^)]+)\)/gi, (match, roleArg) => {
        roleArg = roleArg.trim();
        let role =
          message.guild.roles.cache.get(roleArg) ||
          message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleArg.toLowerCase()
          ) ||
          null;
        return role ? `<@&${role.id}>` : `(Unknown Role: ${roleArg})`;
      });

      // ===== Build embed =====
      const embed = new EmbedBuilder();
      const parts = raw.split("$v").map((p) => p.trim());

      parts.forEach((part) => {
        const clean = part.replace(/^{|}$/g, "").trim(); // strip { and }

        if (clean.toLowerCase().startsWith("title:")) {
          embed.setTitle(clean.slice(6).trim());
        } else if (clean.toLowerCase().startsWith("description:")) {
          embed.setDescription(clean.slice(12).trim());
        } else if (clean.toLowerCase().startsWith("author:")) {
          const [name, icon] = clean
            .slice(7)
            .split("&&")
            .map((s) => s.trim());
          embed.setAuthor({ name: name || "", iconURL: icon || null });
        } else if (clean.toLowerCase().startsWith("image:")) {
          embed.setImage(clean.slice(6).trim());
        } else if (clean.toLowerCase().startsWith("footer:")) {
          embed.setFooter({ text: clean.slice(7).trim() });
        } else if (clean.toLowerCase().startsWith("color:")) {
          embed.setColor("#" + clean.slice(6).trim());
        }
      });

      message.channel.send({ embeds: [embed] });
    } catch (e) {
      message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#efa23a")
            .setDescription(
              `⚠️ ${message.author}: Failed to build embed - ${e.message}`
            ),
        ],
      });
    }
  }
};
