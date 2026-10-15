const Command = require("../../abstract/command");

module.exports = class help extends Command {
    constructor(...args) {
        super(...args, {
            name: "prefix",
            aliases: ["prefix", "setprefix"],
            description: "Set the prefix for the bot",
            usage: ["prefix <prefix>"],
            category: "Utilities",
            examples: ["Prefix"],
            userPerms: ["SendMessages", "ManageGuild"],
            botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
            cooldown: 5,
            image:"https://i.imgur.com/akMyNgP.png",
            options: [
                {
                    type: 3,
                    name: "prefix",
                    description: "Prefix to set",
                    required: true,
                },
            ],
        });
    }
    async run({ message, args }) {
        const data = await this.client.database.guildData.get(message?.guild.id);
        const currentPrefix = data?.prefix || message?.guild?.config?.prefix || this.client.config.Client.Prefix || "$";
        if (!args[0]) {
            return message?.reply(`The current prefix is \`${currentPrefix}\``);
        }
        if (args[0].length > 5) {
            return message?.reply("Prefix can only be 5 characters long");
        }
        let newPrefix = args[0];
        data.prefix = newPrefix;
        await this.client.database.guildData.putPrefix(message?.guild.id, newPrefix);
        if (message?.guild) {
            if (!message.guild.config) message.guild.config = {};
            message.guild.config.prefix = newPrefix;
        }
        return message?.reply(`Prefix has been set to \`${newPrefix}\``);
    }

    async exec({ interaction }) {
        const data = await this.client.database.guildData.get(
            interaction?.guild.id
        );
        const currentPrefix = data?.prefix || interaction?.guild?.config?.prefix || this.client.config.Client.Prefix || "$";
        const input = interaction?.options.getString("prefix");
        if (!input) {
            return interaction?.reply(
                `The current prefix is \`${currentPrefix}\``
            );
        }
        if (input.length > 5) {
            return interaction?.reply("Prefix can only be 5 characters long");
        }
        let newPrefix = input;
        data.prefix = newPrefix;
        await this.client.database.guildData.putPrefix(interaction?.guild.id, newPrefix);
        if (interaction?.guild) {
            if (!interaction.guild.config) interaction.guild.config = {};
            interaction.guild.config.prefix = newPrefix;
        }
        return interaction?.reply(`Prefix has been set to \`${newPrefix}\``);
    }
};
