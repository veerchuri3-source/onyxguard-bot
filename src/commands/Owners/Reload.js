// commands/owner/reload.js
const { EmbedBuilder } = require("discord.js");
const Command = require("../../abstract/command");

// Replace with your actual owner IDs (numbers)
const OWNER_IDS = [767979794411028491];

module.exports = class ReloadCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "reload",
      aliases: ["rld", "reloaad"],
      description: "Reload a command module (or `all`). Owner only.",
      usage: ["reload <command|all>"],
      examples: ["reload ping", "reload all"],
      category: "Owner",
      userPerms: ["SendMessages"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: false,
      slash: false,
    });
  }

  // helper to send a standardized embed
  _makeEmbed(title, description, color = 0x57f287) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color);
  }

  // Try to find the require.cache key (file path) corresponding to the command module
  tryFindModulePath(commandObj) {
    // If the command has an explicit file/path property, prefer that
    if (commandObj.file || commandObj.path || commandObj.__file) {
      try {
        return require.resolve(
          commandObj.file || commandObj.path || commandObj.__file
        );
      } catch {}
    }

    // Otherwise search require.cache for a module that exports the same constructor or name
    const entries = Object.keys(require.cache);
    for (const key of entries) {
      const exported = require.cache[key].exports;
      if (!exported) continue;

      // If module exports a class/constructor function with same name
      const exportedName =
        (typeof exported === "function" && exported.name) ||
        (exported && exported.constructor && exported.constructor.name);

      if (
        exportedName &&
        commandObj.constructor &&
        exportedName === commandObj.constructor.name
      ) {
        return key;
      }

      // If module exports an object with `name` matching the command's name
      if (
        exported &&
        typeof exported.name === "string" &&
        exported.name === commandObj.name
      ) {
        return key;
      }

      // Rare shape: module.exports = { default: class X {} }
      if (exported && exported.default) {
        const d = exported.default;
        const dName =
          (typeof d === "function" && d.name) ||
          (d && d.constructor && d.constructor.name);
        if (
          dName &&
          commandObj.constructor &&
          dName === commandObj.constructor.name
        ) {
          return key;
        }
      }
    }

    return null;
  }

  // Unload and re-require a module by path
  unloadModule(modulePath) {
    try {
      const resolved = require.resolve(modulePath);
      if (require.cache[resolved]) {
        // Remove children first to reduce leftover references
        const mod = require.cache[resolved];
        if (mod && mod.children) {
          mod.children.forEach((c) => {
            try {
              delete require.cache[c.id];
            } catch {}
          });
        }
        delete require.cache[resolved];
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  async run({ message, args }) {
    return this._execute(message, args);
  }

  async exec({ interaction, args }) {
    // Basic support: assume interaction provides a single string arg or none.
    const raw = args && Array.isArray(args) && args.length ? args : [];
    return this._execute(interaction, raw);
  }

  async _execute(ctx, args = []) {
    const authorId = (ctx.author && ctx.author.id) || (ctx.user && ctx.user.id);
    if (!OWNER_IDS.includes(Number(authorId))) {
      return (
        ctx.reply?.({
          embeds: [
            this._makeEmbed(
              "Permission denied",
              "Only bot owners may use this command.",
              0xed4245
            ),
          ],
        }) ||
        ctx.channel?.send?.({
          embeds: [
            this._makeEmbed(
              "Permission denied",
              "Only bot owners may use this command.",
              0xed4245
            ),
          ],
        })
      );
    }

    const target = args[0]?.toLowerCase();
    if (!target) {
      return (
        ctx.reply?.({
          embeds: [this._makeEmbed("Usage", "Usage: `reload <command|all>`")],
        }) ||
        ctx.channel?.send?.({
          embeds: [this._makeEmbed("Usage", "Usage: `reload <command|all>` NOTE: Some command cannot be reloaded IF you want to know which use reload all")],
        })
      );
    }

    // reload all
    if (target === "all") {
      const successes = [];
      const failures = [];

      // iterate through all commands the bot currently has
      for (const [name, commandObj] of this.client.commands) {
        try {
          // find module path
          const modulePath = this.tryFindModulePath(commandObj);
          if (!modulePath) {
            failures.push(`${name} (modulepath not found)`);
            continue;
          }

          const unloaded = this.unloadModule(modulePath);
          if (!unloaded) {
            failures.push(`${name} (failed to unload)`);
            continue;
          }

          // re-require
          require(modulePath);

          // try to re-register if your framework requires it:
          // many frameworks automatically `require` the file and constructor registers itself.
          // if your bot has a loader function, call it here:
          if (typeof this.client.loadCommand === "function") {
            try {
              await this.client.loadCommand(modulePath);
            } catch {}
          }

          successes.push(name);
        } catch (err) {
          failures.push(`${name} (${String(err.message).slice(0, 120)})`);
        }
      }

      const embed = this._makeEmbed(
        "Reloaded all commands",
        `Succeeded: **${successes.length}**\nFailed: **${failures.length}**\n\n` +
          (successes.length ? `**OK:** ${successes.join(", ")}\n` : "") +
          (failures.length ? `**ERR:** ${failures.join(", ")}` : "")
      );
      return (
        ctx.reply?.({ embeds: [embed] }) ||
        ctx.channel?.send?.({ embeds: [embed] })
      );
    }

    // reload a single command by name or alias
    const nameOrAlias = target;
    const command =
      this.client.commands.get(nameOrAlias) ||
      this.client.commands.find((c) => (c.aliases || []).includes(nameOrAlias));

    if (!command) {
      return (
        ctx.reply?.({
          embeds: [
            this._makeEmbed(
              "Not found",
              `Command or alias \`${nameOrAlias}\` not found.`,
              0xed4245
            ),
          ],
        }) ||
        ctx.channel?.send?.({
          embeds: [
            this._makeEmbed(
              "Not found",
              `Command or alias \`${nameOrAlias}\` not found.`,
              0xed4245
            ),
          ],
        })
      );
    }

    try {
      const modulePath = this.tryFindModulePath(command);
      if (!modulePath) {
        return (
          ctx.reply?.({
            embeds: [
              this._makeEmbed(
                "Can't locate module",
                `Could not determine module path for command \`${command.name}\`. If your command exposes a file/path property, attach it as \`command.file\` or \`command.path\` so reload can work.`,
                0xed4245
              ),
            ],
          }) ||
          ctx.channel?.send?.({
            embeds: [
              this._makeEmbed(
                "Can't locate module",
                `Could not determine module path for command \`${command.name}\`. If your command exposes a file/path property, attach it as \`command.file\` or \`command.path\` so reload can work.`,
                0xed4245
              ),
            ],
          })
        );
      }

      // unload from cache
      const unloaded = this.unloadModule(modulePath);
      if (!unloaded) {
        return (
          ctx.reply?.({
            embeds: [
              this._makeEmbed(
                "Unload failed",
                `Failed to unload module for \`${command.name}\`.`,
                0xed4245
              ),
            ],
          }) ||
          ctx.channel?.send?.({
            embeds: [
              this._makeEmbed(
                "Unload failed",
                `Failed to unload module for \`${command.name}\`.`,
                0xed4245
              ),
            ],
          })
        );
      }

      // re-require module
      const re = require(modulePath);

      // If your framework needs manual registration:
      // remove old command from collections then register new one
      try {
        this.client.commands.delete(command.name);
        // If the module exports a class, instantiate & register it
        // (many frameworks register in their loader, so the below is defensive)
        if (
          typeof re === "function" ||
          (re && typeof re.default === "function")
        ) {
          const CommandClass = typeof re === "function" ? re : re.default;
          const instance = new CommandClass(this.client);
          if (instance && instance.name) {
            this.client.commands.set(instance.name, instance);
          }
        }
      } catch (e) {
        // ignore registration errors; not all frameworks need manual registration here
      }

      // also try to reload slash commands collection if present
      if (
        this.client.slashCommands &&
        this.client.slashCommands.has(command.name)
      ) {
        try {
          this.client.slashCommands.delete(command.name);
          // if the reloaded module exports slash registration, register here
          if (typeof this.client.loadSlashCommand === "function") {
            await this.client.loadSlashCommand(modulePath);
          }
        } catch {}
      }

      return (
        ctx.reply?.({
          embeds: [
            this._makeEmbed(
              "Reloaded",
              `Successfully reloaded \`${command.name}\`.`
            ),
          ],
        }) ||
        ctx.channel?.send?.({
          embeds: [
            this._makeEmbed(
              "Reloaded",
              `Successfully reloaded \`${command.name}\`.`
            ),
          ],
        })
      );
    } catch (err) {
      return (
        ctx.reply?.({
          embeds: [
            this._makeEmbed(
              "Error",
              `Failed to reload \`${command.name}\`: ${String(
                err.message
              ).slice(0, 200)}`,
              0xed4245
            ),
          ],
        }) ||
        ctx.channel?.send?.({
          embeds: [
            this._makeEmbed(
              "Error",
              `Failed to reload \`${command.name}\`: ${String(
                err.message
              ).slice(0, 200)}`,
              0xed4245
            ),
          ],
        })
      );
    }
  }
};
