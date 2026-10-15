const { EmbedBuilder } = require("discord.js");
const Command = require("../../abstract/command");

module.exports = class TodoCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "todo",
      aliases: ["task"],
      category: "Utility",
      description: "Manage your personal to-do list",
      usage: ["todo add/check/remove/list <task|page>"],
      examples: [
        "todo add buy milk",
        "todo list 2",
        "todo check 1",
        "todo remove 3",
      ],
      userPerms: ["SendMessages"],
      botPerms: ["SendMessages", "EmbedLinks"],
      guildOnly: true,
      slash: false, // set true and add option parsing if you want slash support
    });
  }

  async run({ message, args }) {
    await this.handleTodo(message, args || []);
  }

  async exec({ interaction }) {
    // Basic placeholder for slash support: you can add proper slash options if desired.
    // For now, if you call as slash you must provide a single string like: /todo query:"add buy milk"
    const raw = interaction.options?.getString("query") || "";
    const args = raw ? raw.split(/\s+/) : [];
    await this.handleTodo(interaction, args);
  }

  // helper which will attempt to reply (interaction or message)
  async _safeReply(ctx, replyPayload = {}, ephemeral = false) {
    try {
      // If it's an interaction, set ephemeral if asked
      if (typeof ctx.reply === "function" && ctx.channel === null) {
        // interaction (channel may be null for some interactions)
        if (typeof replyPayload === "string") {
          await ctx.reply({ content: replyPayload, ephemeral });
        } else {
          await ctx.reply(Object.assign({}, replyPayload, { ephemeral }));
        }
        return;
      }

      // For messages and interactions with channel, prefer ctx.reply if available
      if (typeof ctx.reply === "function") {
        if (typeof replyPayload === "string") {
          await ctx.reply(replyPayload);
        } else {
          await ctx.reply(replyPayload);
        }
        return;
      }

      // fallback to channel.send
      const channel = ctx.channel || (ctx.message && ctx.message.channel);
      if (channel && typeof channel.send === "function") {
        if (typeof replyPayload === "string") {
          await channel.send(replyPayload);
        } else {
          await channel.send(replyPayload);
        }
        return;
      }

      // last resort: throw
      throw new Error("No way to send a reply from this context.");
    } catch (err) {
      // if interaction already replied / deferred, try followUp
      try {
        if (typeof ctx.followUp === "function") {
          if (typeof replyPayload === "string") {
            await ctx.followUp(replyPayload);
          } else {
            await ctx.followUp(replyPayload);
          }
          return;
        }
      } catch (e) {
        // ignore
      }
      // swallow to avoid unhandled rejections
      return;
    }
  }

  async handleTodo(ctx, args = []) {
    // determine user and id robustly
    const user = ctx.user || (ctx.author && ctx.author) || null;
    const userId = user?.id || (ctx.author && ctx.author.id);
    const username =
      user?.username || (ctx.author && ctx.author.username) || "User";

    if (!userId) {
      return this._safeReply(
        ctx,
        "❌ Couldn't determine user. This command must be run in-guild."
      );
    }

    const action = (args[0] || "").toLowerCase();

    // fetch todos (defensive)
    const key = `todo_${userId}`;
    let todos = (await this.client.db.get(key)) || [];
    if (!Array.isArray(todos)) todos = [];

    if (!action) {
      return this._safeReply(
        ctx,
        "❌ Usage: `todo add/check/remove/list <task|page>`"
      );
    }

    switch (action) {
      case "add": {
        const taskText = args.slice(1).join(" ").trim();
        if (!taskText) {
          return this._safeReply(
            ctx,
            "❌ Please provide a task to add. Example: `todo add Buy groceries`"
          );
        }

        todos.push({ task: taskText, done: false, createdAt: Date.now() });
        await this.client.db.set(key, todos);

        return this._safeReply(
          ctx,
          `✅ Added task: **${taskText}**`
        );
      }

      case "check": {
        const index = parseInt(args[1], 10) - 1;
        if (isNaN(index) || !todos[index]) {
          return this._safeReply(
            ctx,
            "❌ Invalid task number. Use `todo list` to view numbers."
          );
        }

        todos[index].done = true;
        await this.client.db.set(key, todos);

        return this._safeReply(
          ctx,
          `✅ Marked task #${index + 1} as done.`
        );
      }

      case "remove": {
        const index = parseInt(args[1], 10) - 1;
        if (isNaN(index) || !todos[index]) {
          return this._safeReply(
            ctx,
            "❌ Invalid task number. Use `todo list` to view numbers."
          );
        }

        const [removed] = todos.splice(index, 1);
        await this.client.db.set(key, todos);

        return this._safeReply(ctx, `🗑️ Removed task: **${removed.task}**`);
      }

      case "list": {
        if (!todos.length) {
          return this._safeReply(ctx, "📋 Your to-do list is empty.");
        }

        const page = Math.max(1, Number(args[1]) || 1);
        const pageSize = 5;
        const totalPages = Math.ceil(todos.length / pageSize) || 1;
        const pageIndex = Math.min(page - 1, Math.max(0, totalPages - 1));
        const start = pageIndex * pageSize;
        const pageTasks = todos.slice(start, start + pageSize);

        const description = pageTasks
          .map((t, i) => {
            const globalIndex = start + i + 1;
            const status = t.done ? "✅" : "❌";
            // keep simple one-line per task
            return `${status} **#${globalIndex}** ${t.task}`;
          })
          .join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`📝 ${username}'s To-Do List`)
          .setColor("#5865F2")
          .setDescription(description)
          .setFooter({
            text: `Page ${pageIndex + 1}/${totalPages} • Total: ${
              todos.length
            } tasks`,
          });

        return this._safeReply(ctx, { embeds: [embed] });
      }

      default:
        return this._safeReply(
          ctx,
          "❌ Invalid action. Use `add`, `check`, `remove`, or `list`."
        );
    }
  }
};
