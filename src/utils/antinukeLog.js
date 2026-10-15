module.exports = {
  /**
   * Send an antinuke alert to the configured log channel.
   * Uses in-memory cache first to avoid DB round-trips on every event.
   */
  async logAnti(client, guild, payload) {
    try {
      // Try cache first, fall back to DB
      let anti = await client.cache.get(guild.id);
      if (!anti) {
        anti = await client.database.antiNukeData.get(guild.id);
        if (anti) await client.cache.set(guild.id, anti);
      }
      if (!anti || !anti.enabled || !anti.logchannelid) return;

      const ch = guild.channels.cache.get(anti.logchannelid);
      if (!ch) return;

      if (typeof payload === "string") {
        return ch.send({ content: payload }).catch(() => {});
      } else {
        return ch.send(payload).catch(() => {});
      }
    } catch (err) {
      console.error("AntiNuke log error:", err);
    }
  },
};
