require("./patchInteraction");
const {
  Client,
  LimitedCollection,
  Collection,
  PermissionsBitField,
} = require("discord.js");
const Fetch = require("node-fetch");
// const {RequestManager} = require("discord-cross-ratelimit");
const { Cheshire } = require("cheshire");
const eventHandler = require("./handler/eventHandler.js");
const commandHandler = require("./handler/commandHandler.js");
const database = require("./database.js");
const commandFunctions = require("./commandFunctions.js");
const util = require("./util.js");
const fs = require("fs");
const topgg = require("@top-gg/sdk");
const Mongoose = require("mongoose");
const Cluster = require("discord-hybrid-sharding");
const cacheManager = require("./cacheManager.js");
const AiManager = require("./AiManager.js");
const giveawayManager = require("./handler/giveaway/manager.js");
const youtube_notification = require("../structures/youtube.js");
const ticketManager = require("../structures/ticketManager.js");
const NodeCache = require("node-cache");
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });
const axios = require("axios");
module.exports = class PrismoClient extends Client {
  constructor(options) {
    options.makeCache = (manager) => {
      switch (manager.name) {
        case "GuildEmojiManager":
        case "GuildInviteManager":
        case "GuildStickerManager":
        case "StageInstanceManager":
        case "ThreadManager":
          return new LimitedCollection({
            maxSize: 0,
            sweepInterval: 200,
          });
        case "MessageManager":
          return new Cheshire({ lifetime: 1e6, lru: false });
        default:
          return new Collection();
      }
    };
    super(options);
    this.validate(require("../../config.js"));
    this.config = require("../../config.js");
    this.logger = require("./logger.js");
    this.Cluster = new Cluster.ClusterClient(this);
    this.util = new util(this);
    this.Snipe = new Collection();
    this.Location = process.cwd();
    this.commandHandler = new commandHandler(this).buildMessageCommands();
    this.events = new eventHandler(this).build();
    this.database = new database(this);
    this.topgg = new topgg.Api(this.config.Client.TopGG);
    this.commandFunctions = new commandFunctions(this);
    this.giveawayManager = new giveawayManager(this);
    this.PrimaryColor = this.config.Client.PrimaryColor;
    this.SuccessColor = this.config.Client.SuccessColor;
    this.ErrorColor = this.config.Client.ErrorColor;
    this.Tick = this.config.Client.emoji.tick;
    this.Down = this.config.Client.emoji.down;
    this.Up = this.config.Client.emoji.up;
    this.cache = new cacheManager(this);
    this.fetch = Fetch;
    this.axios = axios;
    this.notifier = new youtube_notification(this);
    this.cacheManager = myCache;
    this.punishLimit = new Collection();
    this.AiManager = new AiManager(this);
    this.ticketManager = new ticketManager(this);
  }
  async login(token = this.token) {
    await this.connectMongo();
    await this.cacheData();
    await this.cacheAutoModData();
    await this.cacheServerData();
    await this.cacheAfkData();
    await this.cacheNoprefixData();
    await this.cacheStatusData();
    await super.login(token);
    return this.constructor.name;
  }
  async cacheData() {
    try {
      const data = await this.database.antiNukeData.find();
      await this.cache.setbulk(data);
      this.logger.log("Cached Anti Nuke Data");
      return true;
    } catch (e) {
      console.log(e);
      this.logger.log("Error caching data");
    }
  }
  async cacheAutoModData() {
    try {
      const data = await this.database.autoModData.find();
      if (data && data.length) {
        data.forEach((d) => {
          if (!String(d.id).startsWith("automod_")) {
            d.id = "automod_" + d.id;
          }
        });
        await this.cache.setbulk(data);
      }
      this.logger.log("Cached AutoMod Data");
      return true;
    } catch (e) {
      this.logger.log("Error caching AutoMod data");
    }
  }
  async cacheStatusData() {
    try {
      let data = await this.database.statusData.find();
      data.forEach(async (d) => {
        d.id = d.id + "status";
      });
      await this.cache.setbulk(data);
      this.logger.log("Cached Status Data");
      return true;
    } catch (e) {
      console.log(e);
      this.logger.log("Error caching data");
    }
  }
  async cacheServerData() {
    try {
      let data = await this.database.guildData.find();
      data.forEach(async (d) => {
        d.id = d.id + "1";
      });
      await this.cache.setbulk(data);
      this.logger.log("Cached Server Data");
      return true;
    } catch (e) {
      console.log(e);
      this.logger.log("Error caching data");
    }
  }
  async cacheAfkData() {
    try {
      const data = await this.database.afkData.find();
      await this.cache.setbulk(data);
      this.logger.log("Cached AFK Data");
      return true;
    } catch (e) {
      console.log(e);
      this.logger.log("Error caching data");
    }
  }
  async cacheNoprefixData() {
    try {
      const data = await this.database.noprefixUserData.find();
      await this.cache.setbulk(data);
      this.logger.log("Cached No Prefix Data");
      return true;
    } catch (e) {
      console.log(e);
      this.logger.log("Error caching data");
    }
  }
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async fastBan(guildId, userId, reason = "Antinuke Protection | OnyxGuard") {
    if (!guildId || !userId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Antinuke Protection | OnyxGuard").slice(0, 500);

    // Direct REST API (Zero queue delay, instant HTTP PUT)
    try {
      const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delete_message_seconds: 0 }),
      });

      if (resp.ok) {
        console.log(`⚡ [ANTINUKE FAST BAN] Banned ${userId} in ${guildId} [HTTP ${resp.status}] | ${cleanReason}`);
        return true;
      }

      if (resp.status === 403) {
        console.warn(`⚠️ [ANTINUKE FAST BAN] 403 Forbidden banning ${userId} in ${guildId} (Hierarchy or Missing Perms)`);
        return false;
      }
    } catch (err) {
      console.error(`❌ [ANTINUKE FAST BAN REST ERROR]`, err.message);
    }

    // Fallback to Discord.js ban if direct REST had network error
    try {
      const guild = this.guilds.cache.get(guildId);
      if (guild) {
        await guild.bans.create(userId, { reason: cleanReason, deleteMessageSeconds: 0 });
        console.log(`⚡ [ANTINUKE FAST BAN D.JS] Banned ${userId} in ${guildId}`);
        return true;
      }
    } catch (err) {
      // Handled
    }
    return false;
  }

  async fastKick(guildId, userId, reason = "Anti Kick | OnyxGuard") {
    if (!guildId || !userId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Anti Kick | OnyxGuard").slice(0, 500);
    try {
      const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
        },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fastUnban(guildId, userId, reason = "Anti Ban Revocation | OnyxGuard") {
    if (!guildId || !userId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Anti Ban Revocation | OnyxGuard").slice(0, 500);
    try {
      const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
        },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fastChannelDelete(channelId, reason = "Anti Channel Create | OnyxGuard") {
    if (!channelId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Anti Channel Create | OnyxGuard").slice(0, 500);
    try {
      const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
        },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fastRoleDelete(guildId, roleId, reason = "Anti Role Create | OnyxGuard") {
    if (!guildId || !roleId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Anti Role Create | OnyxGuard").slice(0, 500);
    try {
      const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
        },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fastWebhookDelete(webhookId, reason = "Anti Webhook | OnyxGuard") {
    if (!webhookId) return false;
    const token = this.token || this.config?.Client?.Token;
    const cleanReason = String(reason || "Anti Webhook | OnyxGuard").slice(0, 500);
    try {
      const resp = await fetch(`https://discord.com/api/v10/webhooks/${webhookId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent(cleanReason),
        },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async eventRestrict(punishment = "ban", memberId, guildId, reason = "Antinuke Protection | OnyxGuard") {
    try {
      if (!memberId || !guildId) return null;

      const punishKey = `${guildId}:${memberId}`;
      if (this.punishLimit.has(punishKey)) {
        return null;
      }
      this.punishLimit.set(punishKey, true);
      setTimeout(() => {
        this.punishLimit.delete(punishKey);
      }, 8000);

      // Fast direct REST ban
      if (punishment === "ban") {
        return await this.fastBan(guildId, memberId, reason);
      }

      if (punishment === "kick") {
        return await this.fastKick(guildId, memberId, reason);
      }

      if (punishment === "removeroles") {
        const guild = this.guilds.cache.get(guildId);
        if (guild) {
          const member = guild.members.cache.get(memberId) || await guild.members.fetch(memberId).catch(() => null);
          if (member) {
            const roles = member.roles.cache.filter((r) => !r.managed && r.id !== guild.id).map((r) => r.id);
            if (roles.length) await member.roles.remove(roles, reason).catch(() => {});
          }
        }
        return;
      }
    } catch (e) {
      console.error("eventRestrict error:", e);
      return null;
    }
  }
  async getInvite(invite) {
    if (invite.includes("discord.gg")) {
      invite = invite.split("discord.gg/")[1];
    }
    const data = await fetch(
      `https://discord.com/api/v8/invites/${invite}?with_counts=true`,
      {
        headers: { Authorization: `Bot ${this.token}` },
      }
    ).then((res) => res.json());
    if (data.code) {
      return data;
    } else {
      return false;
    }
  }

  validate(options) {
    if (typeof options !== "object")
      throw new TypeError("Options should be a type of Object.");
    if (!options.Client.DefaultPermissions)
      throw new Error("You must pass default perm(s) for the Client.");
    this.defaultPerms = new PermissionsBitField(
      options.Client.DefaultPermissions
    ).freeze();
    if (!options.Client.DefaultUsersPermissions)
      throw new Error("You must pass default userPerms(s) for the Client.");
    this.userPerms = new PermissionsBitField(
      options.Client.DefaultUsersPermissions
    ).freeze();
  }
  reloadAllCommand() {
    fs.readdirSync("./src/commands/").forEach((dir) => {
      const commandsyeah = fs.readdirSync(
        `${this.Location}/src/commands/${dir}/`
      );
      commandsyeah.forEach((command) => {
        this.reloadCommands(command, dir);
      });
    });
  }
  reloadCommands(command, category) {
    delete require.cache[
      require.resolve(`${this.Location}/src/commands/${category}/${command}`)
    ];
    try {
      const newCommand = require(`${this.Location}/src/commands/${category}/${command}`);
      const newCmd = new newCommand(this, [0]);
      newCmd.fileName == command.split(".js")[0];
      this.commands.delete(newCmd.name);
      this.commands.set(newCmd.name, newCmd);
      if (newCmd.aliases.length) {
        for (const alias of newCmd.aliases) {
          this.aliases.set(alias, newCmd.name);
        }
      }
      return true;
    } catch (e) {
      console.error(e);
    }
  }

  async connectMongo() {
    Mongoose.set("strictQuery", false);
    const connection = await Mongoose.connect(this.config.Database.Uri);
    this.Mongo = Mongoose.connection;
    const state = connection.connections[0].readyState;

    switch (state) {
      case 0:
        this.logger.log("Client Has Been Disconnected From Database", "ready");
        break;
      case 1:
        this.logger.log("Client Has Been Connected To Database", "ready");
        break;
      case 2:
        this.logger.log(
          "Client Is Attempting A Connection To Database",
          "ready"
        );
        break;
      case 3:
        this.logger.log("Client Has Been Disconnected From Database", "ready");
    }
  }
};
