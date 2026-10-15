/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class roleDelete extends Event {
    get name() {
        return 'roleDelete';
    }

    get once() {
        return false;
    }

    async run(role) {
        try {
            const guildId = role?.guild?.id;
            if (!guildId) return;

            // Fast cache check
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiRoleDelete === false) return;

            // Fetch audit log to identify executor first
            let logs = await role.guild.fetchAuditLogs({
                type: 32, // ROLE_DELETE
                limit: 1,
            }).catch(() => null);

            let log = logs?.entries?.first();
            if (!log || (role.id && log.target?.id !== role.id && Date.now() - log.createdTimestamp > 3000)) {
                await new Promise((r) => setTimeout(r, 120));
                logs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 }).catch(() => null);
                log = logs?.entries?.first();
            }

            const user = log?.executor;

            // If owner or bot itself: do NOT restore, do NOT ban
            if (user && (user.id === this.client.user.id || user.id === role.guild.ownerId)) return;

            // If user is whitelisted for antiRoleDelete: do NOT restore, do NOT ban
            if (user && this.client.util.isWhitelisted(antiNukeData, user.id, "antiRoleDelete")) return;

            // Otherwise unauthorized delete: Recreate role & ban culprit
            const restorePromise = role.guild.roles.create({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permissions,
                position: role.position,
                reason: `Anti Role Delete Recovery | OnyxGuard Antinuke`,
            }).catch(() => {});

            if (user) {
                const exeMember = role.guild.members.cache.get(user.id);
                const botMember = role.guild.members.resolve(this.client.user?.id);
                if (!(exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position)) {
                    await Promise.allSettled([
                        restorePromise,
                        this.client.eventRestrict("ban", user.id, guildId, `Anti Role Delete | OnyxGuard Antinuke`),
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
