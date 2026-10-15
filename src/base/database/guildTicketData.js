const mongoData = require("../../models/guildTicketData");

module.exports = class guildTicketData {
  /**
   * @param {import('../database')} database
   */
  constructor(database) {
    this.database = database;
  }

  async get(id) {
    let data = await mongoData.findOne({ id: id });
    if (!data) {
      data = new mongoData({ id: id });
      await data.save();
    }
    return data;
  }

  async post(id, value) {
    let data = await mongoData.findOne({ id: id });
    if (!data) {
      data = new mongoData({ id: id });
      await data.save();
    }
    if (data) {
      data = value;
      await data.save();
      return data;
    }
  }
};
