const mongoData = require("../../models/ticketData");

module.exports = class ticketData {
  /**
   * @param {import('../database')} database
   */
  constructor(database) {
    this.database = database;
  }

  async getByChannel(channelId) {
    return await mongoData.findOne({ channelId });
  }

  async getOpenByUser(guildId, userId) {
    return await mongoData.find({ guildId, userId, closed: false });
  }

  async create(data) {
    const ticket = new mongoData(data);
    await ticket.save();
    return ticket;
  }

  async post(channelId, value) {
    let data = await mongoData.findOne({ channelId });
    if (!data) {
      data = new mongoData(value);
      await data.save();
      return data;
    }
    Object.assign(data, value);
    await data.save();
    return data;
  }

  async close(channelId, closedBy) {
    const ticket = await mongoData.findOne({ channelId });
    if (!ticket) return null;
    ticket.closed = true;
    ticket.closedBy = closedBy;
    ticket.closedAt = new Date();
    await ticket.save();
    return ticket;
  }

  async find(filter = {}) {
    return await mongoData.find(filter);
  }
};
