/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require('../abstract/event');

module.exports = class webhookUpdate extends Event {
    get name() {
        return 'webhooksUpdate';
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
            if (antiNukeData.features?.antiWebhook === false) return;

            // Fetch audit log to identify executor first
            const logs = await channel.guild.fetchAuditLogs({
                type: 50, // WEBHOOK_CREATE
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id || user.id === channel.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiWebhook")) return;

            // Synchronous hierarchy check
            const exeMember = channel.guild.members.cache.get(user.id);
            const botMember = channel.guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            // Unauthorized: purge webhooks and ban culprit
            const purgeWebhooksPromise = channel.fetchWebhooks().then((webhooks) => {
                if (!webhooks || !webhooks.size) return;
                const deletions = [];
                for (const webhook of webhooks.values()) {
                    deletions.push(webhook.delete("Anti Webhook | OnyxGuard Antinuke").catch(() => {}));
                }
                return Promise.allSettled(deletions);
            }).catch(() => null);

            await Promise.allSettled([
                purgeWebhooksPromise,
                this.client.eventRestrict("ban", user.id, guildId, `Anti Webhook | OnyxGuard Antinuke`),
            ]);
        } catch (err) {
            // Silent
        }
    }
};
