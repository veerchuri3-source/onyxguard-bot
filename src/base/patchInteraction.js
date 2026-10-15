/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const djs = require("discord.js");
const { MessageFlags } = djs;

/**
 * Normalizes interaction response options so deprecated 'ephemeral'
 * is converted to 'flags: MessageFlags.Ephemeral' (64) and removed,
 * completely suppressing Discord.js v14/v15 deprecation warnings.
 */
function normalizeInteractionOptions(options) {
  if (!options || typeof options !== "object") return options;
  if ("ephemeral" in options) {
    if (options.ephemeral) {
      options.flags = (options.flags ?? 0) | MessageFlags.Ephemeral;
    }
    delete options.ephemeral;
  }
  return options;
}

// Monkey-patch interaction classes in discord.js
const patchedMethods = new WeakSet();

for (const cls of Object.values(djs)) {
  if (typeof cls === "function" && cls.prototype) {
    for (const method of ["reply", "deferReply", "followUp", "editReply"]) {
      if (typeof cls.prototype[method] === "function") {
        const originalMethod = cls.prototype[method];
        if (!patchedMethods.has(originalMethod)) {
          cls.prototype[method] = function (opts, ...args) {
            return originalMethod.call(this, normalizeInteractionOptions(opts), ...args);
          };
          patchedMethods.add(cls.prototype[method]);
        }
      }
    }
  }
}

module.exports = { normalizeInteractionOptions };
