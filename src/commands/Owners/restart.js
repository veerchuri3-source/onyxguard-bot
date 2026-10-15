const Command = require("../../abstract/command");

module.exports = class Restart extends Command {
  constructor(...args) {
    super(...args, {
      name: "restart",
      aliases: [],
      description: "Restart the bot (owner only)",
      usage: ["restart"],
      category: "Owner",
      cooldown: 0,
      ownerOnly: true, // mark it as owner-only
    });
  }

  async run({ message }) {
    const owners = ["767979794411028491"]; // ✅ replace with your owner IDs

    if (!owners.includes(message.author.id)) {
      return message.reply("❌ Only my owner can restart me.");
    }

    await message.reply("Restarting bot...");
    process.exit(0); // relies on PM2/systemd/Docker to bring it back
  }

  async exec({ interaction }) {
    const owners = ["767979794411028491"]; // ✅ replace with your owner IDs

    if (!owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Only my owner can restart me.",
        ephemeral: true,
      });
    }

    await interaction.reply("Restarting bot...");
    process.exit(0);
  }
};
