const AutoModCommand = require("./AutoMod");

module.exports = class SetupAutoMod extends AutoModCommand {
  constructor(...args) {
    super(...args);
    this.name = "setupautomod";
    this.aliases = ["automodsetup", "amsetup"];
    this.description = "Interactive AutoMod setup & configuration";
    this.usage = ["setupautomod"];
  }

  async run({ message }) {
    return await this._startInteractiveSetup(message, message.guild, message.author, false);
  }

  async exec({ interaction }) {
    return await this._startInteractiveSetup(interaction, interaction.guild, interaction.user, true);
  }
};
