const mongoData = require("../../models/antiNukeData");

module.exports = class antiNukeData {
  /**
   *
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
      this.database.client.cache.set(id, data);
      return data;
    }
    if (data) {
      this.database.client.cache.set(id, data);
      return data;
    }
  }

  async post(id, value) {
    let data = await mongoData.findOne({ id: id });
    if (!data) {
      data = new mongoData({ id: id, ...(value || {}) });
      await data.save();
      await this.database.client.cache.set(id, data);
      return data;
    }
    if (data) {
      if (value && typeof value === "object") {
        Object.assign(data, value);
        if (value.features) {
          data.features = { ...(data.features || {}), ...value.features };
          data.markModified && data.markModified("features");
        }
      }
      await data.save();
      await this.database.client.cache.set(id, data);
      return data;
    }
  }
  async find() {
    let data = await mongoData.find();
    if (data) return data;
  }
};
