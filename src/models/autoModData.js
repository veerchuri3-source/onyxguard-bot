/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const { model, Schema } = require("mongoose");

const autoModData = new Schema(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: false },
    logchannelid: { type: String, required: false, default: null },
    whitelistusers: { type: Array, required: true, default: [] },
    whitelistroles: { type: Array, required: true, default: [] },
    features: {
      type: Object,
      default: {
        antiSpam: false,
        antiCaps: false,
        antiLink: false,
        antiMention: false,
        antiWord: false,
      },
    },
  },
  { strict: false }
);

module.exports = model("autoModData", autoModData);
