/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
let localConfig = {};
try {
  localConfig = require("./config.local.json");
} catch (e) {}

module.exports = {
  Shards: {
    totalShards: "auto",
    shardsPerCluster: 4,
    totalClusters: "auto",
  },
  Client: {
    Token: process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN || localConfig.Token || "",
    Prefix: process.env.PREFIX || "$",
    VanityGuardToken: "",
    botId: process.env.DISCORD_CLIENT_ID || process.env.BOT_ID || process.env.CLIENT_ID || "1556216846188019712",
    botSecret: process.env.DISCORD_CLIENT_SECRET || process.env.BOT_SECRET || process.env.CLIENT_SECRET || localConfig.botSecret || "",
    CallbackURL: "http://localhost:5173/dashboard",
    OAuthURL:
      "https://discord.com/oauth2/authorize?client_id=1556216846188019712&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fdashboard&scope=identify+guilds",
    TopGG: "",
    DefaultPermissions: ["SendMessages", "EmbedLinks", "ReadMessageHistory"],
    DefaultUsersPermissions: ["SendMessages"],
    Owners: ["1500056784000253973"],
    VanityGuard: "",
    QuiteJsk: [""],
    OpenAIApi: "",
    LogsChannel: "",
    Emojis: {
      Flags: {
        BugHunter1: "<:bug:1312812690103734483>",
        BugHunter2: "<:LoveBugs_bughunter2:1312807664748724335>",
        CertifiedModerator: "<:Moderator:1415363728924217546>",
        Exployee: "<:DISCORD_EMPLOYEE:1339516899314241546>",
        EarlySupporter: "<:supporter:1312806950479597609>",
        EarlyVerifiedBotDeveloper:
          "<:verifydeveloperbadget:1312812879115714690>",
        HyperSquadBalance: "<:hypesqaud_balance:1312812330223931495>",
        HyperSquadBravery: "<:hypesqaud_bravery:1312812436683882516>",
        HyperSquadBrilliance: "<:hypesqaud_brilliance:1312812440278401136>",
        HyperSquadEvent: "<:devil_Developer:1312806204824879135>",
        PartnerServerOwner: "<:partner:1312806692315988038>",
        VerifiedBot: "<:activedev:1312813087060918282>",
        SupportCommands: "<:tick:1312811188278792203>",
      },
    },

    PrimaryColor: "#2b2d31",
    ErrorColor: "#ff0000",
    SuccessColor: "#00ff4cff",
    emoji: {
      verify: "✅",
      automod: "🤖",
      antinuke: "🛡️",
      prismoemo: "⚡",
      invite: "🔗",
      support: "💬",
      welcome: "👋",
      moderation: "🔨",
      utility: "⚙️",
      fun: "🎉",
      image: "🖼️",
      giveaway: "🎁",
      tick: "✅",
      cross: "❌",
      gear: "⚙️",
      seen: "👁️",
      down: "⬇️",
      up: "⬆️",
      online: "🟢",
      idle: "🟡",
      dnd: "🔴",
      member: "👤",
      gift: "🎁",
      giveaway2: "🎉",
      loading: "⏳",
      developerEmoji: "👑",
      communitymanager: "🛡️",
      ownerEmoji: "👑",
      adminEmoji: "🛡️",
      managerEmoji: "💼",
      moderatorEmoji: "🔨",
      staffEmoji: "👥",
      supporterEmoji: "💖",
      bughunterEmoji: "🐛",
      specialonesEmoji: "⭐",
      add: "➕",
      info: "ℹ️",
      channel: "#️⃣",
      Exclamation: "❕",
      emptybar: "▬",
      barleft: "◀",
      barmid: "▬",
      barright: "▶",
      emptybarend: "▭",
      arrow: "➜",
      dot: "•",
      join: "📥",
      leave: "📤",
      fake: "⚠️",
      memberadd: "➕",
      star: "⭐",
      guide: "📖",
    },
    serverId: "",
    roleIds: {
      ownerRoleId: "",
      communityManagerRoleId: "",
      adminRoleId: "",
      developerRoleId: "",
      managerRoleId: "",
      moderatorRoleId: "",
      staffRoleId: "",
      supporterRoleId: "",
      bughunterRoleId: "",
      specialonesRoleId: "",
    },
  },
  Database: {
    Uri:
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb+srv://CodeXDev:OMzLUdWAMMquDVLQ@cluster0.drpmd3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  },
  Webhook: {
    Url: "https://discord.com/api/webhooks/1415292126354210846/-4uX0Z7ZzMvnknv1lXx4vq22w96ZHWjwYw3nqcAQE0bngIln1G-pbV7yTrkMfZlLim1O",
  },
  Url: {
    InviteURL:
      "https://discord.com/oauth2/authorize?client_id=1556216846188019712&permissions=8&integration_type=0&scope=bot",
    SupportURL: "https://discord.gg/codexdev",
    GuideURL: "https://docs.prismo.one",
    DashboardURL: "https://onyxguard-dashboard.vercel.app",
    CallbackURL: "https://onyxguard-dashboard.vercel.app/dashboard",
    OAuthURL:
      "https://discord.com/oauth2/authorize?client_id=1556216846188019712&response_type=code&redirect_uri=https%3A%2F%2Fonyxguard-dashboard.vercel.app%2Fdashboard&scope=identify+guilds",
  },
};
