/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
require("./patchInteraction");
const {
  IntentsBitField,
  ActivityType,
  Partials,
  EmbedBuilder,
} = require("discord.js");
const Cluster = require("discord-hybrid-sharding");
const JsonDatabase = require("./JsonDB");
const {
  Guilds,
  GuildModeration,
  GuildMembers,
  GuildMessages,
  MessageContent,
  GuildMessageReactions,
  GuildEmojisAndStickers,
  GuildVoiceStates,
  GuildIntegrations,
  GuildMessageTyping,
  GuildWebhooks,
  GuildPresences,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = IntentsBitField.Flags;
const AriaClient = require("./SynapseClient");
const { Client } = require("../../config");

require("events").defaultMaxListeners = 1000;

// 🔹 Initialize Client
const client = new AriaClient({
  intents: [
    Guilds,
    GuildModeration,
    GuildMembers,
    GuildPresences,
    GuildMessages,
    MessageContent,
    GuildMessageReactions,
    GuildEmojisAndStickers,
    GuildVoiceStates,
    GuildIntegrations,
    GuildMessageTyping,
    GuildWebhooks,
  ],

  presence: {
    status: "online",
    activities: [
      {
        name: "$help | ONYX GUARD PROTECTS YOU!",
        type: ActivityType.Listening,
      },
    ],
  },
  allowedMentions: { parse: ["users"], repliedUser: false },
  shards: Cluster.ClusterClient.getInfo().SHARD_LIST,
  shardCount: Cluster.ClusterClient.getInfo().TOTAL_SHARDS,
  debugger: true,
  partials: [
    Partials.Message,
    Partials.GuildMember,
    Partials.Reaction,
    Partials.User,
  ],
});
client.db = new JsonDatabase();

// ---------------- POLL SYSTEM ----------------
client.polls = new Map();

/**
 * Structure of client.polls:
 * client.polls.set(messageId, {
 *   question: "Poll question",
 *   options: ["Option 1", "Option 2"],
 *   votes: { optionIndex: [userIds] },
 *   channelId: "123",
 *   authorId: "456"
 * });
 */

// ---------------- ERROR HANDLERS ----------------
client.login(Client.Token);

process.on("uncaughtException", (error) => {
  const ignoredCodes = [
    10001, 10003, 10004, 10005, 10008, 10062, 4000, 50001, 50013, 50035,
  ];
  if (ignoredCodes.includes(error.code)) return;
  console.error("❌ Uncaught Exception:", error);
});

process.on("triggerUncaughtException", (error) => {
  console.error("❌ Triggered Exception:", error);
});
