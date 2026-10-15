/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Prismo License v2.0
 */
const Command = require("../../abstract/command");
const { PermissionsBitField, MessageFlags } = require("discord.js");

module.exports = class VerifySetup extends Command {
  constructor(...args) {
    super(...args, {
      name: "verify-setup",
      aliases: ["verifysetup"],
      description: "Set up automatic 2-role server verification system (Verified & Unverified)",
      category: "Verification",
      usage: ["verify-setup"],
      userPerms: ["Administrator"],
      botPerms: ["ViewChannel", "SendMessages", "ManageRoles", "ManageChannels", "EmbedLinks"],
      guildOnly: true,
      cooldown: 5,
    });
  }

  async run({ message, args }) {
    if (!message.guild) return;

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Only administrators can run this command.");
    }

    const verifyCmd = this.client.commands.get("verification");
    if (verifyCmd) {
      return verifyCmd.handleSetup(message.guild, (content) => message.reply(content));
    }
  }

  async exec({ interaction }) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Use this command in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can run this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const verifyCmd = this.client.commands.get("verification");
    if (verifyCmd) {
      return verifyCmd.handleSetup(interaction.guild, (content) => interaction.editReply(content));
    }
  }
};
