/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const { model, Schema } = require("mongoose");

const antiNukeData = new Schema({
    id: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: false },
    punishment: { type: String, required: true, default: "ban" },
    whitelistusers: { type: Array, required: true, default: [] },
    logchannelid: { type: String, required: false, default: null },
    antivanity: { type: Boolean, required: true, default: true },
    prismorole: { type: String, required: false, default: null },
    features: {
        type: Object,
        default: {
            antiBan: false,
            antiUnban: false,
            antiKick: false,
            antiBot: false,
            antiChannelCreate: false,
            antiChannelDelete: false,
            antiChannelUpdate: false,
            antiRoleCreate: false,
            antiRoleDelete: false,
            antiRoleUpdate: false,
            antiMemberUpdate: false,
            antiWebhook: false,
            antiGuildUpdate: false,
            antiMemberPrune: false,
            antiPing: false,
        },
    },
}, { strict: false });

module.exports = model("antiNukeData", antiNukeData);
