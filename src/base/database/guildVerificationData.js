const mongoData = require("../../models/guildVerificationData");
module.exports = class guildVerificationData {
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
        if (!Array.isArray(data.ignoredChannels)) data.ignoredChannels = [];
        return data;
    }
    async post(id, value) {
        let data = await mongoData.findOne({ id: id });
        if (!data) {
            data = new mongoData({ id: id });
        }
        if (value && typeof value === "object") {
            if (value.enabled !== undefined) data.enabled = value.enabled;
            if (value.channel !== undefined) data.channel = value.channel;
            if (value.role !== undefined) data.role = value.role;
            if (value.unverifiedRole !== undefined) data.unverifiedRole = value.unverifiedRole;
            if (Array.isArray(value.ignoredChannels)) {
                data.ignoredChannels = value.ignoredChannels;
                if (data.markModified) data.markModified("ignoredChannels");
            }
        }
        await data.save();
        return data;
    }
};