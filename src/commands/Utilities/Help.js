const Command = require("../../abstract/command");
const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");

module.exports = class HelpCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "help",
      aliases: ["h", "commands"],
      description: "Get information about all commands.",
      usage: ["help", "help [command]"],
      category: "Utilities",
      examples: ["help"],
      userPerms: ["SendMessages"],
      guildOnly: true,
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
      cooldown: 5,
      slash: true,
      options: [
        {
          type: 3,
          name: "command",
          description: "Command or category name to get help for",
          required: false,
        },
      ],
    });

    // Categories
    this.categories = {
      Antinuke: [
        "antinuke enable",
        "antinuke disable",
        "whitelist",
        "vanityguard",
      ],
      AutoMod: [
        "automod enable",
        "automod disable",
        "automod status",
        "antilink",
        "antimention",
        "anticaps",
        "blacklistword",
        "resetautomod",
        "setupautomod",
      ],
      Fun: [
        "acceptmarry", "akinator", "blush", "bonk", "cry", "cuddle",
        "dance", "dare", "declinemarry", "divorce", "emojify", "fact",
        "feed", "gayrate", "gecg", "kill", "kiss", "lick", "marry",
        "matchpairs", "megumin", "meow", "minesweeper", "nom", "paranoia",
        "pat", "poke", "reaction", "rps", "ship", "simprate", "slap",
        "slot", "tictactoe", "truth", "wallpaper", "whatyourather", "wink", "woof",
      ],
      Giveaways: ["delete", "gend", "greroll", "snowflake", "gstart"],
      Moderation: [
        "ban", "clear", "hide", "kick", "lock", "nuke", "punishment",
        "role", "slowmode", "timeout", "unban", "unhide", "unlock", "unmute",
      ],
      Utilities: [
        "afk", "audit", "avatar", "banner", "blacklist", "botinfo", "embed",
        "intro", "invite", "inviteinfo", "managerrole", "membercount", "ping",
        "prefix", "premium", "presenceroles", "profile", "record", "roleicon",
        "rolesetup", "serverinfo", "setup", "starboard", "statusrole", "steal",
        "stickynick", "support", "translate", "userinfo", "variables", "vcrole",
        "youtube", "todo", "ce", "birthday",
      ],
      Welcome: ["autorole", "greet", "welcome", "leave"],
      Verification: [
        "verify setup", "verify fixperms", "verify ignore",
        "verify disable", "verify status", "reactionrole",
      ],
      Warn: [
        "warn @user [reason]",
        "warnpunish <warnCount> <action> [time in hours]",
        "clearcase @user",
        "casedelete @user",
        "case @user",
        "caseedit @user [reason]",
      ],
      Ticket: [
        "ticket setup", "ticket panel", "ticket close", "ticket add",
        "ticket remove", "ticket claim", "ticket transcript",
        "ticket status", "ticket disable",
      ],
    };

    // Category emojis
    this.categoryEmojis = {
      Antinuke:     "🛡️",
      AutoMod:      "🤖",
      Fun:          "🎉",
      Giveaways:    "🎁",
      Moderation:   "🔨",
      Utilities:    "⚙️",
      Welcome:      "👋",
      Verification: "✅",
      Warn:         "⚠️",
      Ticket:       "🎫",
    };

    // Category descriptions
    this.categoryDescriptions = {
      Antinuke:     "Protect your server from raids and suspicious activity.",
      AutoMod:      "Configure automatic moderation rules and filters.",
      Fun:          "Commands for entertainment and games.",
      Giveaways:    "Create and manage server giveaways.",
      Moderation:   "Tools for server moderation and management.",
      Utilities:    "General purpose commands and useful tools.",
      Welcome:      "Setup welcome/goodbye messages and autoroles.",
      Verification: "Setup advanced verification system with auto channel lock.",
      Warn:         "Manage warnings and cases for server moderation.",
      Ticket:       "Setup and manage private support ticket desk.",
    };
  }

  // ─────────────────────────────────────────────────────
  //  LINKS HELPER
  // ─────────────────────────────────────────────────────
  _getLinks() {
    const botId = this.client.user?.id || "1556216846188019712";
    return `[Invite Me](https://discord.com/oauth2/authorize?client_id=${botId}&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev) | [Website](https://docs.prismo.one)`;
  }

  // ─────────────────────────────────────────────────────
  //  MAIN HELP EMBED (Image 2 Style)
  // ─────────────────────────────────────────────────────
  _buildMainEmbed(prefix, totalCommands) {
    const moduleList = Object.keys(this.categories)
      .map((cat) => `> ${this.categoryEmojis[cat] || "📦"} » **${cat}**`)
      .join("\n");

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **My Prefix is** \`${prefix}\`\n` +
        `• **Total Commands:** \`${totalCommands}\`\n` +
        `• **Choose a Specific Module of your Desire**\n` +
        `${moduleList}\n\n` +
        `**🔗 Links**\n` +
        `${this._getLinks()}`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ─────────────────────────────────────────────────────
  //  CATEGORY EMBED
  // ─────────────────────────────────────────────────────
  _buildCategoryEmbed(category, prefix) {
    const categoryKey = Object.keys(this.categories).find(
      (k) => k.toLowerCase() === category.toLowerCase()
    ) || category;

    const commands = this.categories[categoryKey] || [];
    const emoji = this.categoryEmojis[categoryKey] || "📦";
    const desc = this.categoryDescriptions[categoryKey] || "Category commands.";

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Module:** ${emoji} \`${categoryKey}\`\n` +
        `• **Description:** ${desc}\n` +
        `• **Total Commands:** \`${commands.length}\`\n\n` +
        `• **Module Commands:**\n` +
        `> ${commands.map((cmd) => `\`${prefix}${cmd}\``).join(", ")}\n\n` +
        `**🔗 Links**\n` +
        `${this._getLinks()}`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ─────────────────────────────────────────────────────
  //  COMMAND EMBED
  // ─────────────────────────────────────────────────────
  _buildCommandEmbed(command, prefix) {
    const aliases = command.aliases?.length
      ? command.aliases.map((a) => `\`${a}\``).join(", ")
      : "`None`";

    const usage = command.usage?.length
      ? (Array.isArray(command.usage) ? command.usage : [command.usage])
          .map((u) => `\`${prefix}${u}\``)
          .join("\n> ")
      : `\`${prefix}${command.name}\``;

    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle("Hey , I'm OnyxGuard™")
      .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Command:** \`${command.name}\`\n` +
        `• **Category:** \`${command.category || "General"}\`\n` +
        `• **Aliases:** ${aliases}\n` +
        `• **Cooldown:** \`${command.cooldown || 3}s\`\n` +
        `• **Description:** ${command.description || "No description provided."}\n\n` +
        `• **Usage:**\n` +
        `> ${usage}\n\n` +
        `**🔗 Links**\n` +
        `${this._getLinks()}`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: this.client.user?.displayAvatarURL(),
      });
  }

  // ─────────────────────────────────────────────────────
  //  SELECT MENU COMPONENT
  // ─────────────────────────────────────────────────────
  _buildMenuRow(disabled = false) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_menu")
      .setPlaceholder("❯ Select Module From Here")
      .setMinValues(1)
      .setMaxValues(1)
      .setDisabled(disabled)
      .addOptions([
        {
          label: "Home",
          value: "home",
          emoji: "🏠",
          description: "Return to the main help menu",
        },
        ...Object.keys(this.categories).map((cat) => ({
          label: cat,
          value: cat.toLowerCase(),
          emoji: this.categoryEmojis[cat] || "📦",
          description: (this.categoryDescriptions[cat] || "Browse commands").slice(0, 50),
        })),
      ]);

    return new ActionRowBuilder().addComponents(selectMenu);
  }

  // ─────────────────────────────────────────────────────
  //  ENTRY POINTS
  // ─────────────────────────────────────────────────────
  async run({ message, args }) {
    await this.showHelp(message, args, false);
  }

  async exec({ interaction }) {
    const cmd = interaction.options?.getString("command");
    await this.showHelp(interaction, cmd ? [cmd] : [], true);
  }

  // ─────────────────────────────────────────────────────
  //  MAIN SHOW HELP
  // ─────────────────────────────────────────────────────
  async showHelp(ctx, args, isSlash) {
    const user = isSlash ? ctx.user : ctx.author;
    const guild = ctx.guild;
    guild.config = await this.client.database.guildData.get(guild.id);

    const totalCommands = this.client.commands?.size || 135;
    const prefix = guild.config?.prefix || this.client.config?.Client?.Prefix || "$";

    // Lookup specific category or command
    if (args && args.length > 0 && args[0]) {
      const query = args[0].toLowerCase();
      const matchedCategory = Object.keys(this.categories).find(
        (cat) => cat.toLowerCase() === query
      );

      if (matchedCategory) {
        const catEmbed = this._buildCategoryEmbed(matchedCategory, prefix);
        const row = this._buildMenuRow(false);

        const replyMsg = await (isSlash
          ? ctx.reply({ embeds: [catEmbed], components: [row], fetchReply: true, ephemeral: false })
          : ctx.reply({ embeds: [catEmbed], components: [row], fetchReply: true }));

        return this._attachCollector(replyMsg, user, prefix, totalCommands);
      }

      const command =
        this.client.commands.get(query) ||
        this.client.commands.get(this.client.aliases?.get(query));

      if (command) {
        const cmdEmbed = this._buildCommandEmbed(command, prefix);
        return isSlash
          ? ctx.reply({ embeds: [cmdEmbed], ephemeral: false })
          : ctx.reply({ embeds: [cmdEmbed] });
      }
    }

    // Default: Main help overview
    const mainEmbed = this._buildMainEmbed(prefix, totalCommands);
    const row = this._buildMenuRow(false);

    const replyMsg = await (isSlash
      ? ctx.reply({ embeds: [mainEmbed], components: [row], fetchReply: true, ephemeral: false })
      : ctx.reply({ embeds: [mainEmbed], components: [row], fetchReply: true }));

    this._attachCollector(replyMsg, user, prefix, totalCommands);
  }

  // ─────────────────────────────────────────────────────
  //  COLLECTOR
  // ─────────────────────────────────────────────────────
  _attachCollector(replyMsg, user, prefix, totalCommands) {
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300000,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.user.id !== user.id) {
          return interaction.reply({
            content: "❌ You cannot control this help menu.",
            ephemeral: true,
          });
        }

        const sel = interaction.values[0];
        if (sel === "home") {
          const mainEmbed = this._buildMainEmbed(prefix, totalCommands);
          return interaction.update({
            embeds: [mainEmbed],
            components: [this._buildMenuRow(false)],
          });
        }

        const catEmbed = this._buildCategoryEmbed(sel, prefix);
        return interaction.update({
          embeds: [catEmbed],
          components: [this._buildMenuRow(false)],
        });
      } catch (err) {
        console.error("Help menu interaction error:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await replyMsg.edit({ components: [this._buildMenuRow(true)] }).catch(() => {});
      } catch (_) {}
    });
  }
};
