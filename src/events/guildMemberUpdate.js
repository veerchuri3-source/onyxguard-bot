/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");

module.exports = class guildMemberUpdate extends Event {
    get name() {
        return "guildMemberUpdate";
    }
    get once() {
        return false;
    }

    /**
     * @param {import('discord.js').GuildMember} oldMember
     * @param {import('discord.js').GuildMember} newMember
     */
    async run(oldMember, newMember) {
        // ─── Sticky Nickname ────────────────────────────────────────────────
        if (oldMember.nickname !== newMember?.nickname) {
            try {
                const data = await this.client.database.stickynickData.get(
                    newMember?.id,
                    newMember?.guild.id
                );
                if (data && newMember?.nickname !== data.nick) {
                    newMember?.setNickname(data.nick).catch(() => {});
                }
            } catch (_) {}
        }

        // ─── Antinuke: Anti Member Update ──────────────────────────────────
        try {
            const guildId = newMember?.guild?.id;
            if (!guildId) return;

            // Cache-first
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiMemberUpdate === false) return;

            // Only proceed if roles were ADDED
            const addedRoleIds = newMember?._roles?.filter((r) => !oldMember._roles?.includes(r));
            if (!addedRoleIds || addedRoleIds.length === 0) return;

            const dangerousPerms = [
                "Administrator",
                "ManageGuild",
                "ManageRoles",
                "ManageChannels",
                "ManageMessages",
                "ManageWebhooks",
                "BanMembers",
                "KickMembers",
            ];

            const addedRoles = newMember.guild.roles.cache.filter((r) => addedRoleIds.includes(r.id));
            const dangerousRoles = addedRoles.filter((r) =>
                r.permissions.toArray().some((p) => dangerousPerms.includes(p))
            );
            if (dangerousRoles.size === 0) return;

            // Fetch audit log (type 25 = MEMBER_ROLE_UPDATE)
            const logs = await newMember.guild.fetchAuditLogs({
                type: 25,
                limit: 1,
            }).catch(() => null);
            if (!logs) return;
            const log = logs.entries.first();
            if (!log) return;

            // Only act on recent logs (< 3s)
            if (Date.now() - log.createdTimestamp > 3000) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id) return;
            if (user.id === newMember.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiMemberUpdate")) return;

            // Role hierarchy check — don't touch users above bot
            const exeMember = newMember.guild.members.cache.get(user.id)
                || await newMember.guild.members.fetch(user.id).catch(() => null);
            const botMember = newMember.guild.members.resolve(this.client.user);

            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) {
                // Still strip the dangerous roles from the target member even if we can't ban the executor
                await newMember.roles.remove(dangerousRoles, `Anti Member Update | OnyxGuard`).catch(() => {});

                const logChannel = newMember.guild.channels.cache.get(antiNukeData.logchannelid);
                if (logChannel) {
                    const embed = this.client.util.embed()
                        .setTitle("⚠️ Anti Member Update (Executor Above Bot)")
                        .setDescription(
                            `**Executor:** ${user.tag} (${user.id})\n` +
                            `**Target:** ${newMember.user.tag} (${newMember.id})\n` +
                            `**Dangerous Roles Stripped:** ${dangerousRoles.map((r) => r.name).join(", ")}\n` +
                            `**Note:** Executor is above bot — could not ban.`
                        )
                        .setColor(this.client.ErrorColor)
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] }).catch(() => {});
                }
                return;
            }

            // Remove dangerous roles AND ban the executor
            await Promise.allSettled([
                newMember.roles.remove(dangerousRoles, `Anti Member Update | OnyxGuard`).catch(() => {}),
                this.client.eventRestrict("ban", user.id, guildId, `Anti Member Update | OnyxGuard Antinuke`),
            ]);

            // Log
            const logChannel = newMember.guild.channels.cache.get(antiNukeData.logchannelid);
            if (!logChannel) return;
            const embed = this.client.util.embed()
                .setTitle("🛡️ Anti Member Update")
                .setDescription(
                    `**Executor:** ${user.tag} (${user.id})\n` +
                    `**Target:** ${newMember.user.tag} (${newMember.id})\n` +
                    `**Dangerous Roles Stripped:** ${dangerousRoles.map((r) => r.name).join(", ")}\n` +
                    `**Action:** Roles removed & Executor banned`
                )
                .setColor(this.client.ErrorColor)
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        } catch (err) {
            // Silent — never crash
        }
    }
};
