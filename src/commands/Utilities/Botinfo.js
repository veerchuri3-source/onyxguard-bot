const Command = require("../../abstract/command");
const os = require("os");
const ms = require("ms");

module.exports = class Botinfo extends Command {
  constructor(...args) {
    super(...args, {
      name: "botinfo",
      aliases: ["bi"],
      description: "Get information about the bot.",
      category: "Utilities",
      usage: ["botinfo"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
      userPerms: ["ViewChannel", "SendMessages"],
      cooldown: 5,
      
    });
  }

  async fetchStats(client) {
    let totalGuilds = 0,
      totalUsers = 0;

    try {
      const guildResults = await client.Cluster.fetchClientValues(
        "guilds.cache.size"
      );
      totalGuilds = guildResults.reduce((prev, count) => prev + count, 0);

      const userResults = await client.Cluster.fetchClientValues(
        "users.cache.size"
      );
      totalUsers = userResults.reduce((prev, count) => prev + count, 0);
    } catch (err) {
      totalGuilds = client.guilds.cache.size;
      totalUsers = client.users.cache.size;
    }

    return { totalGuilds, totalUsers };
  }

  buildEmbed(client, totalGuilds, totalUsers, requester) {
    const uptime = ms(client.uptime, { long: true });
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    return this.client.util
      .embed()
      .setTitle("Hey , I'm OnyxGuard™")
      .setColor(0x2B2D31)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `A powerful multipurpose bot with Fastest Antinuke\n\n` +
        `• **Servers:** \`${totalGuilds.toLocaleString()}\` | **Users:** \`${totalUsers.toLocaleString()}\`\n` +
        `• **Ping:** \`${client.ws.ping}ms\` | **Uptime:** \`${uptime}\`\n` +
        `• **Commands:** \`${client.commands.size}\` | **Memory:** \`${memoryUsage} MB\`\n\n` +
        `• **System Highlights:**\n` +
        `> 🛡️ » **Antinuke:** Zero-latency gateway security\n` +
        `> 🤖 » **AutoMod:** Advanced filters & invite protection\n` +
        `> 🎫 » **Utility & Ticket:** Full server management\n\n` +
        `**🔗 Links**\n` +
        `[Invite Me](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/codexdev)`
      )
      .setFooter({
        text: "Powered By OnyxGuard Development™ | Designed By .1xylen",
        iconURL: requester.displayAvatarURL(),
      });
  }

  async run({ message }) {
    const { totalGuilds, totalUsers } = await this.fetchStats(this.client);
    const embed = this.buildEmbed(
      this.client,
      totalGuilds,
      totalUsers,
      message.author
    );

    message.channel.send({ embeds: [embed] });
  }

  async exec({ interaction }) {
    const { totalGuilds, totalUsers } = await this.fetchStats(this.client);
    const embed = this.buildEmbed(
      this.client,
      totalGuilds,
      totalUsers,
      interaction.user
    );

    interaction.reply({ embeds: [embed] });
  }
};
