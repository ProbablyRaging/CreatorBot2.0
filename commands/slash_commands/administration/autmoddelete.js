const { CommandInteraction, ApplicationCommandType, AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationActionType } = require("discord.js");
const { sendResponse } = require('../../../utils/utils');
const path = require("path");

module.exports = {
    name: `automoddelete`,
    description: `Delete an AutoMod rule`,
    defaultMemberPermissions: ['Administrator'],
    cooldown: 0,
    type: ApplicationCommandType.ChatInput,
    /**
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction, client) {
        const { options, member, guild, channel, user } = interaction;

        await interaction.deferReply({ ephemeral: true }).catch(err => console.error(`${path.basename(__filename)} There was a problem deferring an interaction: `, err));

        const autmodRules = await guild.autoModerationRules.fetch();

        autmodRules.forEach(rule => {
            console.log(rule.name);
            if (rule.name === 'Test') {
                guild.autoModerationRules.delete(rule.id);
            }
        })

        sendResponse(interaction, `Done`);
    }
}