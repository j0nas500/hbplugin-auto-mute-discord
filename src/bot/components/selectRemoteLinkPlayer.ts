import { Logger } from "@skeldjs/hindenburg";
import { Channel, Client, Embed, GuildMember, Message, SelectMenuInteraction, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import embed, { EmbedGameState } from "../utils/embed";

export default async (client: Client, interaction: SelectMenuInteraction, logger: Logger, db: DbConnection, bot: Bot): Promise<void> => {
    await interaction.deferUpdate();

    const message: Message<boolean> = await interaction.fetchReply()
    const embeds: Embed[] = message.embeds;
    const title: string = embeds[0].footer?.text as string
    const member: GuildMember = interaction.member as GuildMember
    const client_id: number = Number(interaction.values[0])

    const sql_host = `SELECT discord_message_id, discord_text_id, roomcode FROM players WHERE is_host = TRUE and roomcode = (SELECT roomcode FROM players WHERE discord_user_id = '${member.id}')`;
    const host = await db.query(sql_host)

    const sql_linked = `INSERT INTO linked_players VALUES('${title}', (SELECT username FROM players WHERE client_id = ${client_id})) ON DUPLICATE KEY UPDATE username = (SELECT username FROM players WHERE client_id = ${client_id})`;
    await db.query(sql_linked);
    const sql = `UPDATE players SET discord_message_id = '${host[0].discord_message_id}', discord_text_id = '${host[0].discord_text_id}', discord_user_id = '${title}', discord_voice_id = ${member.voice.channelId} WHERE client_id = ${client_id}`
    await db.query(sql)

    await bot.updateEmbed(host[0].discord_text_id, host[0].discord_message_id, host[0].rommcode, EmbedGameState.LOBBY, false);

    await interaction.deleteReply();

    await interaction.followUp({
        content: `${title} connected`, ephemeral: true
    }).catch(e => { logger.error("Can't followUp()) in selectRemoteLinkPlayer.ts", e) });
}
