const NodeCache = require("node-cache");

module.exports = class CacheManager {
  /**
   * @param {import('./SynapseClient')} client
   */
  constructor(client) {
    this.client = client;
    // No TTL expiry — antinuke data must always be fresh until explicitly invalidated
    this.cache = new NodeCache({ useClones: false });
  }

  async get(key) {
    try {
      const data = this.cache.get(String(key));
      return data === undefined ? null : data;
    } catch (error) {
      console.error("CacheManager.get error:", error);
      return null;
    }
  }

  async set(key, value) {
    try {
      this.cache.set(String(key), value);
      return { status: true };
    } catch (error) {
      console.error("CacheManager.set error:", error);
      return { status: false, error: error.message };
    }
  }

  /**
   * Bulk-load an array of documents that each have an `id` field.
   * Previously this iterated by numeric array index — now uses doc.id.
   */
  async setbulk(bulkdata) {
    try {
      if (Array.isArray(bulkdata)) {
        for (const doc of bulkdata) {
          if (doc && doc.id != null) {
            this.cache.set(String(doc.id), doc);
          }
        }
      } else {
        // Fallback for plain object maps
        for (const key of Object.keys(bulkdata)) {
          this.cache.set(key, bulkdata[key]);
        }
      }
      return { status: true };
    } catch (error) {
      console.error("CacheManager.setbulk error:", error);
      return { status: false, error: error.message };
    }
  }

  async flush() {
    try {
      this.cache.flushAll();
      return { status: true };
    } catch (error) {
      console.error("CacheManager.flush error:", error);
      return { status: false, error: error.message };
    }
  }

  async delete(key) {
    try {
      const success = this.cache.del(String(key));
      return { status: success };
    } catch (error) {
      console.error("CacheManager.delete error:", error);
      return { status: false, error: error.message };
    }
  }
};
