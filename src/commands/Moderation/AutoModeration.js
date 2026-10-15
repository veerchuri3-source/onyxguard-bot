const AutoModCommand = require("../automod/AutoMod");

module.exports = class AutoModeration extends AutoModCommand {
  constructor(...args) {
    super(...args);
    this.name = "automoderation";
    this.aliases = ["automod", "am"];
  }
};