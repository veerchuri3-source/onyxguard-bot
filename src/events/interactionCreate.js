/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { BaseInteraction, PermissionsBitField, MessageFlags } = require("discord.js");


module.exports = class interactionCreate extends Event {
  get name() {
    return "interactionCreate";
  }
  get once() {
    return false;
  }

  /**
   * @param {BaseInteraction} interaction
   */
  async run(interaction) {
    try {
      if (!interaction?.guild || interaction?.channel.type == 1)
        return interaction?.reply({
          content: "This command is not available in DMs!",
          flags: MessageFlags.Ephemeral,
        });

      if (!interaction?.guild.config) {
        interaction.guild.config = await this.client.database.guildData.get(
          interaction?.guild.id
        );
      }
      interaction.guild.config = await this.client.database.guildData.get(
        interaction?.guild.id
      );

      /**
       * Ticket Interaction Handling
       */
      if (interaction?.isButton() && interaction?.customId === "ticket_open") {
        return await this.client.ticketManager.showCreateModal(interaction);
      }

      if (
        interaction?.isModalSubmit() &&
        interaction?.customId === "ticket_modal_create"
      ) {
        return await this.client.ticketManager.handleModalCreate(interaction);
      }

      if (interaction?.isButton() && interaction?.customId === "ticket_claim") {
        return await this.client.ticketManager.handleClaim(interaction);
      }

      if (interaction?.isButton() && interaction?.customId === "ticket_close") {
        return await this.client.ticketManager.handleCloseRequest(interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId === "ticket_confirm_close"
      ) {
        return await this.client.ticketManager.handleCloseConfirm(interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId === "ticket_cancel_close"
      ) {
        return await this.client.ticketManager.handleCloseCancel(interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId === "ticket_transcript"
      ) {
        return await this.client.ticketManager.handleTranscript(interaction);
      }

      /**
       * Other interactions (your existing checks)
       */
      if (
        interaction?.isButton() &&
        (interaction?.customId === "verify_button" || interaction?.customId === "verify_server")
      ) {
        if (!interaction.inGuild()) return;

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });

        try {
          const guild = interaction.guild;
          const data = await this.client.database.guildVerificationData.get(guild.id).catch(() => null);

          let verified = null;
          let unverified = null;

          if (data && data.role) {
            verified =
              guild.roles.cache.get(data.role) ||
              (await guild.roles.fetch(data.role).catch(() => null));
          }
          if (!verified) {
            verified = guild.roles.cache.find((r) => r.name.toLowerCase() === "verified");
          }

          if (data && data.unverifiedRole) {
            unverified =
              guild.roles.cache.get(data.unverifiedRole) ||
              (await guild.roles.fetch(data.unverifiedRole).catch(() => null));
          }
          if (!unverified) {
            unverified = guild.roles.cache.find((r) => r.name.toLowerCase() === "unverified");
          }

          if (!unverified) {
            return interaction.editReply(
              "❌ Verification is not configured. Ask an administrator to run the setup command."
            );
          }

          const botMember = await guild.members.fetchMe().catch(() => null);

          if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.editReply(
              "❌ The bot needs Manage Roles permission."
            );
          }

          if (
            (verified && verified.position >= botMember.roles.highest.position) ||
            unverified.position >= botMember.roles.highest.position
          ) {
            return interaction.editReply(
              "❌ Move the bot's highest role above the verification roles."
            );
          }

          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) {
            return interaction.editReply(
              "❌ Verification failed. Please contact a server administrator."
            );
          }

          if (verified && member.roles.cache.has(verified.id) && !member.roles.cache.has(unverified.id)) {
            return interaction.editReply("✅ You are already verified!");
          }

          // 1. Remove Unverified role so all server channels become visible
          if (member.roles.cache.has(unverified.id)) {
            await member.roles.remove(unverified, "Completed verification").catch(() => {});
          }

          // 2. Add Verified role (cosmetic display role)
          if (verified && !member.roles.cache.has(verified.id)) {
            await member.roles.add(verified, "Completed verification").catch(() => {});
          }

          return interaction.editReply(
            "✅ Verification successful! Server channels unlocked."
          );
        } catch (error) {
          console.error("[Verification error]", error);

          return interaction.editReply(
            "❌ Verification failed. Please contact a server administrator."
          ).catch(() => {});
        }
      }

      if (
        interaction?.isButton() &&
        interaction?.customId.startsWith("giveaway-")
      ) {
        let id = interaction?.customId.split("-")[1];
        let giveaway = this.client.giveawayManager.giveaways.find(
          (g) => g.messageId === id
        );
        if (!giveaway)
          return interaction?.reply({
            content: `This giveaway is not found!`,
            flags: MessageFlags.Ephemeral,
          });
        if (giveaway.ended)
          return interaction?.reply({
            content: `This giveaway is ended!`,
            flags: MessageFlags.Ephemeral,
          });
        if (giveaway.entered.includes(interaction?.user.id)) {
          giveaway.entered = giveaway.entered.filter(
            (u) => u !== interaction?.user.id
          );
          this.client.giveawayManager.editData(giveaway);
          const button = await this.client.giveawayManager.embedButton(
            giveaway
          );
          interaction?.message?.edit({
            components: [this.client.util.row().addComponents(button)],
          });
          return interaction?.reply({
            content: `You have left the giveaway successfully!`,
            flags: MessageFlags.Ephemeral,
          });
        }
        interaction?.reply({
          content: `You have joined the giveaway successfully!`,
          flags: MessageFlags.Ephemeral,
        });
        giveaway.entered.push(interaction?.user.id);
        this.client.giveawayManager.editData(giveaway);
        const button = await this.client.giveawayManager.embedButton(giveaway);
        interaction?.message?.edit({
          components: [this.client.util.row().addComponents(button)],
        });
      }

      if (
        interaction?.isModalSubmit() &&
        interaction?.customId === "modal_verification_sumbit"
      ) {
        return this.client.emit("serverVerificationSubmit", interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId.startsWith("setup_")
      ) {
        if (interaction?.user.id !== interaction?.guild?.ownerId)
          return interaction.reply({
            content: `Only the server owner can use this button!`,
            flags: MessageFlags.Ephemeral,
          });
        await interaction?.reply({
          content: `Setup has been started!`,
          flags: MessageFlags.Ephemeral,
        });
        this.client.commandFunctions.SetupFunction.setup(interaction, true);
      }

      if (interaction?.isButton() && interaction?.customId == "eval_delete") {
        return interaction?.message?.delete().catch(() => {});
      }



      // ✅ Slash command handling
      if (interaction?.type != 2) return;
      const command = this.client.commands.get(interaction?.commandName);
      if (!command) return;

      // ... (rest of your command permission checks unchanged)

      let cmdr = command.exec({ interaction });
    } catch (error) {
      return;
    }
  }
};
