/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 */
const Event = require("../abstract/event");
const { EmbedBuilder } = require("discord.js");

module.exports = class guildBanRemove extends Event {
  get name() {
    return 'guildBanRemove';
  }

  get once() {
    return false;
  }

  async run(ban) {
    try {
      const guild = ban?.guild;
      if (!guild) return;
      const guildId = guild.id;

      let antiNukeData = (await this.client.cache.get(guildId)) || (await this.client.database.antiNukeData.get(guildId));
      if (!antiNukeData || !antiNukeData.enabled) return;
      if (antiNukeData.features && antiNukeData.features.antiUnban === false) return;

      const logs = await guild.fetchAuditLogs({
        type: 23, // MEMBER_BAN_REMOVE
        limit: 1,
      }).catch(() => null);

      const log = logs?.entries?.first();
      if (!log) return;

      const user = log.executor;
      if (!user) return;
      if (user.id === this.client.user.id || user.id === guild.ownerId) return;
      if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiUnban")) return;

      // Hierarchy check
      const exeMember = guild.members.cache.get(user.id);
      const botMember = guild.members.resolve(this.client.user?.id);
      if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

      const reason = `Anti Unban | OnyxGuard Antinuke`;

      await Promise.allSettled([
        this.client.eventRestrict("ban", user.id, guildId, reason).catch(() => {}),
        guild.bans.create(ban.user.id, { reason: `Anti Unban Re-ban | OnyxGuard Antinuke` }).catch(() => {}),
      ]);

      if (antiNukeData?.logchannelid) {
        const logChannel = guild.channels.cache.get(antiNukeData.logchannelid);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor(0xFF1744)
            .setTitle("⚖️ Antinuke Alert: Unauthorized Unban Detected")
            .setDescription(
              `**Culprit:** ${user.tag} (${user.id})\n` +
                `**Target User:** ${ban.user?.tag || "Unknown"} (${ban.user?.id})\n` +
                `**Action Taken:** Culprit Banned & Target User Re-banned`
            )
            .setTimestamp();
          logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("guildBanRemove error:", err);
    }
  }
};
