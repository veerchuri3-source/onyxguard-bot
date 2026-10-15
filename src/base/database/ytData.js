const mongoData = require("../../models/ytData");

module.exports = class ytData {
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
        }
        if (!Array.isArray(data.postedvids)) data.postedvids = [];
        return data;
    }
    async post(id, value) {
        let data = await mongoData.findOne({ id: id });
        if (!data) {
            data = new mongoData({ id: id });
        }
        if (value && typeof value === "object") {
            if (value.ytchannel !== undefined) data.ytchannel = value.ytchannel;
            if (value.channel !== undefined) data.channel = value.channel;
            if (value.ping !== undefined) data.ping = value.ping;
            if (Array.isArray(value.postedvids)) {
                data.postedvids = value.postedvids;
                if (data.markModified) data.markModified("postedvids");
            }
        }
        await data.save();
        return data;
    }

    async all() {
        const data = await mongoData.find();
        return data;
    }
};