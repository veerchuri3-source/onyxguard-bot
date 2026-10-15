const fs = require("fs");
const path = require("path");

/**
 * Pure JavaScript JSON-based Database (100% cross-platform, zero native binaries)
 * Completely eliminates better-sqlite3 / invalid ELF header errors on Linux/Pterodactyl.
 */
class JsonDatabase {
  constructor(filePath = path.join(process.cwd(), "database.json")) {
    this.filePath = filePath;
    this.data = {};
    this.writeQueue = Promise.resolve();
    this._init();
  }

  _init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(raw);
      } else {
        // If legacy json.sqlite exists, check if we should migrate
        const sqlitePath = path.join(process.cwd(), "json.sqlite");
        if (fs.existsSync(sqlitePath)) {
          this._tryMigrateSqlite(sqlitePath);
        }
        this._saveSync();
      }
    } catch (err) {
      console.warn("⚠️ [JsonDB] Warning reading DB, initializing empty store:", err.message);
      this.data = {};
      this._saveSync();
    }
  }

  _tryMigrateSqlite(sqlitePath) {
    try {
      // Best-effort migration if better-sqlite3 is locally available
      const Database = require("better-sqlite3");
      const db = new Database(sqlitePath);
      const rows = db.prepare("SELECT * FROM json").all();
      for (const row of rows) {
        try {
          this.data[row.ID] = JSON.parse(row.json);
        } catch {
          this.data[row.ID] = row.json;
        }
      }
      db.close();
      console.log(`✅ [JsonDB] Successfully migrated ${rows.length} records from json.sqlite to database.json`);
    } catch {
      // Ignore if better-sqlite3 cannot be loaded
    }
  }

  _saveSync() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error("❌ [JsonDB] Error writing to file:", err);
    }
  }

  async _save() {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const tempPath = `${this.filePath}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
        await fs.promises.rename(tempPath, this.filePath);
      } catch (err) {
        console.error("❌ [JsonDB] Error saving database:", err);
      }
    });
    return this.writeQueue;
  }

  _getNested(key) {
    if (!key.includes(".")) return this.data[key];
    const parts = key.split(".");
    let curr = this.data;
    for (const part of parts) {
      if (curr == null || typeof curr !== "object") return undefined;
      curr = curr[part];
    }
    return curr;
  }

  _setNested(key, value) {
    if (!key.includes(".")) {
      this.data[key] = value;
      return;
    }
    const parts = key.split(".");
    let curr = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (curr[part] == null || typeof curr[part] !== "object") {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }

  _deleteNested(key) {
    if (!key.includes(".")) {
      delete this.data[key];
      return;
    }
    const parts = key.split(".");
    let curr = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (curr[part] == null || typeof curr[part] !== "object") return;
      curr = curr[part];
    }
    delete curr[parts[parts.length - 1]];
  }

  async get(key) {
    const val = this._getNested(key);
    return val === undefined ? null : JSON.parse(JSON.stringify(val));
  }

  async fetch(key) {
    return this.get(key);
  }

  async set(key, value) {
    this._setNested(key, value);
    await this._save();
    return value;
  }

  async push(key, ...values) {
    let current = this._getNested(key);
    if (!Array.isArray(current)) {
      current = [];
    }
    current.push(...values);
    this._setNested(key, current);
    await this._save();
    return current;
  }

  async pull(key, value) {
    let current = this._getNested(key);
    if (!Array.isArray(current)) return [];
    current = current.filter((item) => item !== value);
    this._setNested(key, current);
    await this._save();
    return current;
  }

  async delete(key) {
    this._deleteNested(key);
    await this._save();
    return true;
  }

  async has(key) {
    const val = this._getNested(key);
    return val !== undefined && val !== null;
  }

  async all() {
    return Object.entries(this.data).map(([id, value]) => ({ id, value }));
  }

  async clear() {
    this.data = {};
    await this._save();
    return true;
  }

  async add(key, number) {
    const current = Number(this._getNested(key)) || 0;
    const res = current + Number(number);
    await this.set(key, res);
    return res;
  }

  async sub(key, number) {
    const current = Number(this._getNested(key)) || 0;
    const res = current - Number(number);
    await this.set(key, res);
    return res;
  }
}

module.exports = JsonDatabase;
