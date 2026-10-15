module.exports = class WelcomeFunction {
  /**
   *
   * @param {import('../SynapseClient')} client
   */
  constructor(client) {
    this.client = client;
  }
  async setPreset(message, args) {}
};
