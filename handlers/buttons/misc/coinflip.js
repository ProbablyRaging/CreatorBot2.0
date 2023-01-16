const { ButtonInteraction, AttachmentBuilder } = require('discord.js');
const { dbFindOne, dbUpdateOne, dbDeleteOne } = require('../../../utils/utils');
const coinflipSchema = require('../../../schemas/misc/coinflip_schema');
const tokensSchema = require('../../../schemas/misc/tokens_schema');
const Canvas = require("canvas");
const gifEncoder = require('gifencoder');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

async function initCoinflip(client, guild, channel, gameCode) {
    const results = await dbFindOne(coinflipSchema, { code: gameCode });
    const playerOne = results.playerOne;
    const playerTwo = results.playerTwo;
    const wagerAmount = results.amount

    await channel.send({ content: `<:botconfirm:845719660812435496> <@${playerTwo}> has accepted <@${playerOne}>'s wager of **${wagerAmount}** tokens. Good luck!` }).catch(err => console.error(err));
    // Get a random number, 1 = playerOne, 2 = playerTwo
    const pickWinner = randomNum(1, 2);
    if (pickWinner === 1) {
        // Get the winners current tokens count and add the wagered tokens
        const checkWinnersTokens = await dbFindOne(tokensSchema, { userId: playerOne });
        await dbUpdateOne(tokensSchema, { userId: playerOne }, { tokens: checkWinnersTokens.tokens + wagerAmount });
        // Notify players of the result
        // await channel.send({ content: `<:dollar_coin:1034396609276022854> <@${playerOne}> won the wager of **${wagerAmount}** tokens against <@${playerTwo}>!` }).catch(err => console.error(err));
        await createCanvas(client, guild, channel, playerOne, playerTwo, playerOne, wagerAmount, gameCode);
    } else {
        // Get the winners current tokens count and add the wagered tokens
        const checkWinnersTokens = await dbFindOne(tokensSchema, { userId: playerTwo });
        await dbUpdateOne(tokensSchema, { userId: playerTwo }, { tokens: checkWinnersTokens.tokens + wagerAmount });
        // Notify players of the result
        // await channel.send({ content: `<:dollar_coin:1034396609276022854> <@${playerTwo}> won the wager of **${wagerAmount}** tokens against <@${playerOne}>!` }).catch(err => console.error(err));
        await createCanvas(client, guild, channel, playerOne, playerTwo, playerTwo, wagerAmount, gameCode);
    }
    // Remove the game entry from the database
    await dbDeleteOne(coinflipSchema, { code: gameCode });
}

async function createCanvas(client, guild, channel, playerOne, playerTwo, winnerId, wagerAmount, gameCode) {
    // Fetch the winner of the coinflip
    const fetchWinner = await guild.members.fetch(winnerId).catch(err => console.error(err));
    const fileName = uuidv4();
    // Image
    const background = await Canvas.loadImage("./res/images/coinflip_winner.png");
    const canvas = Canvas.createCanvas(330, 200);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    // Position
    ctx.font = "900 20px redhatdisplay";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    // Create a GIF
    const encoder = new gifEncoder(330, 200);
    encoder.createReadStream().pipe(fs.createWriteStream(`./res/temp/${fileName}.gif`));
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(40);
    encoder.setQuality(10);
    // Add the text sliding in to the gif
    for (let y = canvas.height + 400; y > 174; y -= 10) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        ctx.fillText(fetchWinner.user.tag, 170, y);
        if (y === 180) {
            for (let i = 0; i < 100; i++) {
                encoder.addFrame(ctx);
            }
        } else {
            encoder.addFrame(ctx);
        }
    }
    encoder.finish();
    const attachment = new AttachmentBuilder(`./res/temp/${fileName}.gif`, { name: `${fileName}.gif` });
    // Send the gif as a webhook
    await channel.createWebhook({ name: client.user.username, avatar: client.user.avatarURL({ format: 'png', size: 256 }) })
        .then(webhook => {
            webhook.send({
                content: `**Game:** <@${playerOne}> vs. <@${playerTwo}> \n**Winnings:** ${wagerAmount * 2} tokens \n**Code:** ${gameCode} \n\n*Create your own wager with </coinflip create:1064426324690751528>*`,
                files: [attachment]
            }).catch(err => console.error(`${path.basename(__filename)} There was a problem sending a webhook message: `, err))
                .then(() => {
                    webhook.delete().catch(err => console.error(`${path.basename(__filename)} There was a problem deleting a webhook: `, err));
                    // Delete the GIF file
                    if (fs.existsSync(`./res/temp/${fileName}.gif`)) fs.unlink(`./res/temp/${fileName}.gif`, (err) => { if (err) console.error(err); });
                });
        }).catch(err => console.error(`${path.basename(__filename)} There was a problem sending a webhook: `, err));
}

function randomNum(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * @param {ButtonInteraction} interaction 
 */
module.exports = async (interaction) => {
    const { client, guild, channel, member, customId } = interaction;

    await interaction.deferUpdate().catch(err => console.error(`${path.basename(__filename)} There was a problem deferring an interaction: `, err));

    const gameCode = customId.split('-')[1];

    interaction?.fetchReply('@original').then(async reply => {
        if (reply.content.toLowerCase().includes('head-to-head')) {
            // Get the game data from the database
            const coinflipGame = await dbFindOne(coinflipSchema, { code: gameCode });
            // Don't let a user join their own game
            if (member.id === coinflipGame.playerOne) return;
            // Check if the owner of the coinflip is still in the server, if not, delete their game
            const checkIfUserExists = await guild.members.fetch(coinflipGame.playerOne).catch(err => console.error(err));
            if (!checkIfUserExists) {
                reply.edit({ content: `${reply.content.split('.')[0]}. The wager is no longer valid`, components: [] }).catch(err => console.error(err));
                return dbDeleteOne(coinflipSchema, { code: gameCode });
            }
            // If the coinflip is already in progress
            if (coinflipGame?.inProgress === true) return;
            // Check if the user has enough tokens to wager
            const checkUserTokens = await dbFindOne(tokensSchema, { userId: member.id });
            // If the user doesn't have a tokens database entry
            if (!checkUserTokens)
                return channel.send({ content: `${process.env.BOT_DENY} ${member} You don't have enough tokens to join this wager, start earning tokens by chatting in the server` })
                    .catch(err => console.error(err))
                    .then(message => {
                        setTimeout(() => {
                            message.delete().catch(err => console.error(err));
                        }, 7000);
                    });
            // If the user doesn't have enough tokens to join the wager
            if (checkUserTokens.tokens < coinflipGame.amount)
                return channel.send({ content: `${process.env.BOT_DENY} ${member} You don't have enough tokens to join this wager, your current tokens balance is ${checkUserTokens.tokens}` })
                    .catch(err => console.error(err))
                    .then(message => {
                        setTimeout(() => {
                            message.delete().catch(err => console.error(err));
                        }, 7000);
                    });
            // Decuct the wagered tokens now so the user can't spend them before the game is finished
            await dbUpdateOne(tokensSchema, { userId: member.id }, { tokens: checkUserTokens.tokens - coinflipGame.amount });
            // If the game was found, set playerTwo as the challenger and start the game
            await dbUpdateOne(coinflipSchema, { code: gameCode }, { playerTwo: member.id, inProgress: true });
            // Mark this wager as accepted
            await reply.edit({ content: `${reply.content.split('.')[0]}. The wager was accepted by ${member}`, components: [] }).catch(err => console.error(err));
            // Initiate coinflip
            initCoinflip(client, guild, channel, gameCode);
            // interaction.deleteReply().catch(err => console.error(err));
        }
    }).catch(err => console.error('There was a problem fetching an interaction in coinflip: ', err));
}