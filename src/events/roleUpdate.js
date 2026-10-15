/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class roleUpdate extends Event {
    get name() {
        return 'roleUpdate';
    }

    get once() {
        return false;
    }

    async run(oldRole, newRole) {
        try {
            const guildId = newRole?.guild?.id;
            if (!guildId) return;

            // Fast cache check
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiRoleUpdate === false) return;

            const logs = await newRole.guild.fetchAuditLogs({
                type: 31, // ROLE_UPDATE
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;
            if (log.target?.id !== newRole.id) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id || user.id === newRole.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiRoleUpdate")) return;

            // Synchronous hierarchy check
            const exeMember = newRole.guild.members.cache.get(user.id);
            const botMember = newRole.guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            await Promise.allSettled([
                newRole.edit({
                    name: oldRole.name,
                    color: oldRole.color,
                    hoist: oldRole.hoist,
                    mentionable: oldRole.mentionable,
                    permissions: oldRole.permissions,
                    reason: `Anti Role Update Revert | OnyxGuard Antinuke`,
                }).catch(() => {}),
                this.client.eventRestrict("ban", user.id, guildId, `Anti Role Update | OnyxGuard Antinuke`),
            ]);
        } catch (err) {
            // Silent
        }
    }
};
