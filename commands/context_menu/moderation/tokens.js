const { CommandInteraction, ApplicationCommandType } = require('discord.js');
const tokensSchema = require('../../../schemas/misc/tokens_schema');
const path = require('path');

module.exports = {
    name: `Award 10 Tokens`,
    defaultMemberPermissions: ['ManageRoles'],
    cooldown: 5,
    type: ApplicationCommandType.Message,
    /**
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, channel, member } = interaction;

        await interaction.deferReply({ ephemeral: true });

        const tokenLog = guild.channels.cache.get(process.env.CREDITLOG_CHAN);
        const fetchMsg = await channel.messages.fetch(interaction.targetId);
        const target = fetchMsg.author;

        if (target.bot) {
            return interaction.editReply({
                content: `${process.env.BOT_DENY} This user is a bot`
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem editing an interaction: `, err));
        }

        // Fetch the user's db entry
        const results = await tokensSchema.find({ userId: target.id });

        // Check to see if the user is in our database yet, if not, add them
        if (results.length === 0) {
            await tokensSchema.create({
                userId: target.id,
                tokens: 10
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem updating a database entry: `, err));

            // Log when a user's tokens increase or decrease
            tokenLog.send({
                content: `${process.env.TOKENS_AWARD} ${target} was awarded **10** tokens by ${member}
${process.env.TOKENS_UP} ${member} gained **10** tokens as an award for their helpful post, they now have **10** tokens`,
                allowedMentions: {
                    parse: []
                }
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem sending a message: `, err));
        }

        // Add the desired amount of tokens
        for (const data of results) {
            const { tokens } = data;
            await tokensSchema.updateOne({
                userId: target.id
            }, {
                tokens: tokens + 10,
            }, {
                upsert: true
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem updating a database entry: `, err));

            // Log when a user's tokens increase or decrease
            tokenLog.send({
                content: `${process.env.TOKENS_AWARD} ${target} was awarded **10** tokens by ${member}
${process.env.TOKENS_UP} ${member} gained **10** tokens as an award for their helpful post, they now have **${tokens + 10}** tokens`,
                allowedMentions: {
                    parse: []
                }
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem sending a message: `, err));
        }

        interaction.editReply({
            content: `${process.env.BOT_CONF} 10 tokens successfully awarded to ${target}`
        }).catch(err => console.error(`${path.basename(__filename)} There was a problem editing an interaction: `, err));
    }
}