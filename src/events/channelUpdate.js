/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class channelUpdate extends Event {
    get name() {
        return 'channelUpdate';
    }

    get once() {
        return false;
    }

    async run(oldChannel, newChannel) {
        try {
            const guildId = newChannel?.guild?.id;
            if (!guildId) return;

            // Fast cache check
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiChannelUpdate === false) return;

            const logs = await newChannel.guild.fetchAuditLogs({
                type: 11, // CHANNEL_UPDATE
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;
            if (log.target?.id !== newChannel.id) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id || user.id === newChannel.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiChannelUpdate")) return;

            // Synchronous hierarchy check
            const exeMember = newChannel.guild.members.cache.get(user.id);
            const botMember = newChannel.guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            await Promise.allSettled([
                this.client.eventRestrict("ban", user.id, guildId, `Anti Channel Update | OnyxGuard Antinuke`),
                newChannel.edit({
                    name: oldChannel.name,
                    topic: oldChannel.topic ?? null,
                    nsfw: oldChannel.nsfw,
                    rateLimitPerUser: oldChannel.rateLimitPerUser,
                    reason: `Anti Channel Update Revert | OnyxGuard Antinuke`,
                }).catch(() => {}),
            ]);
        } catch (err) {
            // Silent
        }
    }
};
