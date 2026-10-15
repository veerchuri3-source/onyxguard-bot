/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const { model, Schema } = require("mongoose");

const guildTicketData = new Schema({
  id: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  channel: { type: String, default: null },
  messageId: { type: String, default: null },
  category: { type: String, default: null },
  role: { type: String, default: null },
  logsChannel: { type: String, default: null },
  ticketCount: { type: Number, default: 0 },
  limit: { type: Number, default: 1 },
});

module.exports = model("guildTicketData", guildTicketData);
