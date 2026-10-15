/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const PrismoClient = require("../base/SynapseClient");
const request = new (require("rss-parser"))();
class Youtube_notification {
  /**
   * @param {PrismoClient} client;
   */
  constructor(client) {
    this.client = client;
  }

  async checkyt() {
    try {
      const data = await this.client.database.ytData.all();
      if (!Array.isArray(data)) return;

      const filteredData = data.filter((d) => Boolean(d && d.ytchannel && d.channel));

      for (const d of filteredData) {
        try {
          const res = await request.parseURL(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${d.ytchannel}`
          ).catch(() => null);

          if (!res?.items?.length) continue;
          const latestItem = res.items[0];
          const videoId = latestItem.id || latestItem.link;
          if (!videoId) continue;

          if (!Array.isArray(d.postedvids)) d.postedvids = [];
          if (d.postedvids.includes(videoId)) continue;

          const channel = await this.client.channels.fetch(d.channel).catch(() => null);
          if (!channel) continue;

          const author = latestItem.author || res.title || "YouTube Creator";
          const title = latestItem.title || "New Video";
          const link = latestItem.link || `https://www.youtube.com/watch?v=${videoId.replace("yt:video:", "")}`;

          const pingText = d.ping ? "@everyone" : "Hey everyone";
          const message = `${pingText}, **${author}** just uploaded a new video! | **${title}**\n${link}`;

          await channel.send({
            content: message,
            allowedMentions: { parse: d.ping ? ["everyone"] : [] },
          }).catch((err) => {
            console.error("Failed to send YouTube notification:", err);
          });

          d.postedvids.push(videoId);
          // Keep array from growing infinitely (keep last 50 vids)
          if (d.postedvids.length > 50) {
            d.postedvids = d.postedvids.slice(-50);
          }
          await this.client.database.ytData.post(d.id, d);
        } catch (innerErr) {
          console.error("Error processing YouTube channel:", d.ytchannel, innerErr);
        }
      }
    } catch (error) {
      console.error("YouTube notifier checkyt error:", error);
    }
  }
}

module.exports = Youtube_notification;
