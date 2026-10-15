/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { EmbedBuilder } = require("discord.js");
module.exports = class guildMemberAdd extends Event {
    get name() {
        return "guildMemberAdd";
    }
    get once() {
        return false;
    }
    async run(member) {
        try {
            if (member?.user.bot) {
                const guildId = member?.guild.id;
                let antiNukeData = await this.client.cache.get(guildId) || await this.client.database.antiNukeData.get(guildId);
                if (!antiNukeData || !antiNukeData.enabled) return;
                if (antiNukeData.features && antiNukeData.features.antiBot === false) return;

                const logs = await member?.guild
                    ?.fetchAuditLogs({
                        type: 28,
                        limit: 1,
                    })
                    .catch(() => null);
                const log = logs?.entries?.first();
                if (!log) return;
                let user = log.executor;
                if (!user) return;
                if (user.id === this.client.user.id) return;
                if (user.id === member?.guild?.ownerId) return;
                if (this.client.util.isWhitelisted(antiNukeData, user.id, "antiBot")) return;
                if (member?.id !== log.target?.id) return;

                member?.kick("Anti Bot Add | OnyxGuard Antinuke").catch(() => {});
                this.client.eventRestrict("ban", user.id, member?.guild.id, `Anti Bot Add | OnyxGuard Antinuke`);
                let logChannel = member?.guild.channels.cache.get(antiNukeData.logchannelid);
                if (!logChannel) return;
                const embed = this.client.util
                    .embed()
                    .setTitle(`Anti Bot Add`)
                    .setDescription(`**User:** ${user.username} (${user.id})\n**Member:** ${member?.user.username} (${member?.id})\n**Action:** Kicked`)
                    .setColor(this.client.ErrorColor)
                    .setTimestamp();
                logChannel?.send({ embeds: [embed] }).catch(() => {});
                return;
            }
            const data = await this.client.database.guildData.get(member?.guild.id);
            if (data.welcome.channel != null) {
                const channel = member?.guild?.channels?.cache.get(data.welcome.channel);
                if (!channel) return;
                const messageContent = data.welcome.content;
                let dataContent = await this.client.util.replaceOriginal(messageContent, member);
                let sendPayload = {};
                if (dataContent && dataContent.trim().length > 0) {
                    sendPayload.content = dataContent;
                }
                const embeds = data.welcome.embeds;
                if (embeds && Object.keys(embeds).length > 0) {
                    const dataEmbed = await this.client.util.replacerOriginal(embeds, member);
                    if (dataEmbed && (dataEmbed.title || dataEmbed.description || dataEmbed.author || dataEmbed.fields?.length || dataEmbed.image || dataEmbed.thumbnail)) {
                        sendPayload.embeds = [new EmbedBuilder(dataEmbed)];
                    }
                }
                if (sendPayload.content || sendPayload.embeds) {
                    channel.send(sendPayload).catch((e) => {
                        console.log(e);
                    });
                }
            }
            if (data.autorole.enabled) {
                if (member?.user.bot) {
                    const roles = data.autorole.botRoles;
                    if (roles.length == 0) return;
                    member?.roles.add(roles, `Auto Role System | ${this.client.user.username}`);
                } else {
                    const roles = data.autorole.humanRoles;
                    if (roles.length == 0) return;
                    member?.roles.add(roles, `Auto Role System | ${this.client.user.username}`);
                }
            }

            // Automatically assign Unverified to new members in configured servers.
            if (!member?.user.bot) {
                try {
                    const verification = await this.client.database.guildVerificationData.get(member?.guild?.id).catch(() => null);
                    if (verification && verification.enabled) {
                        let role = null;
                        if (verification.unverifiedRole) {
                            role = member.guild.roles.cache.get(verification.unverifiedRole) ||
                                (await member.guild.roles.fetch(verification.unverifiedRole).catch(() => null));
                        }
                        if (!role) {
                            role = member.guild.roles.cache.find(
                                (r) => r.name.toLowerCase() === "unverified"
                            );
                        }

                        if (role && !member.roles.cache.has(role.id)) {
                            await member.roles.add(role, "New member verification required").catch(() => {});
                        }
                    }
                } catch (error) {
                    console.error(
                        `[${member.guild.name}] Auto-role error:`,
                        error
                    );
                }
            }
            if (data.greet.enabled) {
                const channel = data.greet.channel;
                const messageContent = data.greet.content;
                const dataContent = await this.client.util.replaceOriginal(messageContent, member);
                channel.forEach(async (c) => {
                    const channel = member?.guild.channels.cache.get(c);
                    if (!channel) return;
                    channel
                        ?.send(dataContent)
                        .then((m) => {
                            setTimeout(() => {
                                m.delete();
                            }, data.greet.deletetime);
                        })
                        .catch((e) => {
                            return;
                        });
                });
            }
        } catch (error) {
            return;
        }
    }
};
