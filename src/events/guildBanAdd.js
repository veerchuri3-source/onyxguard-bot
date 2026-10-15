/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");
const { EmbedBuilder } = require("discord.js");

module.exports = class guildBanAdd extends Event {
    get name() {
        return 'guildBanAdd';
    }

    get once() {
        return false;
    }

    async run(ban) {
        try {
            const guild = ban?.guild;
            if (!guild) return;
            const guildId = guild.id;

            // Fast cache check for AntiNuke
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiBan === false) return;

            const logs = await guild.fetchAuditLogs({
                type: 22, // MEMBER_BAN_ADD
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id || user.id === guild.ownerId) return;

            // Whitelist check
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiBan")) return;

            // Synchronous hierarchy check
            const exeMember = guild.members.cache.get(user.id);
            const botMember = guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            const reason = `Anti Ban | OnyxGuard Antinuke`;

            // Parallel: ban culprit + unban victim
            await Promise.allSettled([
                this.client.eventRestrict("ban", user.id, guildId, reason),
                this.client.fastUnban(guildId, ban.user.id, `Anti Ban Revocation | ${reason}`),
            ]);

            // Alerts
            if (antiNukeData.logchannelid) {
                const logChannel = guild.channels.cache.get(antiNukeData.logchannelid);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF1744)
                        .setTitle("🛡️ Antinuke Alert: Unauthorized Ban Detected")
                        .setDescription(
                            `**Culprit:** ${user.tag} (${user.id})\n` +
                            `**Victim:** ${ban.user?.tag || "Unknown"} (${ban.user?.id})\n` +
                            `**Action Taken:** Culprit Banned & Victim Unbanned`
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error("guildBanAdd error:", err);
        }
    }
};
