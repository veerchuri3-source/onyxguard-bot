/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require('../abstract/event');
const { EmbedBuilder } = require('discord.js');

module.exports = class guildMemberRemove extends Event {
    get name() {
        return 'guildMemberRemove';
    }

    get once() {
        return false;
    }

    async run(member) {
        try {
            // ================= Leave / Goodbye Message =================
            try {
                const data = await this.client.database.guildData.get(member?.guild.id);
                if (data?.leave && data.leave.channel != null) {
                    let channel = member?.guild?.channels?.cache.get(data.leave.channel);
                    if (!channel && member?.guild?.channels) {
                        channel = await member.guild.channels.fetch(data.leave.channel).catch(() => null);
                    }
                    if (channel) {
                        const messageContent = data.leave.content;
                        let dataContent = await this.client.util.replaceOriginal(messageContent, member);
                        const embeds = data.leave.embeds;
                        let sendOptions = {};
                        if (dataContent && dataContent.trim().length > 0) {
                            sendOptions.content = dataContent;
                        }
                        if (embeds && typeof embeds === "object" && Object.keys(embeds).length > 0) {
                            let dataEmbed = await this.client.util.replacerOriginal(embeds, member);
                            if (dataEmbed && typeof dataEmbed === "object") {
                                // Sanitize URL fields to prevent Discord.js validation errors
                                if (dataEmbed.thumbnail && (!dataEmbed.thumbnail.url || !String(dataEmbed.thumbnail.url).startsWith("http"))) {
                                    delete dataEmbed.thumbnail;
                                }
                                if (dataEmbed.image && (!dataEmbed.image.url || !String(dataEmbed.image.url).startsWith("http"))) {
                                    delete dataEmbed.image;
                                }
                                if (dataEmbed.footer) {
                                    if (dataEmbed.footer.icon_url && !String(dataEmbed.footer.icon_url).startsWith("http")) delete dataEmbed.footer.icon_url;
                                    if (dataEmbed.footer.iconURL && !String(dataEmbed.footer.iconURL).startsWith("http")) delete dataEmbed.footer.iconURL;
                                    if (!dataEmbed.footer.text) delete dataEmbed.footer;
                                }
                                if (dataEmbed.author) {
                                    if (dataEmbed.author.icon_url && !String(dataEmbed.author.icon_url).startsWith("http")) delete dataEmbed.author.icon_url;
                                    if (dataEmbed.author.iconURL && !String(dataEmbed.author.iconURL).startsWith("http")) delete dataEmbed.author.iconURL;
                                    if (!dataEmbed.author.name) delete dataEmbed.author;
                                }
                                if (dataEmbed.url && !String(dataEmbed.url).startsWith("http")) {
                                    delete dataEmbed.url;
                                }

                                const hasEmbedContent = Boolean(
                                    dataEmbed.title ||
                                    dataEmbed.description ||
                                    dataEmbed.fields?.length ||
                                    dataEmbed.image ||
                                    dataEmbed.thumbnail ||
                                    dataEmbed.author ||
                                    dataEmbed.footer
                                );

                                if (hasEmbedContent) {
                                    try {
                                        sendOptions.embeds = [new EmbedBuilder(dataEmbed)];
                                    } catch (err) {
                                        console.error("Leave embed creation failed:", err);
                                    }
                                }
                            }
                        }
                        if (sendOptions.content || sendOptions.embeds?.length) {
                            await channel.send(sendOptions).catch((err) => {
                                console.error("Failed to send leave message to channel:", err);
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Leave handler error in guildMemberRemove:", e);
            }

            const guildId = member?.guild?.id;
            if (!guildId) return;

            // Cache-first
            let antiNukeData = await this.client.cache.get(guildId);
            if (!antiNukeData) {
                antiNukeData = await this.client.database.antiNukeData.get(guildId);
                if (antiNukeData) await this.client.cache.set(guildId, antiNukeData);
            }
            if (!antiNukeData || !antiNukeData.enabled) return;
            if (antiNukeData.features?.antiKick === false) return;

            const logs = await member.guild.fetchAuditLogs({
                type: 20, // MEMBER_KICK
                limit: 1,
            }).catch(() => null);

            const log = logs?.entries?.first();
            if (!log) return;
            if (Date.now() - log.createdTimestamp > 3000) return;

            const user = log.executor;
            if (!user) return;
            if (user.id === this.client.user.id) return;
            if (user.id === member.guild.ownerId) return;
            if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiKick")) return;

            // Synchronous role hierarchy check
            const exeMember = member.guild.members.cache.get(user.id);
            const botMember = member.guild.members.resolve(this.client.user?.id);
            if (exeMember && botMember && exeMember.roles.highest.position >= botMember.roles.highest.position) return;

            this.client.eventRestrict("ban", user.id, guildId, `Anti Member Kick | OnyxGuard Antinuke`);
            return;
        } catch (err) {
            return;
        }
    }
};
