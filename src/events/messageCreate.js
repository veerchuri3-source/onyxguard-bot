/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { Collection } = require("@discordjs/collection");
module.exports = class messageCreate extends Event {
    constructor(...args) {
        super(...args);
        this.ratelimits = new Collection();
        this.spamMap = new Collection();
    }
    get name() {
        return "messageCreate";
    }
    get once() {
        return false;
    }
    async run(message) {
        try {
            if (!message.guild) return;
            const afkdata = await this.client.database.afkData.get(message?.author.id);
            if(afkdata) {
                await this.client.database.afkData.deleteAfk(message.author.id);
                return message?.channel.send(`**${message.author.username}**, Your AFK has been removed!`);
            }
            if (message.content.includes("@everyone") || message.content.includes("@here")) {
                let antiNukeData = await this.client.cache.get(message?.guild.id);
                if (!antiNukeData) {
                    antiNukeData = await this.client.database.antiNukeData.get(message?.guild.id);
                    await this.client.cache.set(message?.guild.id, antiNukeData);
                }
                if (!antiNukeData || !antiNukeData.enabled) return;
                if (antiNukeData.features && antiNukeData.features.antiPing === false) return;
                if (message.author.id == this.client.user.id) return;
                if (message?.author.id == message?.guild?.ownerId) return;
                if (this.client.util.isWhitelisted(antiNukeData, message.author.id, "antiPing")) return;

                message.delete().catch(() => {});
                await Promise.allSettled([
                    this.client.eventRestrict("ban", message.author.id, message?.guild.id, `Anti Mass Mention | OnyxGuard Antinuke`),
                ]);
            }
            if (message?.author.bot || message?.channel.type == 1) return;

            // ================= AutoMod Message Protection =================
            if (message.guild && message.member) {
              let autoModData = (await this.client.cache.get("automod_" + message.guild.id)) ||
                (await this.client.database.autoModData.get(message.guild.id));

              let antiNukeData = (await this.client.cache.get(message.guild.id)) ||
                (await this.client.database.antiNukeData.get(message.guild.id));

              const isAutoModActive = Boolean(
                autoModData && (
                  autoModData.enabled !== false ||
                  autoModData.features?.antiLink !== false ||
                  autoModData.features?.antiCaps !== false ||
                  autoModData.features?.antiSpam !== false ||
                  autoModData.features?.antiMention !== false ||
                  autoModData.features?.antiWord !== false
                )
              );

              if (isAutoModActive) {
                const isImmune =
                  message.author.id === this.client.user.id ||
                  (Array.isArray(autoModData.whitelistroles) && message.member.roles.cache.some((r) => autoModData.whitelistroles.includes(r.id)));

                if (!isImmune) {
                  let actionTaken = false;

                  const isFeatureWhitelisted = (perm) => {
                    return this.client.util.isWhitelisted(antiNukeData, message.author.id, perm) ||
                      (autoModData.whitelistusers && autoModData.whitelistusers.includes(message.author.id));
                  };

                  // 1. Anti Link
                  const antiLinkEnabled = autoModData.features?.antiLink !== false;

                  if (antiLinkEnabled && !isFeatureWhitelisted("antiLink")) {
                    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|discord\.(gg|io|me|li)\/[^\s]+|discordapp\.com\/invite\/[^\s]+|discord\.com\/invite\/[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|xyz|gg|app|me|co|info|biz|ru|uk|de|online|site|store|tech)\b[^\s]*)/i;
                    if (linkRegex.test(message.content)) {
                      actionTaken = true;
                      message.delete().catch(() => {});

                      let timedOut = false;
                      let timeoutError = "";
                      try {
                        if (message.member && message.author.id !== message.guild.ownerId) {
                          await message.member.timeout(300000, "AutoMod: Posting Unauthorized Links");
                          timedOut = true;
                        } else if (message.author.id === message.guild.ownerId) {
                          timeoutError = " *(Server Owner cannot be timed out by Discord)*";
                        }
                      } catch (err) {
                        timedOut = false;
                        timeoutError = " *(Cannot timeout: member has Administrator or higher role)*";
                      }

                      const notice = timedOut
                        ? `⚡ ${message.author} has been timed out for 5 minutes for posting links!`
                        : `🚫 ${message.author}, links are not allowed here!${timeoutError}`;

                      message.channel.send(notice).then((m) => {
                        setTimeout(() => m.delete().catch(() => {}), 6000);
                      });

                      if (autoModData.logchannelid) {
                        const logCh = message.guild.channels.cache.get(autoModData.logchannelid);
                        if (logCh) {
                          const embed = this.client.util.embed()
                            .setColor("#ff3344")
                            .setTitle("🔗 AutoMod: Unauthorized Link Detected")
                            .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Action:** Message Deleted ${timedOut ? "& 5-minute Timeout" : ""}\n**Content:** \`${message.content.slice(0, 200)}\``)
                            .setTimestamp();
                          logCh.send({ embeds: [embed] }).catch(() => {});
                        }
                      }
                      return;
                    }
                  }

                  // 2. Anti Spam
                  const antiSpamEnabled = autoModData.features?.antiSpam !== false;

                  if (!actionTaken && antiSpamEnabled && !isFeatureWhitelisted("antiSpam")) {
                    const now = Date.now();
                    const spamKey = `${message.guild.id}_${message.author.id}`;
                    const userSpamData = this.spamMap.get(spamKey) || { count: 0, firstMsg: now };

                    if (now - userSpamData.firstMsg < 3500) {
                      userSpamData.count++;
                      this.spamMap.set(spamKey, userSpamData);

                      if (userSpamData.count >= 5) {
                        actionTaken = true;
                        message.delete().catch(() => {});
                        this.spamMap.delete(spamKey);

                        let timedOut = false;
                        let timeoutError = "";
                        try {
                          if (message.member && message.author.id !== message.guild.ownerId) {
                            await message.member.timeout(300000, "AutoMod: Message Spamming");
                            timedOut = true;
                          } else if (message.author.id === message.guild.ownerId) {
                            timeoutError = " *(Server Owner cannot be timed out by Discord)*";
                          }
                        } catch (err) {
                          timedOut = false;
                          timeoutError = " *(Cannot timeout: member has Administrator or higher role)*";
                        }

                        const notice = timedOut
                          ? `⚡ ${message.author} has been timed out for 5 minutes for spamming!`
                          : `⚡ ${message.author}, spamming is not allowed here!${timeoutError}`;

                        message.channel.send(notice).then((m) => {
                          setTimeout(() => m.delete().catch(() => {}), 6000);
                        });

                        if (autoModData.logchannelid) {
                          const logCh = message.guild.channels.cache.get(autoModData.logchannelid);
                          if (logCh) {
                            const embed = this.client.util.embed()
                              .setColor("#ff3344")
                              .setTitle("⚡ AutoMod: User Timed Out for Spam")
                              .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Action:** Message Deleted ${timedOut ? "& 5-minute Timeout" : ""}`)
                              .setTimestamp();
                            logCh.send({ embeds: [embed] }).catch(() => {});
                          }
                        }
                        return;
                      }
                    } else {
                      this.spamMap.set(spamKey, { count: 1, firstMsg: now });
                    }
                  }

                  // 3. Anti Mention
                  if (!actionTaken && autoModData.features?.antiMention !== false && !isFeatureWhitelisted("antiMention")) {
                    const userMentions = message.mentions.users?.size || 0;
                    const roleMentions = message.mentions.roles?.size || 0;
                    const everyonePing = (message.mentions.everyone || message.content.includes("@everyone") || message.content.includes("@here")) ? 1 : 0;
                    const rawUserMentions = (message.content.match(/<@!?(\d+)>/g) || []).length;
                    const rawRoleMentions = (message.content.match(/<@&(\d+)>/g) || []).length;
                    const totalMentions = Math.max(
                      userMentions + roleMentions + everyonePing,
                      rawUserMentions + rawRoleMentions + everyonePing
                    );

                    const mentionLimit = (autoModData.features?.mentionLimit || autoModData.mentionLimit) || 3;
                    if (totalMentions >= mentionLimit) {
                      actionTaken = true;
                      message.delete().catch(() => {});

                      let timedOut = false;
                      let timeoutError = "";
                      try {
                        if (message.member && message.author.id !== message.guild.ownerId) {
                          await message.member.timeout(300000, "AutoMod: Mass Mention");
                          timedOut = true;
                        } else if (message.author.id === message.guild.ownerId) {
                          timeoutError = " *(Server Owner cannot be timed out by Discord)*";
                        }
                      } catch (err) {
                        timedOut = false;
                        timeoutError = " *(Cannot timeout: member has Administrator or higher role)*";
                      }

                      const notice = timedOut
                        ? `📯 ${message.author} has been timed out for 5 minutes for excessive mentions! (Limit: ${mentionLimit})`
                        : `📯 ${message.author}, excessive mentions are not allowed! (Limit: ${mentionLimit})${timeoutError}`;

                      message.channel.send(notice).then((m) => {
                        setTimeout(() => m.delete().catch(() => {}), 5000);
                      });

                      if (autoModData.logchannelid) {
                        const logCh = message.guild.channels.cache.get(autoModData.logchannelid);
                        if (logCh) {
                          const embed = this.client.util.embed()
                            .setColor("#ff3344")
                            .setTitle("📯 AutoMod: Excessive Mentions Detected")
                            .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Mentions Count:** \`${totalMentions}\` (Limit: \`${mentionLimit}\`)\n**Action:** Message Deleted ${timedOut ? "& 5-minute Timeout" : ""}`)
                            .setTimestamp();
                          logCh.send({ embeds: [embed] }).catch(() => {});
                        }
                      }
                      return;
                    }
                  }

                  // 4. Anti Bad Words
                  if (!actionTaken && autoModData.features?.antiWord !== false && !isFeatureWhitelisted("antiWord")) {
                    const badWords = ["fuck", "shit", "bitch", "asshole", "dick", "cunt", "faggot", "slut", "whore"];
                    const lower = message.content.toLowerCase();
                    if (badWords.some((w) => lower.includes(w))) {
                      actionTaken = true;
                      message.delete().catch(() => {});

                      let timedOut = false;
                      let timeoutError = "";
                      try {
                        if (message.member && message.author.id !== message.guild.ownerId) {
                          await message.member.timeout(300000, "AutoMod: Prohibited Language");
                          timedOut = true;
                        } else if (message.author.id === message.guild.ownerId) {
                          timeoutError = " *(Server Owner cannot be timed out by Discord)*";
                        }
                      } catch (err) {
                        timedOut = false;
                        timeoutError = " *(Cannot timeout: member has Administrator or higher role)*";
                      }

                      const notice = timedOut
                        ? `⚡ ${message.author} has been timed out for 5 minutes for using prohibited words!`
                        : `🚫 ${message.author}, toxic/vulgar words are not allowed here!${timeoutError}`;

                      message.channel.send(notice).then((m) => {
                        setTimeout(() => m.delete().catch(() => {}), 5000);
                      });

                      if (autoModData.logchannelid) {
                        const logCh = message.guild.channels.cache.get(autoModData.logchannelid);
                        if (logCh) {
                          const embed = this.client.util.embed()
                            .setColor("#ff3344")
                            .setTitle("🚫 AutoMod: Bad Word Detected")
                            .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Action:** Message Deleted ${timedOut ? "& 5-minute Timeout" : ""}\n**Content:** \`${message.content.slice(0, 200)}\``)
                            .setTimestamp();
                          logCh.send({ embeds: [embed] }).catch(() => {});
                        }
                      }
                      return;
                    }
                  }

                  // 5. Anti Caps
                  if (!actionTaken && autoModData.features?.antiCaps !== false && !isFeatureWhitelisted("antiCaps")) {
                    const cleanText = message.content.replace(/<[^>]+>/g, "").trim();
                    const letters = cleanText.replace(/[^a-zA-Z]/g, "");
                    if (letters.length >= 4) {
                      const capsCount = cleanText.replace(/[^A-Z]/g, "").length;
                      const capsPercentage = (capsCount / letters.length) * 100;
                      if (capsPercentage >= 65 && capsCount >= 4) {
                        actionTaken = true;
                        message.delete().catch(() => {});

                        let timedOut = false;
                        let timeoutError = "";
                        try {
                          if (message.member && message.author.id !== message.guild.ownerId) {
                            await message.member.timeout(300000, "AutoMod: Excessive Capital Letters");
                            timedOut = true;
                          } else if (message.author.id === message.guild.ownerId) {
                            timeoutError = " *(Server Owner cannot be timed out by Discord)*";
                          }
                        } catch (err) {
                          timedOut = false;
                          timeoutError = " *(Cannot timeout: member has Administrator or higher role)*";
                        }

                        const notice = timedOut
                          ? `⚡ ${message.author} has been timed out for 5 minutes for excessive capital letters!`
                          : `🔠 ${message.author}, excessive capital letters are not allowed here!${timeoutError}`;

                        message.channel.send(notice).then((m) => {
                          setTimeout(() => m.delete().catch(() => {}), 5000);
                        });

                        if (autoModData.logchannelid) {
                          const logCh = message.guild.channels.cache.get(autoModData.logchannelid);
                          if (logCh) {
                            const embed = this.client.util.embed()
                              .setColor("#ff3344")
                              .setTitle("🔠 AutoMod: Excessive Caps Detected")
                              .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Caps Ratio:** \`${Math.round(capsPercentage)}%\`\n**Action:** Message Deleted ${timedOut ? "& 5-minute Timeout" : ""}\n**Content:** \`${message.content.slice(0, 200)}\``)
                              .setTimestamp();
                            logCh.send({ embeds: [embed] }).catch(() => {});
                          }
                        }
                        return;
                      }
                    }
                  }
                }
              }
            }
            message.guild.config = await this.client.cache.get(message?.guild.id + "1");
            if (!message.guild.config) {
                message.guild.config = await this.client.database.guildData.get(message?.guild?.id);
                if (message.guild.config != null) await this.client.cache.set(message?.guild.id + "1", message.guild.config);
            }
            if (!message.guild.config) message.guild.config = {};
            if (!message.guild.config.prefix || message.guild.config.prefix === "!" || message.guild.config.prefix === "s!") {
                message.guild.config.prefix = "$";
                if (message.guild.id) {
                    this.client.database.guildData.putPrefix(message.guild.id, "$").catch(() => {});
                }
            }
            const mentionRegex = RegExp(`^<@!?${this.client.user.id}>$`);
            if (message?.content.match(mentionRegex)) {
              const guildPrefix = message.guild.config.prefix;

              const embed = this.client.util
                .embed()
                .setColor(this.client.config.Client.PrimaryColor)
                .setTitle(`${message.guild.name}`)
                .setDescription(
                  `Hey ${message.author},\nPrefix for this server is \`${guildPrefix}\`\nType \`${guildPrefix}help\` for more information.`
                )
               // .setImage("https://i.imgur.com/your-image.png") // Replace with your desired image URL
                .setFooter({
                  text: "Powered by CodeX Development™",
                  iconURL: this.client.user.displayAvatarURL(),
                });

              return message.channel.send({
                embeds: [embed],
                components: [
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        label: "Invite Me",
                        style: 5,
                        url: `https://discord.com/oauth2/authorize?client_id=${this.client.user.id}&permissions=8&scope=applications.commands+bot`,
                      },
                      {
                        type: 2,
                        label: "Support Server",
                        style: 5,
                        url: "https://discord.gg/codexdev",
                      },
                    ],
                  },
                ],
              });
            }

            const mentionRegexPrefix = RegExp(`^<@!?${this.client.user.id}>`);
            let noprefixdata = await this.client.cache.get(this.client.user.id);
            if (!noprefixdata) {
                noprefixdata = await this.client.database.noprefixUserData.get(this.client.user.id);
                if (noprefixdata != null) await this.client.cache.set(this.client.user.id, noprefixdata);
            }
            const prefix = message?.content.match(mentionRegexPrefix) ? message?.content.match(mentionRegexPrefix)[0] : (message?.guild?.config?.prefix || "$");
            const checkNoPrefix = noprefixdata.userids.includes(message?.author.id);
            if (!message?.content.toLowerCase().startsWith(prefix) && !checkNoPrefix) return;

            const args = message?.content.startsWith(prefix) ? message?.content.slice(prefix.length).trim().split(/ +/) : message?.content.trim().split(/ +/);
            let cmd = args.shift().toLowerCase();
            let mapedCustomRole = message.guild.config.CustomRoles.map((x) => x.name.toLowerCase());
            if (mapedCustomRole.includes(cmd) && cmd != "manager") {
                let role = message.guild.config.CustomRoles.find((x) => x.name.toLowerCase() == cmd);
                if (role && message.guild.roles.cache.get(role.roleId)) {
                    let user = await this.client.util.userQuery(args[0]);
                    if (!user) return message.reply({ content: `Please provide a valid user!` });
                    user = await message.guild.members.fetch(user);
                    let managerRole = message.guild.config.manager;
                    if (!user) return message.reply({ content: `Please provide a valid user!` });
                    if (user.id == message.author.id)
                        return message.reply({
                            content: `You can't give yourself a custom role!`,
                        });
                    if (user.id == message.guild.ownerId)
                        return message.reply({
                            content: `You can't give the owner a custom role!`,
                        });
                    if (user.id == this.client.user.id)
                        return message.reply({
                            content: `You can't give me a custom role!`,
                        });
                    if (message.member.permissions.has("ManageRoles")) {
                        if(managerRole && !message.member.roles.cache.has(managerRole) ){
                            return message.reply({
                                content: `You don't have the required permissions to give custom roles!`,
                            });
                        }
                        if (message.member.roles.highest.position < message.guild.roles.cache.get(role.roleId).position) {
                            return message.reply({
                                content: `You can't give a role higher than your highest role!`,
                            });
                        }
                    } else {
                        return message.reply({
                            content: `You don't \`Manage Roles\` permission to give custom roles!`,
                        });
                    }
                    role = message.guild.roles.cache.get(role.roleId);
                    if (user.roles.cache.has(role.id)) {
                        await user.roles.remove(role.id);
                        return message.reply({
                            content: `Removed ${role.name} from ${user.user.username}`,
                        });
                    }
                    await user.roles.add(role.id);
                    return message.reply({
                        content: `Added ${role.name} to ${user.user.username}`,
                    });
                }
            }

            const command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd));
            if (!command) return;
            if (command.ownerOnly && !this.client.util.checkOwner(message?.author.id)) return;
            if (!this.client.util.checkOwner(message?.author.id)) {
                !message?.channel.permissionsFor(message?.member).has(["Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageMessages", "ManageNicknames", "ManageEmojisAndStickers", "ManageWebhooks", "ManageThreads", "BanMembers", "KickMembers"]);
                {
                    if (message?.guild?.config?.disabledCommands?.includes(command?.name)) {
                        return message?.channel.send(`This command is disabled in this server!`).then((m) => {
                            setTimeout(() => {
                                m.delete();
                            }, 5000);
                        });
                    }
                    if (message?.guild?.config?.disabledChannels?.includes(message?.channel?.id)) {
                        return message?.channel.send(`This command is disabled in this channel!`).then((m) => {
                            setTimeout(() => {
                                m.delete();
                            }, 5000);
                        });
                    }
                }
                if (message?.guild.config.blacklisted) {
                    return message?.channel.send({
                        content: "This guild is blacklisted from using this bot.",
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Contact Support",
                                        style: 5,
                                        url: this.client.config.Url.SupportURL,
                                    },
                                ],
                            },
                        ],
                    });
                }
                let userdata = await this.client.database.welcomeUserData.get(message?.author.id);
                if (userdata?.blacklist) {
                    return message?.channel?.send({
                        content: "You are blacklisted from using this bot.",
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Contact Support",
                                        style: 5,
                                        url: this.client.config.Url.SupportURL,
                                    },
                                ],
                            },
                        ],
                    });
                }

                const rateLimits = this.ratelimit(message, cmd);
                if (typeof rateLimits === "string") {
                    return message
                        .reply({
                            content: `You are being ratelimited. Please wait \`${rateLimits}\` before using this command again.`,
                        })
                        .then((m) => setTimeout(() => m.delete(), 4000));
                }
                const userPermCheck = command.userPerms ? this.client.userPerms.add(command.userPerms) : this.client.userPerms;
                if (userPermCheck && !this.client.util.checkOwner(message?.author.id)) {
                    const missing = message?.channel.permissionsFor(message?.member).missing(userPermCheck);
                    if (missing.length) {
                        return this.client.util.errorDelete(message, `You Are Missing The Following Permissions: ${this.client.util.formatArray(missing.map(this.client.util.formatPerms))}`);
                    }
                }
                if (command.guildOwnerOnly && message?.guild.ownerId != message?.author.id) {
                    return this.client.util.errorDelete(message, `This Command Can Only Be Run By The Server Owner!`);
                }
                if (command.upFromMe && message?.member.roles.highest.position < message?.guild.members.resolve(this.client.user).roles.highest.position) {
                    return this.client.util.errorDelete(message, `This Command Can Only Be Run By Someone Higher Than Me!`);
                }
                const botPermCheck = command.botPerms ? this.client.defaultPerms.add(command.botPerms) : this.client.defaultPerms;
                if (botPermCheck) {
                    const missing = message?.channel.permissionsFor(this.client.user).missing(botPermCheck);
                    if (missing.length) {
                        return this.client.util.errorButtonEmbed(message, `I Don't Have Enough Permission! Click The Button Below To Fix`, botPermCheck.bitfield.toString());
                    }
                }

                if ((!message?.guild.config.premium && command?.vote) || (!message?.guild.config.premium && command?.premium)) {
                    let voted = await this.client.util.checkVote(message?.author.id);
                    if (!voted) {
                        let embed = this.client.util.embed().setTitle(`Vote For Me!`).setDescription(`You Need To Vote For Me To Use This Command!`).setColor(this.client.config.Client.PrimaryColor);
                        return message?.channel.send({
                            embeds: [embed],
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            style: 5,
                                            label: `Vote`,
                                            url: `https://top.gg/bot/${this.client.user.id}/vote`,
                                        },
                                    ],
                                },
                            ],
                        });
                    }
                }
            }
            let cmdr = command.run({ message, args, prefix });
        } catch (error) {
            return;
        }
    }
    ratelimit(message, cmd) {
        const command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd));
        if (!command?.cooldown) return false;
        const cooldown = command.cooldown * 1000;
        const ratelimits = this.ratelimits.get(message?.author.id) || {};
        if (!ratelimits[command.name]) ratelimits[command.name] = Date.now() - cooldown;
        const difference = Date.now() - ratelimits[command.name];
        if (difference < cooldown) {
            let duration = cooldown - difference;
            return this.client.util.millisToDuration(duration);
        } else {
            ratelimits[command.name] = Date.now();
            this.ratelimits.set(message?.author.id, ratelimits);
            return true;
        }
    }
};
