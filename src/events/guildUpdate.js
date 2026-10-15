/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class guildUpdate extends Event {
    get name() {
        return "guildUpdate";
    }

    get once() {
        return false;
    }

    async run(oldGuild, newGuild) {
        try {
            const guildId = newGuild?.id;
            if (!guildId) return;

            // Cache-first
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiGuildUpdate === false) return;

            const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

            const logs = await newGuild.fetchAuditLogs({ type: 1, limit: 1 }).catch(() => null);
            let log = logs?.entries?.first();
            if (!log || log.createdTimestamp < twoMinutesAgo) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id) return;
            if (user.id === newGuild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiGuildUpdate")) return;

            // Synchronous role hierarchy check
            const exeMember = newGuild.members.cache.get(user.id);
            const botMember = newGuild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            // Vanity URL change — special handling
            if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
                if (user.id === this.client.config?.Client?.VanityGuard) return;
                this.client.util.updateVanity(newGuild, oldGuild.vanityURLCode);
                this.client.eventRestrict("ban", user.id, guildId, `Anti Guild Vanity Update | OnyxGuard Antinuke`);
                return;
            }

            // General guild setting change — revert and ban
            const options = {
                name: oldGuild.name,
                verificationLevel: oldGuild.verificationLevel,
                explicitContentFilter: oldGuild.explicitContentFilter,
                afkTimeout: oldGuild.afkTimeout,
                description: oldGuild.description,
                preferredLocale: oldGuild.preferredLocale,
                reason: `Anti Guild Update | OnyxGuard Antinuke`,
            };
            if (oldGuild.systemChannel) options.systemChannel = oldGuild.systemChannel;
            if (oldGuild.afkChannel) options.afkChannel = oldGuild.afkChannel;
            if (oldGuild.rulesChannel) options.rulesChannel = oldGuild.rulesChannel;
            if (oldGuild.publicUpdatesChannel) options.publicUpdatesChannel = oldGuild.publicUpdatesChannel;
            if (oldGuild.widgetChannel) options.widgetChannel = oldGuild.widgetChannel;
            if (oldGuild.systemChannelFlags) options.systemChannelFlags = oldGuild.systemChannelFlags;
            if (oldGuild.publicUpdatesChannelId) options.publicUpdatesChannelId = oldGuild.publicUpdatesChannelId;

            await Promise.allSettled([
                newGuild.edit(options).catch(() => {}),
                this.client.eventRestrict("ban", user.id, guildId, `Anti Guild Update | OnyxGuard Antinuke`),
            ]);
        } catch (err) {
            // Silent
        }
    }
};
