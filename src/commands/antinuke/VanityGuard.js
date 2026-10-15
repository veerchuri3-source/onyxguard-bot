const Command = require("../../abstract/command");
const { EmbedBuilder } = require("discord.js");

module.exports = class VanityGuard extends Command {
  constructor(...args) {
    super(...args, {
      name: "vanityguard",
      aliases: ["antivanity"],
      description: "Protects your server's vanity URL raiders/nukers",
      usage: ["vanityguard <enable/disable>"],
      category: "Moderation",
      userPerms: ["Administrator"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages", "Administrator"],
      cooldown: 5,
      premium: false,
      options: [
        { type: 1, name: "enable", description: "Enable Vanity Guard" },
        { type: 1, name: "disable", description: "Disable Vanity Guard" },
      ],
    });
  }

  async run(ctx) {
    return this.handleCommand(ctx, ctx.message, ctx.args);
  }

  async exec(ctx) {
    const sub = ctx.interaction.options.getSubcommand();
    return this.handleCommand(ctx, ctx.interaction, [sub]);
  }

  async handleCommand({ message, interaction }, origin, args) {
    const guild = origin.guild;
    const author = origin.user ?? origin.author;
    const reply = (data) =>
      interaction
        ? interaction.reply({ ...data, ephemeral: false })
        : origin.channel.send(data);

    try {
      let antiNukeData = await this.client.database.antiNukeData.get(guild.id);
      let oscheck = this.client.util.checkOwner(author.id);

      if (!oscheck && author.id !== guild.ownerId) {
        return reply({
          content: "Only the **server owner** can use this command.",
        });
      }

      const sub = args[0]?.toLowerCase();
      if (!sub) {
        const isArmed = Boolean(antiNukeData.antivanity);
        const embed = new EmbedBuilder()
          .setColor(0x2B2D31)
          .setTitle("Hey , I'm OnyxGuard™")
          .setThumbnail(this.client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `A powerful server protection system with Fastest Antinuke\n\n` +
            `• **System:** Vanity Guard — ${guild.name}\n` +
            `• **Status:** ${isArmed ? "`Armed & Enforcing 🟢`" : "`Disabled 🔴`"}\n` +
            `• **Log Channel:** ${antiNukeData.logchannelid ? `<#${antiNukeData.logchannelid}>` : "`None`"}\n` +
            `• **Whitelisted Users:** ${this.client.util.getWhitelistUserIds(antiNukeData).length ? this.client.util.getWhitelistUserIds(antiNukeData).map((x) => `<@${x}>`).join(", ") : "`None`"}\n\n` +
            `**🔗 Links**\n` +
            `[Invite Me](https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
          )
          .setFooter({
            text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
            iconURL: this.client.user?.displayAvatarURL(),
          });
        return reply({ embeds: [embed] });
      }

      if (sub === "enable")
        return this.enableGuard(reply, guild, author, antiNukeData, oscheck);
      if (sub === "disable")
        return this.disableGuard(reply, guild, antiNukeData);
    } catch (e) {
      console.error("VanityGuard error:", e);
    }
  }

  async enableGuard(reply, guild, author, antiNukeData, oscheck) {
    if (!guild.vanityURLCode)
      return reply({
        embeds: [
          this.client.util
            .embed()
            .setDescription("❌ | This server doesn't have a **vanity URL**.")
            .setColor(this.client.PrimaryColor),
        ],
      });

    if (!antiNukeData.enabled)
      return reply({
        embeds: [
          this.client.util
            .embed()
            .setDescription("❌ | Please enable **Anti Nuke** first.")
            .setColor(this.client.PrimaryColor),
        ],
      });

    if (antiNukeData.antivanity)
      return reply({
        embeds: [
          this.client.util
            .embed()
            .setDescription("✅ | Vanity Guard is already **enabled**.")
            .setColor(this.client.PrimaryColor),
        ],
      });

    if (!oscheck && guild.memberCount < 25)
      return reply({
        embeds: [
          this.client.util
            .embed()
            .setDescription(
              "Vanity Guard can only be enabled on servers with **25+ members**."
            )
            .setColor(this.client.PrimaryColor),
        ],
      });

    // Ask confirmation
    const msg = await reply({
      content:
        "- Synapse will add an external Discord account to your server and grant it **permission** to protect your vanity.\n\n" +
        "- **Use of external account:** It will rewrite your original vanity if anyone tries to change it.",
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Yes", custom_id: "yes" },
            { type: 2, style: 4, label: "No", custom_id: "no" },
          ],
        },
      ],
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === author.id,
      time: 25000,
    });

    collector.once("collect", async (i) => {
      if (i.customId === "yes") {
        await i.deferUpdate();
        await msg.delete();

        const position = guild.members.me.roles.highest.position;
        const Synapserole = await guild.roles.create({
          name: "Synapse Vanity Guard",
          icon: "https://cdn.discordapp.com/emojis/1106917452165697546.png",
          permissions: ["Administrator"],
          position,
          reason: "Synapse Vanity Guard | Synapse Antinuke",
        });

        await this.client.util.joinguild(guild);
        await guild.members.me.roles.add(Synapserole.id);

        await this.sleep(5000);

        try {
          const user = await guild.members.fetch(
            this.client.config.Client.VanityGuard
          );
          await user.roles.add(Synapserole.id);
        } catch { }

        antiNukeData.Synapserole = Synapserole.id;
        antiNukeData.antivanity = true;
        await this.client.database.antiNukeData.post(guild.id, antiNukeData);

        return reply({
          embeds: [
            this.client.util
              .embed()
              .setDescription("✅ | Vanity Guard has been **enabled**.")
              .setColor(this.client.PrimaryColor),
          ],
        });
      } else {
        await i.update({ content: "Cancelled the command.", components: [] });
      }
    });

    collector.once("end", async (collected) => {
      if (collected.size === 0) {
        await msg.edit({ content: "Timed out.", components: [] });
      }
    });
  }

  async disableGuard(reply, guild, antiNukeData) {
    if (!antiNukeData.antivanity)
      return reply({
        embeds: [
          this.client.util
            .embed()
            .setDescription("✅ | Vanity Guard is already **disabled**.")
            .setColor(this.client.PrimaryColor),
        ],
      });

    try {
      const role = guild.roles.cache.get(antiNukeData.Synapserole);
      if (role) await role.delete();
    } catch (e) { }

    antiNukeData.antivanity = false;
    antiNukeData.Synapserole = "";
    await this.client.database.antiNukeData.post(guild.id, antiNukeData);

    return reply({
      embeds: [
        this.client.util
          .embed()
          .setDescription("✅ | Vanity Guard has been **disabled**.")
          .setColor(this.client.PrimaryColor),
      ],
    });
  }

  async sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
};
