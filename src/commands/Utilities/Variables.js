const Command = require("../../abstract/command");

module.exports = class help extends Command {
    constructor(...args) {
        super(...args, {
            name: "variables",
            aliases: ["welcomevariables", "variables"],
            description: "To get information about all variables.",
            usage: ["variable"],
            category: "Utilities",
            examples: ["variables"],
            userPerms: ["SendMessages"],
            botPerms: ["EmbedLinks", "ViewChannel", "SendMessages"],
            cooldown: 5,
            image: "https://imgur.com/TUbZ3Tk",
        });
    }

    _buildEmbed() {
        return this.client.util
            .embed()
            .setTitle("✨ Dynamic Message Placeholders & Variables")
            .setColor(this.client.config.Client.PrimaryColor)
            .setDescription(
                `Use these placeholders in your **Welcome**, **Leave**, **Greet**, and **Embed** messages! Both \`{variable}\` and \`$variable\` formats are supported.`
            )
            .addFields(
                {
                    name: "👤 User Variables",
                    value: [
                        "`{user}` / `$user_mention` - Mentions the user (`@User`)",
                        "`{user.name}` / `$user_username` - User's username",
                        "`{user.displayname}` / `$user_displayname` - Server display name / nickname",
                        "`{user.tag}` / `$user_tag` - User's discriminator tag / username",
                        "`{user.id}` / `$user_id` - User's unique Discord ID",
                        "`{user.avatar}` / `$user_iconurl` - User's profile avatar URL",
                        "`{user.banner}` / `$user_banner` - User's profile banner URL",
                        "`{user.created}` / `$user_createdtimestamp` - Account creation relative date",
                        "`{user.joined}` / `$user_joinedtimestamp` - Server join relative timestamp",
                    ].join("\n"),
                },
                {
                    name: "🏰 Server Variables",
                    value: [
                        "`{server}` / `{server.name}` / `$guild_name` - Server's name",
                        "`{server.id}` / `$guild_id` - Server's Discord ID",
                        "`{server.icon}` / `{server.profile}` / `$guild_iconurl` - Server's icon URL",
                        "`{server.banner}` / `$guild_banner` - Server's banner URL",
                        "`{server.splash}` / `$guild_splash` - Server's invite splash URL",
                        "`{member.count}` / `$guild_membercount` - Total server member count",
                        "`{server.owner}` / `$guild_owner` - Server owner ID",
                    ].join("\n"),
                },
                {
                    name: "💡 Usage Example",
                    value: "```\nWelcome {user} to {server.name}!\nYou are our {member.count}th member.\n```",
                }
            )
            .setFooter({
                text: "Synapse Variables System",
                iconURL: this.client.user.displayAvatarURL(),
            });
    }

    async run({ message }) {
        const embed = this._buildEmbed();
        message?.reply({ embeds: [embed] });
    }

    async exec({ interaction }) {
        const embed = this._buildEmbed();
        interaction?.reply({ embeds: [embed] });
    }
};
