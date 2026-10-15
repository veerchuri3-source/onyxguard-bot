/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Cluster = require("discord-hybrid-sharding");
const { Client, Shards } = require("./config");
const Logger = require("./src/base/logger");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const app = express();

// ── Commands Cache (static fallback when bot clusters are offline) ──
const COMMANDS_CACHE_FILE = path.join(__dirname, "commands-cache.json");
let commandsCache = [];

function loadCommandsCache() {
  try {
    if (fs.existsSync(COMMANDS_CACHE_FILE)) {
      commandsCache = JSON.parse(fs.readFileSync(COMMANDS_CACHE_FILE, "utf-8"));
      Logger.log(`Loaded ${commandsCache.length} commands from cache`, "shard");
    }
  } catch (e) {
    Logger.log(`Could not load commands cache: ${e.message}`, "shard");
  }
}

function saveCommandsCache(commands) {
  try {
    fs.writeFileSync(COMMANDS_CACHE_FILE, JSON.stringify(commands, null, 2), "utf-8");
    commandsCache = commands;
    Logger.log(`Saved ${commands.length} commands to cache`, "shard");
  } catch (e) {
    Logger.log(`Could not save commands cache: ${e.message}`, "shard");
  }
}

// Load cache immediately on startup
loadCommandsCache();




const manager = new Cluster.ClusterManager(`${__dirname}/src/base/main.js`, {
  totalShards: Shards.totalShards,
  totalClusters: Shards.totalClusters,
  shardsPerClusters: Shards.shardsPerCluster,
  respawn: true,
  mode: "process",
  token: Client.Token,
});

manager.on("clusterCreate", (cluster) => {
  Logger.log(`Launched Cluster ${cluster.id}`, "shard");
  cluster.on("ready", () =>
    Logger.log(`Cluster ${cluster.id} Is Up And Running`, "shard")
  );
});

manager.spawn({ timeout: -1 });

// -------------------- EXPRESS SERVER --------------------
app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  next();
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/stats", async (req, res) => {
  try {
    const promises = [
      manager.fetchClientValues("guilds.cache.size"),
      manager.fetchClientValues("users.cache.size"),
      manager.broadcastEval((c) =>
        c.guilds.cache.reduce((prev, guild) => prev + guild.memberCount, 0)
      ),
    ];

    const results = await Promise.all(promises);
    const totalUsers = results[2].reduce(
      (prev, memberCount) => prev + memberCount,
      0
    );
    const totalGuilds = results[0].reduce(
      (prev, guildCount) => prev + guildCount,
      0
    );

    res.json({
      users: totalUsers,
      guilds: totalGuilds,
    });
  } catch (e) {
    res.status(200).json({ users: 0, guilds: 0 });
  }
});

app.use(express.json());

// Discord OAuth2 Code Exchange endpoint
app.post(["/api/auth/token", "/auth/token"], async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    const encodedParams = new URLSearchParams();
    encodedParams.set("client_id", Client.botId);
    encodedParams.set("client_secret", Client.botSecret);
    encodedParams.set("grant_type", "authorization_code");
    encodedParams.set("code", code);
    encodedParams.set(
      "redirect_uri",
      redirect_uri || "http://localhost:5173/dashboard"
    );

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodedParams.toString(),
    });

    const data = await tokenResponse.json();
    if (data.error) {
      Logger.log(
        `OAuth token exchange error: ${data.error_description || data.error}`,
        "shard"
      );
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get(["/commands", "/api/commands"], async (req, res) => {
  try {
    // broadcastEval: PermissionsBitField cannot cross IPC, so we call .toArray() inside eval
    const results = await manager.broadcastEval((c) =>
      c.commands
        ? c.commands.map((cmd) => {
            try {
              const g = cmd.Global || {};
              const rawUsage = g.usage || cmd.usage || cmd.examples;
              let usageText = "$" + cmd.name;
              if (Array.isArray(rawUsage) && rawUsage.length > 0) {
                usageText = rawUsage[0].startsWith("$") ? rawUsage[0] : "$" + rawUsage[0];
              } else if (typeof rawUsage === "string" && rawUsage !== "No usage provided.") {
                usageText = rawUsage.startsWith("$") ? rawUsage : "$" + rawUsage;
              }
              // toArray() converts PermissionsBitField → plain string[] (safe for IPC)
              const userPermsArray =
                cmd.userPerms && typeof cmd.userPerms.toArray === "function"
                  ? cmd.userPerms.toArray()
                  : (Array.isArray(g.userPerms) ? g.userPerms : []);
              const botPermsArray =
                cmd.botPerms && typeof cmd.botPerms.toArray === "function"
                  ? cmd.botPerms.toArray()
                  : (Array.isArray(g.botPerms) ? g.botPerms : []);
              const permsString = userPermsArray.length > 0 ? userPermsArray.join(", ") : "Everyone";
              return {
                name: g.name || cmd.name,
                description: g.description || cmd.description || "No description provided.",
                category: g.category || cmd.category || "General",
                usage: usageText,
                aliases: Array.isArray(g.aliases) ? g.aliases : (Array.isArray(cmd.aliases) ? cmd.aliases : []),
                cooldown: typeof g.cooldown === "number" ? g.cooldown : (typeof cmd.cooldown === "number" ? cmd.cooldown : 3),
                userPerms: userPermsArray,
                botPerms: botPermsArray,
                permissions: permsString,
              };
            } catch {
              return null;
            }
          }).filter(Boolean)
        : []
    );

    // Find the first shard response that has commands
    const liveCommands = (results || []).find((x) => Array.isArray(x) && x.length > 0) || [];
    const publicCmds = liveCommands.filter(
      (x) => x && x.category !== "Owners" && x.category !== "Owner"
    );

    if (publicCmds.length > 0) {
      // Update the on-disk cache with fresh live data
      saveCommandsCache(publicCmds);
      return res.json(publicCmds);
    }

    // Fallback: serve the static cache so the dashboard always shows commands
    if (commandsCache.length > 0) {
      Logger.log("Serving commands from static cache (bot offline or no shard data)", "shard");
      return res.json(commandsCache);
    }

    res.json([]);
  } catch (e) {
    // broadcastEval failed (bot offline) — serve static cache
    if (commandsCache.length > 0) {
      return res.json(commandsCache);
    }
    res.status(200).json([]);
  }
});

// POST /sync-commands — regenerates commands-cache.json from disk (no bot needed)
app.post(["/sync-commands", "/api/sync-commands"], async (req, res) => {
  try {
    const { execSync } = require("child_process");
    execSync("node scripts/generate-commands-cache.js", { cwd: __dirname, timeout: 30000 });
    loadCommandsCache();
    res.json({ success: true, count: commandsCache.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guild list endpoint with full A-Z details
app.get(["/guilds", "/api/guilds"], async (req, res) => {
  try {
    const guildsArray = await manager.broadcastEval((c) =>
      c.guilds.cache.map((g) => {
        const textChannels = g.channels.cache.filter((ch) => ch.type === 0).size;
        const voiceChannels = g.channels.cache.filter((ch) => ch.type === 2).size;
        const categoryChannels = g.channels.cache.filter((ch) => ch.type === 4).size;

        const rolesList = g.roles.cache
          .map((r) => ({
            id: r.id,
            name: r.name,
            color: r.hexColor,
            position: r.position,
            managed: r.managed,
          }))
          .sort((a, b) => b.position - a.position);

        const channelsList = g.channels.cache
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId,
            position: ch.position,
          }))
          .sort((a, b) => a.position - b.position);

        return {
          id: g.id,
          name: g.name,
          icon: g.iconURL ? g.iconURL({ dynamic: true, size: 256 }) : null,
          banner: g.bannerURL ? g.bannerURL({ size: 512 }) : null,
          memberCount: g.memberCount || 1,
          ownerId: g.ownerId,
          hasBot: true,
          channelsCount: g.channels.cache.size,
          textChannels,
          voiceChannels,
          categoryChannels,
          rolesCount: g.roles.cache.size,
          emojisCount: g.emojis.cache.size,
          boostCount: g.premiumSubscriptionCount || 0,
          boostTier: g.premiumTier || 0,
          verificationLevel: g.verificationLevel || 0,
          vanityURLCode: g.vanityURLCode || null,
          createdAt: g.createdTimestamp,
          joinedAt: g.joinedTimestamp,
          features: Array.from(g.features || []),
          roles: rolesList.slice(0, 50),
          channels: channelsList.slice(0, 50),
        };
      })
    );
    const flattened = guildsArray.flat();

    // Attach cached settings and module active/inactive summary to each guild
    const enriched = flattened.map((g) => {
      const settings = guildSettingsCache.get(g.id) || {
        prefix: "$",
        antinuke: {
          enabled: true,
          punishment: "ban",
          antiBan: true,
          antiKick: true,
          antiChannelDelete: true,
          antiRoleDelete: true,
          antiBot: true,
          antiWebhook: true,
          antiVanity: true,
          whitelist: [],
        },
        automod: {
          antiSpam: true,
          antiLinks: true,
          badWords: false,
          massMention: true,
          blockedWords: ["discord.gg/", "nitro", "free nitro"],
        },
        welcome: {
          enabled: true,
          channelId: "",
          content: "Welcome {user} to {server}! Read the rules and enjoy your stay.",
          autorole: "",
        },
        verification: {
          enabled: false,
          verifiedRole: "",
          unverifiedRole: "",
        },
        logsChannel: "",
      };

      return {
        ...g,
        settings,
        modules: {
          antinuke: Boolean(settings.antinuke?.enabled),
          automod: Boolean(settings.automod?.antiSpam || settings.automod?.antiLinks),
          welcome: Boolean(settings.welcome?.enabled),
          verification: Boolean(settings.verification?.enabled),
          logging: Boolean(settings.logsChannel),
          prefix: settings.prefix || "$",
        },
      };
    });

    res.json(enriched);
  } catch (e) {
    console.log(e);
    res.status(200).json([]);
  }
});

// Single Guild full A-Z details endpoint
app.get(["/guilds/:id", "/api/guilds/:id"], async (req, res) => {
  try {
    const targetId = req.params.id;
    const guildsArray = await manager.broadcastEval(
      (c, { targetId }) => {
        const g = c.guilds.cache.get(targetId);
        if (!g) return null;

        const textChannels = g.channels.cache.filter((ch) => ch.type === 0).size;
        const voiceChannels = g.channels.cache.filter((ch) => ch.type === 2).size;
        const categoryChannels = g.channels.cache.filter((ch) => ch.type === 4).size;

        return {
          id: g.id,
          name: g.name,
          icon: g.iconURL ? g.iconURL({ dynamic: true, size: 256 }) : null,
          banner: g.bannerURL ? g.bannerURL({ size: 512 }) : null,
          memberCount: g.memberCount || 1,
          ownerId: g.ownerId,
          hasBot: true,
          channelsCount: g.channels.cache.size,
          textChannels,
          voiceChannels,
          categoryChannels,
          rolesCount: g.roles.cache.size,
          emojisCount: g.emojis.cache.size,
          boostCount: g.premiumSubscriptionCount || 0,
          boostTier: g.premiumTier || 0,
          verificationLevel: g.verificationLevel || 0,
          vanityURLCode: g.vanityURLCode || null,
          createdAt: g.createdTimestamp,
          joinedAt: g.joinedTimestamp,
          features: Array.from(g.features || []),
          roles: g.roles.cache.map((r) => ({
            id: r.id,
            name: r.name,
            color: r.hexColor,
            position: r.position,
            managed: r.managed,
          })),
          channels: g.channels.cache.map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId,
          })),
        };
      },
      { context: { targetId } }
    );

    const found = guildsArray.find((x) => x !== null && x !== undefined);
    if (!found) {
      return res.status(404).json({ error: "Guild not found on any cluster" });
    }

    const settings = guildSettingsCache.get(targetId) || null;
    res.json({ ...found, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guild settings cache
const guildSettingsCache = new Map();

// Helper default settings structure
function getDefaultGuildSettings() {
  return {
    prefix: "$",
    disabledCommands: [],
    antinuke: {
      enabled: true,
      punishment: "ban",
      antiBan: true,
      antiKick: true,
      antiChannelDelete: true,
      antiRoleDelete: true,
      antiBot: true,
      antiWebhook: true,
      antiVanity: true,
      whitelist: [],
    },
    automod: {
      enabled: true,
      antiSpam: true,
      antiLinks: true,
      badWords: false,
      massMention: true,
      antiCaps: true,
      blockedWords: ["discord.gg/", "nitro", "free nitro"],
      whitelist: [],
    },
    welcome: {
      enabled: true,
      channelId: "",
      content: "Welcome {user} to {server}! Read the rules and enjoy your stay.",
      autorole: "",
      embeds: {},
    },
    verification: {
      enabled: false,
      verifiedRole: "",
      unverifiedRole: "",
    },
    logsChannel: "",
  };
}

// GET guild settings from live database across shards
app.get(["/guilds/:id/settings", "/api/guilds/:id/settings"], async (req, res) => {
  try {
    const guildId = req.params.id;

    // First try to fetch actual live MongoDB data from the shard running this guild
    try {
      const clusterSettings = await manager.broadcastEval(async (c, { guildId }) => {
        try {
          if (!c.database) return null;
          const gData = await c.database.guildData.get(guildId).catch(() => null);
          const anData = await c.database.antiNukeData.get(guildId).catch(() => null);
          const amData = await c.database.autoModData.get(guildId).catch(() => null);

          if (!gData && !anData && !amData) return null;

          return {
            prefix: gData?.prefix || "$",
            disabledCommands: Array.isArray(gData?.disabledCommands) ? gData.disabledCommands : [],
            welcome: {
              enabled: Boolean(gData?.welcome?.channel || gData?.welcome?.content),
              channelId: gData?.welcome?.channel || "",
              content: gData?.welcome?.content || "Welcome {user} to {server}!",
              embeds: gData?.welcome?.embeds || {},
              autorole: gData?.autorole?.humanRoles?.[0] || "",
            },
            antinuke: {
              enabled: Boolean(anData?.enabled),
              punishment: anData?.punishment || "ban",
              whitelist: Array.isArray(anData?.whitelistusers) ? anData.whitelistusers : [],
              antiBan: Boolean(anData?.features?.antiBan),
              antiKick: Boolean(anData?.features?.antiKick),
              antiBot: Boolean(anData?.features?.antiBot),
              antiChannelDelete: Boolean(anData?.features?.antiChannelDelete),
              antiRoleDelete: Boolean(anData?.features?.antiRoleDelete),
              antiWebhook: Boolean(anData?.features?.antiWebhook),
              antiVanity: Boolean(anData?.antivanity ?? anData?.features?.antiVanity),
            },
            automod: {
              enabled: Boolean(amData?.enabled),
              antiSpam: Boolean(amData?.features?.antiSpam),
              antiLinks: Boolean(amData?.features?.antiLink),
              badWords: Boolean(amData?.features?.antiWord),
              massMention: Boolean(amData?.features?.antiMention),
              antiCaps: Boolean(amData?.features?.antiCaps),
              blockedWords: Array.isArray(amData?.blockedWords) ? amData.blockedWords : ["discord.gg/", "nitro"],
              whitelist: Array.isArray(amData?.whitelistusers) ? amData.whitelistusers : [],
            },
            logsChannel: anData?.logchannelid || amData?.logchannelid || "",
          };
        } catch {
          return null;
        }
      }, { context: { guildId } });

      const live = (clusterSettings || []).find((x) => x !== null && x !== undefined);
      if (live) {
        guildSettingsCache.set(guildId, live);
        return res.json(live);
      }
    } catch (evalErr) {
      console.warn("broadcastEval fetch settings warning:", evalErr.message);
    }

    if (guildSettingsCache.has(guildId)) {
      return res.json(guildSettingsCache.get(guildId));
    }

    res.json(getDefaultGuildSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save guild settings to live database across shards
app.post(["/guilds/:id/settings", "/api/guilds/:id/settings"], async (req, res) => {
  try {
    const guildId = req.params.id;
    const settings = req.body;
    guildSettingsCache.set(guildId, settings);
    Logger.log(`Updated settings for guild ${guildId}`, "shard");

    // Live sync to clusters and database using c.database
    try {
      await manager.broadcastEval(async (c, { guildId, settings }) => {
        try {
          if (!c.database) return;

          // 1. Prefix & Welcome & Disabled Commands (guildData)
          if (c.database.guildData) {
            let gData = await c.database.guildData.get(guildId);
            if (gData) {
              if (settings.prefix) {
                gData.prefix = settings.prefix;
              }
              if (Array.isArray(settings.disabledCommands)) {
                gData.disabledCommands = settings.disabledCommands;
                if (gData.markModified) gData.markModified("disabledCommands");
              }
              if (settings.welcome) {
                gData.welcome = {
                  channel: settings.welcome.channelId || null,
                  content: settings.welcome.content || " ",
                  embeds: settings.welcome.embeds || {},
                };
                if (gData.markModified) gData.markModified("welcome");
              }
              await gData.save();
              await c.cache.set(guildId + "1", gData);
            }
          }

          // 2. AntiNuke
          if (settings.antinuke && c.database.antiNukeData) {
            await c.database.antiNukeData.post(guildId, {
              enabled: Boolean(settings.antinuke.enabled),
              punishment: settings.antinuke.punishment || "ban",
              whitelistusers: settings.antinuke.whitelist || [],
              features: {
                antiBan: Boolean(settings.antinuke.antiBan),
                antiKick: Boolean(settings.antinuke.antiKick),
                antiBot: Boolean(settings.antinuke.antiBot),
                antiChannelDelete: Boolean(settings.antinuke.antiChannelDelete),
                antiRoleDelete: Boolean(settings.antinuke.antiRoleDelete),
                antiWebhook: Boolean(settings.antinuke.antiWebhook),
                antiVanity: Boolean(settings.antinuke.antiVanity),
              },
            });
            const updatedAn = await c.database.antiNukeData.get(guildId);
            await c.cache.set(guildId, updatedAn);
          }

          // 3. AutoMod
          if (settings.automod && c.database.autoModData) {
            await c.database.autoModData.post(guildId, {
              enabled: Boolean(settings.automod.enabled),
              blockedWords: settings.automod.blockedWords || [],
              features: {
                antiSpam: Boolean(settings.automod.antiSpam),
                antiLink: Boolean(settings.automod.antiLinks),
                antiWord: Boolean(settings.automod.badWords),
                antiMention: Boolean(settings.automod.massMention),
                antiCaps: Boolean(settings.automod.antiCaps),
              },
            });
            const updatedAm = await c.database.autoModData.get(guildId);
            await c.cache.set("automod_" + guildId, updatedAm);
          }
        } catch (e) {
          console.error("Cluster sync error:", e);
        }
      }, { context: { guildId, settings } });
    } catch (evalErr) {
      console.warn("broadcastEval sync warning:", evalErr.message);
    }

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle command enabled / disabled per guild
app.post(["/guilds/:id/toggle-command", "/api/guilds/:id/toggle-command"], async (req, res) => {
  try {
    const guildId = req.params.id;
    const { commandName, enabled } = req.body;
    if (!commandName) return res.status(400).json({ error: "Missing commandName" });

    const results = await manager.broadcastEval(async (c, { guildId, commandName, enabled }) => {
      try {
        if (!c.database?.guildData) return null;
        let data = await c.database.guildData.get(guildId);
        if (!data) return null;
        let disabled = Array.isArray(data.disabledCommands) ? [...data.disabledCommands] : [];
        const cmdLower = commandName.toLowerCase();
        if (enabled) {
          disabled = disabled.filter((x) => x.toLowerCase() !== cmdLower);
        } else {
          if (!disabled.some((x) => x.toLowerCase() === cmdLower)) {
            disabled.push(cmdLower);
          }
        }
        data.disabledCommands = disabled;
        if (data.markModified) data.markModified("disabledCommands");
        await data.save();
        await c.cache.set(guildId + "1", data);
        return { success: true, disabledCommands: disabled };
      } catch (err) {
        return { error: err.message };
      }
    }, { context: { guildId, commandName, enabled } });

    const match = results.find((x) => x && !x.error);
    res.json(match || { success: true, disabledCommands: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute Bot Command from Dashboard into a Discord Channel
app.post(["/guilds/:id/execute-command", "/api/guilds/:id/execute-command"], async (req, res) => {
  try {
    const guildId = req.params.id;
    const { channelId, command, args = [] } = req.body;
    if (!command) return res.status(400).json({ error: "Missing command name or text" });

    const results = await manager.broadcastEval(async (c, { guildId, channelId, command, args }) => {
      try {
        const guild = c.guilds.cache.get(guildId);
        if (!guild) return null;

        // Find target channel
        let targetChannel = null;
        if (channelId) {
          targetChannel = guild.channels.cache.get(channelId);
        }
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(
            (ch) => ch.type === 0 && (ch.name.includes("bot") || ch.name.includes("cmd") || ch.name.includes("general"))
          ) || guild.channels.cache.find((ch) => ch.type === 0);
        }

        if (!targetChannel) {
          return { error: "No text channel found in guild to execute command" };
        }

        // Clean command string
        const cleanCmd = command.replace(/^\$/, "").trim().toLowerCase();
        const cmd = c.commands.get(cleanCmd) || c.commands.get(c.aliases.get(cleanCmd));

        const gConfig = await c.cache.get(guildId + "1") || await c.database.guildData.get(guildId);
        const prefix = gConfig?.prefix || "$";

        // Check if command is disabled
        if (gConfig?.disabledCommands?.includes(cleanCmd)) {
          return { error: `Command '${cleanCmd}' is currently disabled in this server.` };
        }

        if (!cmd) {
          // Send as a dashboard command dispatch message into channel
          const { EmbedBuilder } = require("discord.js");
          const embed = new EmbedBuilder()
            .setTitle(`⚡ OnyxGuard Command Execution`)
            .setDescription(`**Command:** \`${prefix}${cleanCmd} ${args.join(" ")}\`\n**Status:** Triggered via Web Dashboard`)
            .setColor("#ff2b43")
            .setTimestamp();

          await targetChannel.send({ embeds: [embed] });
          return {
            success: true,
            channelName: targetChannel.name,
            message: `Dispatched '${cleanCmd}' to #${targetChannel.name}`,
          };
        }

        // Construct mock message context to invoke command.run()
        const owner = await guild.fetchOwner().catch(() => null);
        const fakeMessage = {
          guild,
          channel: targetChannel,
          author: owner ? owner.user : c.user,
          member: owner || guild.members.me,
          content: `${prefix}${cleanCmd} ${args.join(" ")}`.trim(),
          reply: async (payload) => targetChannel.send(payload),
          delete: async () => {},
        };

        await cmd.run({ message: fakeMessage, args, prefix });

        return {
          success: true,
          channelName: targetChannel.name,
          message: `Command '${cleanCmd}' executed successfully in #${targetChannel.name}!`,
        };
      } catch (e) {
        return { error: e.message };
      }
    }, { context: { guildId, channelId, command, args } });

    const match = results.find((x) => x !== null && x !== undefined);
    if (!match || match.error) {
      return res.status(400).json(match || { error: "Command execution failed on shard" });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send Rich Embed directly from dashboard Embed Builder to a channel
app.post(["/guilds/:id/send-embed", "/api/guilds/:id/send-embed"], async (req, res) => {
  try {
    const guildId = req.params.id;
    const { channelId, channelName, content, embed } = req.body;

    const results = await manager.broadcastEval(async (c, { guildId, channelId, channelName, content, embed }) => {
      try {
        const guild = c.guilds.cache.get(guildId);
        if (!guild) return null;

        let ch = (channelId && guild.channels.cache.get(channelId)) ||
                 (channelName && guild.channels.cache.find((x) => x.name === channelName || x.name === channelName.replace("#", ""))) ||
                 guild.channels.cache.find((x) => x.type === 0);

        if (!ch) return { error: "No suitable channel found in guild" };

        const { EmbedBuilder } = require("discord.js");
        const discordEmbed = new EmbedBuilder();

        if (embed?.title) discordEmbed.setTitle(embed.title);
        if (embed?.description) discordEmbed.setDescription(embed.description);
        if (embed?.color) {
          try {
            discordEmbed.setColor(embed.color);
          } catch {
            discordEmbed.setColor("#ff2b43");
          }
        }
        if (embed?.authorName) {
          discordEmbed.setAuthor({
            name: embed.authorName,
            iconURL: embed.authorIconUrl || undefined,
          });
        }
        if (embed?.footerText) {
          discordEmbed.setFooter({
            text: embed.footerText,
            iconURL: embed.footerIconUrl || undefined,
          });
        }
        if (embed?.thumbnailUrl) discordEmbed.setThumbnail(embed.thumbnailUrl);
        if (embed?.imageUrl) discordEmbed.setImage(embed.imageUrl);

        discordEmbed.setTimestamp();

        const msg = await ch.send({
          content: content || undefined,
          embeds: [discordEmbed],
        });

        return {
          success: true,
          channelId: ch.id,
          channelName: ch.name,
          messageId: msg.id,
        };
      } catch (err) {
        return { error: err.message };
      }
    }, { context: { guildId, channelId, channelName, content, embed } });

    const match = results.find((x) => x !== null && x !== undefined);
    if (!match || match.error) {
      return res.status(400).json(match || { error: "Could not send embed to channel" });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send Test Welcomer Embed directly from dashboard to a channel
app.post(["/guilds/:id/send-test-welcome", "/api/guilds/:id/send-test-welcome"], async (req, res) => {
  try {
    const guildId = req.params.id;
    const { channelId, channelName, content, embed } = req.body;

    const results = await manager.broadcastEval(async (c, { guildId, channelId, channelName, content, embed }) => {
      try {
        const guild = c.guilds.cache.get(guildId);
        if (!guild) return null;

        let ch = (channelId && guild.channels.cache.get(channelId)) ||
                 (channelName && guild.channels.cache.find((x) => x.name === channelName || x.name === channelName.replace("#", ""))) ||
                 guild.channels.cache.find((x) => x.type === 0 && (x.name.includes("welcome") || x.name.includes("join") || x.name.includes("general"))) ||
                 guild.channels.cache.find((x) => x.type === 0);

        if (!ch) return { error: "No suitable channel found in guild" };

        const { EmbedBuilder } = require("discord.js");
        const discordEmbed = new EmbedBuilder()
          .setTitle(embed?.title || `Welcome to ${guild.name}!`)
          .setDescription(embed?.description || `Welcome to **${guild.name}**! Read the rules and enjoy your stay.`)
          .setColor(embed?.color || "#ff2b43")
          .setTimestamp();

        if (embed?.authorName) {
          discordEmbed.setAuthor({
            name: embed.authorName,
            iconURL: embed.authorIconUrl || guild.iconURL() || undefined,
          });
        }
        if (embed?.footerText) {
          discordEmbed.setFooter({
            text: embed.footerText,
            iconURL: embed.footerIconUrl || guild.iconURL() || undefined,
          });
        }
        if (embed?.thumbnailUrl) discordEmbed.setThumbnail(embed.thumbnailUrl);
        if (embed?.imageUrl) discordEmbed.setImage(embed.imageUrl);

        const msg = await ch.send({
          content: content || `✨ **[ONYXGUARD DASHBOARD TEST]** Welcome to **${guild.name}**!`,
          embeds: [discordEmbed],
        });

        return {
          success: true,
          channelId: ch.id,
          channelName: ch.name,
          messageId: msg.id,
        };
      } catch (err) {
        return { error: err.message };
      }
    }, { context: { guildId, channelId, channelName, content, embed } });

    const match = results.find((x) => x !== null && x !== undefined);
    if (!match || match.error) {
      return res.status(400).json(match || { error: "Could not send test welcome message" });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  Logger.log(`Server is running on port ${PORT}`, "shard");
});

