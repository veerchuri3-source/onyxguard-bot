/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
module.exports = class ready extends Event {
    get name() {
        return "clientReady";
    }
    get once() {
        return true;
    }
    async run() {
        try {
            await this.client.giveawayManager.init()
            this.client.logger.log(
                `Logged in as ${this.client.user.username}`,
                "ready"
            );
            this.client.logger.log(
                `Loaded ${this.client.commands.size} commands!`,
                "cmd"
            );
            this.client.logger.log(
                `Loaded ${this.client.events.size} events!`,
                "cmd"
            );
            const sanitizeDesc = (desc) => {
                if (!desc || typeof desc !== "string") return "No description provided.";
                const trimmed = desc.trim();
                if (!trimmed) return "No description provided.";
                return trimmed.length > 100 ? trimmed.slice(0, 97) + "..." : trimmed;
            };
            const sanitizeOpts = (opts) => {
                if (!opts || !Array.isArray(opts)) return opts;
                return opts.map((opt) => {
                    const c = { ...opt };
                    if (c.name) c.name = c.name.toLowerCase();
                    c.description = sanitizeDesc(c.description);
                    if (c.options && Array.isArray(c.options)) c.options = sanitizeOpts(c.options);
                    return c;
                });
            };
            const commands = this.client.commands
                .filter((c) => c.ownerOnly != true)
                .filter((cd) => cd.category != "Image")
                .filter((c) => c.category != "Fun")
                .map((command) => {
                    const data = command.interactionData;
                    if (!data) return null;
                    return {
                        ...data,
                        name: data.name ? data.name.toLowerCase() : command.name.toLowerCase(),
                        description: sanitizeDesc(data.description),
                        options: sanitizeOpts(data.options),
                    };
                })
                .filter((cmd) => cmd && cmd.name && cmd.description);
            if (!this.client.config.Client.GuildID) {
                await this.client.application?.commands.set(commands);
                this.client.logger.debug(
                    `Updated ${commands.length} interaction command(s) [Discord Side] global`
                );
            } else {
                await this.client.guilds.cache
                    .get(this.client.config.Client.GuildID)
                    .commands.set(commands);
                this.client.logger.debug(
                    `Updated ${commands.length} interaction command(s) [Discord Side]`
                );
            }
            setInterval(() => {
                this.premiumCheckGuild();
                this.client.cache.flush();
                this.client.cacheData();
                this.client.cacheServerData();
                this.client.cacheAfkData();
                this.client.cacheNoprefixData();
                this.client.cacheStatusData();
                // this.leaveblacklistedguild();
                // this.changeStatus();
            }, 60000 * 3);
            setInterval(() => {
                this.client.notifier.checkyt();
            }, 60000 * 2);
        } catch (error) {
            console.log(error);
            return;
        }
    }

    

    async premiumCheckGuild() {
        const guilds = await this.client.guilds.fetch();
        for (const guild of guilds) {
            const guildData = await this.client.database.guildData.get(
                guild[0]
            );
            if (guildData.premium) {
                const premiumUntil = guildData.premiumUntil;
                if (premiumUntil < Date.now()) {
                    guildData.premium = false;
                    guildData.premiumUntil = null;
                    await this.client.database.guildData.set(
                        guild[0],
                        guildData
                    );
                }
            }
        }
    }
    // async leaveblacklistedguild() {
    //     const guilds = await this.client.guilds.fetch();
    //     for (let guild of guilds) {
    //         let guildData = await this.client.cache.get(guild[0]);
    //         if (!guildData) {
    //             guildData = await this.client.database.guildData.get(
    //                 guild[0]
    //             );
    //         }
    //         if (guildData.blacklisted) {
    //             guild = this.client.guilds.cache.get(guild[0])
    //             guild.leave();
    //         }
    //     }
    // }
    async changeStatus() {
      const statuses = [
        {
          name: `!help`,
          type: 2,
        },
        {
          name: `Synapse Energy Your server's security`,
          type: 3,
        },
        {
          name: `!setup`,
          type: 2,
        },
        {
          name: `!ai`,
          type: 2,
        },
        {
          name: `!antinuke`,
          type: 2,
        },
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      this.client.user.setPresence({
        activities: [status],
      });
      setInterval(async () => {
        const today = new Date();
        const monthDay =
          `${today.getMonth() + 1}`.padStart(2, "0") +
          "-" +
          `${today.getDate()}`.padStart(2, "0");

        const birthdays = await Birthday.find(); // fetch all birthdays
        for (const b of birthdays) {
          const [year, month, day] = b.date.split("-");
          if (`${month}-${day}` === monthDay) {
            const guild = client.guilds.cache.get(b.guildId);
            if (!guild) continue;

            const settings = await BirthdaySettings.findOne({
              guildId: b.guildId,
            });
            if (!settings || !settings.enabled || !settings.channelId) continue;

            const member = await guild.members
              .fetch(b.userId)
              .catch(() => null);
            if (!member) continue;

            const channel = guild.channels.cache.get(settings.channelId);
            if (!channel) continue;

            let msg = settings.message.replace("{user}", `<@${b.userId}>`);
            channel.send({ content: msg });

            // optional role
            if (settings.roleId) {
              member.roles.add(settings.roleId).catch(() => null);
            }
          }
        }
      }, 1000 * 60 * 60);
    }       
};
