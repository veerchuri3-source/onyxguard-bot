const Command = require("../../abstract/command");
const { EmbedBuilder } = require("discord.js");

module.exports = class Ping extends Command {
  constructor(...args) {
    super(...args, {
      name: "ping",
      aliases: ["ping"],
      description: "Shows bot latency information",
      usage: ["ping"],
      category: "Utilities",
      examples: ["ping"],
      userPerms: ["SendMessages"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
      cooldown: 5,
      
      guildOnly: true,
    });
  }

  async run({ message }) {
    const msg = await message.channel.send("🏓 Pinging...");

    // Calculate different latencies
    const botLatency = msg.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(this.client.ws.ping);

    const dbStart = Date.now();
    await this.client.database.guildData.get(message.guild.id);
    const dbLatency = Date.now() - dbStart;

    const msgLatency = Date.now() - msg.createdTimestamp;

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("🏓 Pong!!!")
      .addFields(
        { name: "Bot Latency", value: `\`${botLatency}ms\``, inline: true },
        { name: "API Latency", value: `\`${apiLatency}ms\``, inline: true },
        { name: "Database Latency", value: `\`${dbLatency}ms\``, inline: true },
        { name: "Message Latency", value: `\`${msgLatency}ms\``, inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    msg.edit({ content: " ", embeds: [embed] });
  }

  async exec({ interaction }) {
    const sent = await interaction.reply({
      content: "🏓 Pinging...",
      fetchReply: true,
    });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(this.client.ws.ping);

    const dbStart = Date.now();
    await this.client.database.guildData.get(interaction.guild.id);
    const dbLatency = Date.now() - dbStart;

    const msgLatency = Date.now() - sent.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Bot Latency", value: `\`${botLatency}ms\``, inline: true },
        { name: "API Latency", value: `\`${apiLatency}ms\``, inline: true },
        { name: "Database Latency", value: `\`${dbLatency}ms\``, inline: true },
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ content: " ", embeds: [embed] });
  }
};
