/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class channelDelete extends Event {
    get name() {
        return 'channelDelete';
    }

    get once() {
        return false;
    }

    async run(channel) {
        try {
            const guildId = channel?.guild?.id;
            if (!guildId) return;

            // Fast cache check
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiChannelDelete === false) return;

            // Fetch audit log to identify executor first
            let logs = await channel.guild.fetchAuditLogs({
                type: 12, // CHANNEL_DELETE
                limit: 1,
            }).catch(() => null);

            let log = logs?.entries?.first();
            if (!log || (channel.id && log.target?.id !== channel.id && Date.now() - log.createdTimestamp > 3000)) {
                await new Promise((r) => setTimeout(r, 120));
                logs = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 }).catch(() => null);
                log = logs?.entries?.first();
            }

            const user = log?.executor;

            // If owner or bot itself: do NOT restore, do NOT ban
            if (user && (user.id === this.client.user.id || user.id === channel.guild.ownerId)) return;

            // If user is whitelisted for antiChannelDelete: do NOT restore, do NOT ban
            if (user && this.client.util.isWhitelisted(antiNukeData, user.id, "antiChannelDelete")) return;

            // Otherwise unauthorized delete: Restore channel & ban culprit
            const restorePromise = channel.clone({
                name: channel.name,
                topic: channel.topic ?? null,
                nsfw: channel.nsfw ?? false,
                bitrate: channel.bitrate ?? undefined,
                userLimit: channel.userLimit ?? undefined,
                rateLimitPerUser: channel.rateLimitPerUser ?? 0,
                position: channel.position ?? undefined,
                reason: "Anti Channel Delete Recovery | OnyxGuard Antinuke",
            }).catch(() => {});

            if (user) {
                const exeMember = channel.guild.members.cache.get(user.id);
                const botMember = channel.guild.members.resolve(this.client.user?.id);
                if (!(exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position)) {
                    await Promise.allSettled([
                        restorePromise,
                        this.client.eventRestrict("ban", user.id, guildId, `Anti Channel Delete | OnyxGuard Antinuke`),
                    ]);
                    return;
                }
            }
            await restorePromise;
        } catch (err) {
            // Silent
        }
    }
};
