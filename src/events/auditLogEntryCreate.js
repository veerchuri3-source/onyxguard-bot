/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Event = require("../abstract/event");
const { EmbedBuilder } = require("discord.js");

module.exports = class GuildAuditLogEntryCreate extends Event {
    get name() {
        return 'guildAuditLogEntryCreate';
    }

    get once() {
        return false;
    }

    async run(entry, guild) {
        try {
            if (!entry) return;
            const guildId = guild?.id || entry.guildId || entry.guild?.id;
            if (!guildId) return;

            const executorId = entry.executorId || entry.executor?.id;
            if (!executorId) return;

            // Immediate ignore: Bot itself or Guild Owner
            const targetGuild = guild || this.client.guilds.cache.get(guildId);
            const ownerId = targetGuild?.ownerId;
            if (executorId === this.client.user?.id || executorId === ownerId) return;

            // Fast In-Memory Cache Check for Antinuke Data (sub-millisecond lookup)
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;

            // Fast synchronous Role Hierarchy Check (do NOT block on network fetch)
            if (targetGuild) {
                const exeMember = targetGuild.members.cache.get(executorId);
                const botMember = targetGuild.members.resolve(this.client.user?.id);
                if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) {
                    return; // Cannot ban member higher than or equal to bot
                }
            }

            const action = entry.action;
            const targetId = entry.targetId;

            // ─── 1. CHANNEL DELETE (Action 12) ──────────────────────────────
            if (action === 12) {
                if (antiNukeData.features?.antiChannelDelete === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiChannelDelete")) return;

                // INSTANT BAN
                this.client.eventRestrict("ban", executorId, guildId, "Anti Channel Delete | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "🗑️ Anti Channel Delete", executorId, `Deleted Channel ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 2. CHANNEL CREATE (Action 10) ──────────────────────────────
            if (action === 10) {
                if (antiNukeData.features?.antiChannelCreate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiChannelCreate")) return;

                // INSTANT BAN + DELETE UNAUTHORIZED CHANNEL IN PARALLEL
                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Channel Create | OnyxGuard Antinuke"),
                    targetId ? this.client.fastChannelDelete(targetId, "Anti Channel Create | OnyxGuard Antinuke") : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, "➕ Anti Channel Create", executorId, `Created Unauthorized Channel ID: \`${targetId}\`\n**Action:** Culprit Banned & Channel Deleted`);
                return;
            }

            // ─── 3. WEBHOOK CREATE / UPDATE / DELETE (Action 50, 51, 52) ────
            if (action === 50 || action === 51 || action === 52) {
                if (antiNukeData.features?.antiWebhook === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiWebhook")) return;

                const actionName = action === 50 ? "Create" : action === 51 ? "Update" : "Delete";

                // INSTANT BAN + DELETE UNAUTHORIZED WEBHOOK IN PARALLEL
                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, `Anti Webhook ${actionName} | OnyxGuard Antinuke`),
                    (action === 50 || action === 51) && targetId ? this.client.fastWebhookDelete(targetId, "Anti Webhook | OnyxGuard Antinuke") : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, `🌐 Anti Webhook ${actionName}`, executorId, `Webhook ID: \`${targetId}\`\n**Action:** Culprit Banned & Webhook Removed`);
                return;
            }

            // ─── 4. ROLE DELETE (Action 32) ─────────────────────────────────
            if (action === 32) {
                if (antiNukeData.features?.antiRoleDelete === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiRoleDelete")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Role Delete | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "❌ Anti Role Delete", executorId, `Deleted Role ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 5. ROLE CREATE (Action 30) ─────────────────────────────────
            if (action === 30) {
                if (antiNukeData.features?.antiRoleCreate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiRoleCreate")) return;

                // INSTANT BAN + DELETE UNAUTHORIZED ROLE IN PARALLEL
                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Role Create | OnyxGuard Antinuke"),
                    targetId ? this.client.fastRoleDelete(guildId, targetId, "Anti Role Create | OnyxGuard Antinuke") : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, "👑 Anti Role Create", executorId, `Created Unauthorized Role ID: \`${targetId}\`\n**Action:** Culprit Banned & Role Deleted`);
                return;
            }

            // ─── 6. ROLE UPDATE (Action 31) ─────────────────────────────────
            if (action === 31) {
                if (antiNukeData.features?.antiRoleUpdate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiRoleUpdate")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Role Update | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "📝 Anti Role Update", executorId, `Updated Role ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 7. CHANNEL UPDATE & OVERWRITES (Action 11, 13, 14, 15) ─────
            if (action === 11 || action === 13 || action === 14 || action === 15) {
                if (antiNukeData.features?.antiChannelUpdate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiChannelUpdate")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Channel Update | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "✏️ Anti Channel Update", executorId, `Modified Channel ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 8. MEMBER KICK (Action 20) ─────────────────────────────────
            if (action === 20) {
                if (antiNukeData.features?.antiKick === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiKick")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Member Kick | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "👢 Anti Member Kick", executorId, `Kicked Member ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 9. MEMBER BAN ADD (Action 22) ──────────────────────────────
            if (action === 22) {
                if (antiNukeData.features?.antiBan === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiBan")) return;

                // Ban the culprit and unban the victim in parallel
                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Member Ban | OnyxGuard Antinuke"),
                    targetId ? this.client.fastUnban(guildId, targetId, "Anti Ban Revocation | OnyxGuard Antinuke") : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, "🛡️ Anti Unauthorized Ban", executorId, `Banned Victim ID: \`${targetId}\`\n**Action:** Culprit Banned & Victim Unbanned`);
                return;
            }

            // ─── 10. MEMBER PRUNE (Action 21) ───────────────────────────────
            if (action === 21) {
                if (antiNukeData.features?.antiMemberPrune === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiMemberPrune")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Member Prune | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "🧹 Anti Member Prune", executorId, `Pruned Server Members\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 11. BOT ADD (Action 28 or 80) ──────────────────────────────
            if (action === 28 || action === 80) {
                if (antiNukeData.features?.antiBot === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiBot")) return;

                const botTargetId = targetId || entry.target?.id;
                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Bot Add | OnyxGuard Antinuke"),
                    botTargetId ? this.client.fastKick(guildId, botTargetId, "Anti Bot Add | OnyxGuard Antinuke") : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, "🤖 Anti Bot Add", executorId, `Added Unauthorized Bot ID: \`${botTargetId}\`\n**Action:** Bot Kicked & Inviter Banned`);
                return;
            }

            // ─── 12. GUILD UPDATE (Action 1) ────────────────────────────────
            if (action === 1) {
                if (antiNukeData.features?.antiGuildUpdate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiGuildUpdate")) return;

                this.client.eventRestrict("ban", executorId, guildId, "Anti Guild Update | OnyxGuard Antinuke");

                this._sendLog(targetGuild, antiNukeData.logchannelid, "🏢 Anti Guild Update", executorId, `Unauthorized Server Edits\n**Action:** Culprit Banned Instantly`);
                return;
            }

            // ─── 13. MEMBER BAN REMOVE (Action 23) ──────────────────────────
            if (action === 23) {
                if (antiNukeData.features?.antiUnban === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiUnban")) return;

                await Promise.allSettled([
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Member Unban | OnyxGuard Antinuke"),
                    targetId ? targetGuild.bans.create(targetId, { reason: "Anti Unban Re-ban | OnyxGuard Antinuke" }).catch(() => {}) : null,
                ]);

                this._sendLog(targetGuild, antiNukeData.logchannelid, "⚖️ Anti Member Unban", executorId, `Unbanned Member ID: \`${targetId}\`\n**Action:** Culprit Banned & Member Re-banned`);
                return;
            }

            // ─── 14. MEMBER UPDATE / MEMBER ROLE UPDATE (Action 24, 25) ─────
            if (action === 24 || action === 25) {
                if (antiNukeData.features?.antiMemberUpdate === false) return;
                if (this.client.util.isWhitelisted(antiNukeData, executorId, "antiMemberUpdate")) return;

                let isDangerous = false;
                if (action === 25 && Array.isArray(entry.changes)) {
                    const dangerousPerms = [
                        "Administrator", "ManageGuild", "ManageRoles",
                        "ManageChannels", "ManageMessages", "ManageWebhooks",
                        "BanMembers", "KickMembers"
                    ];
                    for (const change of entry.changes) {
                        if (change.key === "$add" && Array.isArray(change.new)) {
                            for (const r of change.new) {
                                const role = targetGuild.roles.cache.get(r.id);
                                if (role && role.permissions.toArray().some((p) => dangerousPerms.includes(p))) {
                                    isDangerous = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (isDangerous) {
                    this.client.eventRestrict("ban", executorId, guildId, "Anti Member Update | OnyxGuard Antinuke");
                    this._sendLog(targetGuild, antiNukeData.logchannelid, "👤 Anti Member Update", executorId, `Assigned Dangerous Permissions to Member ID: \`${targetId}\`\n**Action:** Culprit Banned Instantly`);
                    return;
                }
            }
        } catch (err) {
            console.error("[auditLogEntryCreate] error:", err);
        }
    }

    _sendLog(guild, logChannelId, title, executorId, details) {
        if (!guild || !logChannelId) return;
        const channel = guild.channels?.cache?.get(logChannelId);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`**Culprit:** <@${executorId}> (\`${executorId}\`)\n${details}`)
            .setColor(0xFF1744)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
};
