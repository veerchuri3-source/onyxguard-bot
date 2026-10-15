/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class roleCreate extends Event {
    get name() {
        return 'roleCreate';
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
            if (antiNukeData.features?.antiRoleCreate === false) return;

            const logs = await role.guild.fetchAuditLogs({
                type: 30, // ROLE_CREATE
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id || user.id === role.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiRoleCreate")) return;

            // Synchronous hierarchy check
            const exeMember = role.guild.members.cache.get(user.id);
            const botMember = role.guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            // Parallel: delete unauthorized role and ban creator
            await Promise.allSettled([
                role.delete().catch(() => {}),
                this.client.eventRestrict("ban", user.id, guildId, `Anti Role Create | OnyxGuard Antinuke`),
            ]);
        } catch (err) {
            // Silent
        }
    }
};
