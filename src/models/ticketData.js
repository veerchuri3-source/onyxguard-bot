/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const { model, Schema } = require("mongoose");

const ticketData = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  ticketNumber: { type: Number, required: true },
  reason: { type: String, default: "No reason provided" },
  claimedBy: { type: String, default: null },
  closed: { type: Boolean, default: false },
  closedBy: { type: String, default: null },
  closedAt: { type: Date, default: null },
  openedAt: { type: Date, default: Date.now },
});

module.exports = model("ticketData", ticketData);
