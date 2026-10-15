/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class channelCreate extends Event {
    get name() {
        return 'channelCreate';
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

            if (antiNukeData && antiNukeData.enabled && antiNukeData.features?.antiChannelCreate !== false) {
                // Fetch creator audit log
                const logs = await channel.guild.fetchAuditLogs({
                    type: 10, // CHANNEL_CREATE
                    limit: 1,
                }).catch(() => null);

                const log = logs?.entries?.first();
                if (log) {
                    const user = log.executor;
                    if (
                        user &&
                        user.id !== this.client.user.id &&
                        user.id !== channel.guild.ownerId &&
                        !this.client.util.isWhitelisted(antiNukeData, user.id, "antiChannelCreate")
                    ) {
                        // Synchronous hierarchy check
                        const exeMember = channel.guild.members.cache.get(user.id);
                        const botMember = channel.guild.members.resolve(this.client.user?.id);

                        if (!(exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position)) {
                            // Parallel: delete unauthorized channel and ban creator immediately
                            await Promise.allSettled([
                                this.client.eventRestrict("ban", user.id, guildId, `Anti Channel Create | OnyxGuard Antinuke`),
                                channel.delete(`Anti Channel Create | OnyxGuard Antinuke`).catch(() => {}),
                            ]);
                            return;
                        }
                    }
                }
            }

            // Auto-hide newly created channels from unverified members if verification is active
            const verification = await this.client.database.guildVerificationData.get(guildId).catch(() => null);
            if (verification && verification.enabled && channel.id !== verification.channel) {
                const unverifiedRoleId = verification.unverifiedRole;
                if (unverifiedRoleId && channel.permissionOverwrites) {
                    await channel.permissionOverwrites.edit(unverifiedRoleId, {
                        ViewChannel: false,
                    }).catch(() => {});
                }
            }
        } catch (err) {
            // Silent
        }
    }
};
