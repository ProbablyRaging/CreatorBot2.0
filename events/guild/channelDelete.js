import { AuditLogEvent } from 'discord.js';
const protection = new Map();

export default {
    name: 'channelDelete',
    async execute(channel, client, Discord) {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const staffChan = guild.channels.cache.get(process.env.STAFF_CHAN);

        // Fetch auditlogs for ChannelsDelete events
        const auditLog = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });

        const entry = auditLog.entries.first();
        if (entry.executor.bot || entry.executor.id === process.env.OWNER_ID) return;

        // If a staff member deletes too many roles too suddenly
        const found = protection.get(entry.executor.id);

        if (found) {
            if (found >= 2) {
                const member = await guild.members.fetch(entry.executor.id).catch(() => { });
                // Remove staff roles
                member.roles.remove([process.env.ADMIN_ROLE, process.env.MOD_ROLE, process.env.STAFF_ROLE])
                    .catch(err => console.error(`There was a problem removing roles`, err));;
                // Send a notification
                staffChan.send({
                    content: `<@&${process.env.STAFF_ROLE}>
**Mass Channel Deletion Protection**
${member} was removed from the staff role to prevent a potential mass event`
                }).catch(err => console.error(`There was a problem sending a message: `, err));
            } else {
                // Incrememnt counter
                protection.set(entry.executor.id, found + 1);
            }
        } else {
            protection.set(entry.executor.id, 2);
            setTimeout(() => {
                protection.delete(entry.executor.id);
            }, 60000);
        }
    }
}