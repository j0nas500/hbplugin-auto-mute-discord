import { Logger } from "@skeldjs/hindenburg";
import { Client, GuildMember, Message, SelectMenuInteraction, VoiceBasedChannel } from "discord.js";
import { boolean } from "yargs";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import embed, { EmbedGameState } from "../utils/embed";

export default async (client: Client, interaction: SelectMenuInteraction, logger: Logger, db: DbConnection, bot: Bot): Promise<void> => {
    await interaction.deferUpdate();

    const client_id: number = Number(interaction.values[0]);

    if (!(interaction.member instanceof GuildMember)) return
    const hostMember: GuildMember = interaction.member;

    if (!hostMember.voice.channel) {
        await interaction.editReply({
            content: "You are not in a voice Channel"
        }).catch(e => { logger.error("Can't followUp() in interactionCreate.ts", e) });
        return
    }
    const hostVoice: VoiceBasedChannel = hostMember.voice.channel;

    await interaction.editReply({ 
        content: `Selected ${client_id} as Host`, 
        components: [] }).catch(e => { logger.error("Can't update() in interactionCreate.ts", e)
    });

    const tmp: Message<boolean> | void = await interaction.followUp({
        content: `${client_id}`
    }).catch(e => { logger.error("Can't followUp() in interactionCreate.ts", e) });

    if (!(tmp instanceof Message<boolean>)) {
        await interaction.editReply({
            content: "ERROR", components: []
        }).catch(e => { logger.error("Can't followUp() in interactionCreate.ts", e) });
        return
    } 
    const msg: Message<boolean> = tmp;

    let sql = `SELECT username, roomcode FROM players WHERE client_id = ${client_id}`;
    const host = await db.query(sql);
    const username = host[0].username
    const roomcode = host[0].roomcode

    sql = `INSERT INTO linked_players VALUES('${hostMember.id}', '${username}') ON DUPLICATE KEY UPDATE username = '${username}'`;
    await db.query(sql);
    sql = `UPDATE players SET discord_message_id = '${msg.id}', discord_text_id = '${msg.channelId}', discord_voice_id = '${hostVoice.id}', is_host = FALSE WHERE roomcode = '${roomcode}'`;
    await db.query(sql);
    sql = `UPDATE players SET discord_user_id = '${hostMember.id}', is_host = TRUE WHERE client_id = ${client_id}`;
    await db.query(sql);

    await bot.updateEmbed(msg.channelId, msg.id, roomcode, EmbedGameState.LOBBY, true);
}
