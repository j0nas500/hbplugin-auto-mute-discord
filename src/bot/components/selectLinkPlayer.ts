import { Logger } from "@skeldjs/hindenburg";
import { Channel, Client, GuildMember, Message, SelectMenuInteraction, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import embed, { EmbedGameState } from "../utils/embed";

export default async (client: Client, interaction: SelectMenuInteraction, logger: Logger, db: DbConnection, bot: Bot): Promise<void> => {
    await interaction.deferUpdate();

    if (!(interaction.member instanceof GuildMember)) return
    const user: GuildMember = interaction.member;

    if (!user.voice.channel) {
        await interaction.followUp({
            content: "You are not in a voice Channel", ephemeral: true
        }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });
        return
    }
    const voice: VoiceBasedChannel = user.voice.channel;

    if (interaction.values[0] == "unlink") {
        let sql = `SELECT discord_message_id, discord_text_id, roomcode FROM players WHERE is_host = TRUE and roomcode = (SELECT roomcode FROM players WHERE discord_user_id = '${user.id}')`;
        const host = await db.query(sql)
        sql = `UPDATE players SET discord_user_id = NULL, discord_voice_id = NULL, is_host = FALSE WHERE discord_user_id = '${user.id}'`
        const unlink = await db.query(sql);        
        
        if (unlink.affectedRows == 1) {
            await interaction.followUp({
                content: "You are unlinked now", ephemeral:true
            }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });

            await bot.updateEmbed(host[0].discord_text_id, host[0].discord_message_id, host[0].roomcode, EmbedGameState.LOBBY, false)
            return;
        }
        await interaction.followUp({
            content: "You are not linked", ephemeral: true
        }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });
        return;
       
    }

    const client_id = Number(interaction.values[0]);

    let sql = `SELECT discord_voice_id, discord_user_id, roomcode, discord_message_id, discord_text_id FROM players WHERE is_host = TRUE and roomcode = (SELECT roomcode FROM players WHERE client_id = ${client_id})`;
    const host = await db.query(sql);
    if (host[0] == undefined) {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = (SELECT roomcode FROM players WHERE client_id = ${client_id})`
        await db.query(sql)
        interaction.editReply({components: []}).catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e)).then(() => {
            setTimeout(() => {
                interaction.deleteReply().catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e));
             }, 5000);
        });
        return;
    }
    
    const code: string = host[0].roomcode;
    const tmp_host_channel: Channel | undefined = client.channels.cache.get(host[0].discord_voice_id);
    const tmp_host_user: User | undefined = client.users.cache.get(host[0].discord_user_id);
    if (tmp_host_channel == undefined || !(tmp_host_channel.isVoiceBased())) {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        logger.error("embed.ts: Host Channel not found");
        await interaction.editReply({components: []}).catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e)).then(() => {
            setTimeout(() => {
                interaction.deleteReply().catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e));
             }, 5000);
        });
        return
    }
    if (tmp_host_user == undefined) {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        logger.error("embed.ts: Host Member not found");
        await interaction.editReply({components: []}).catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e)).then(() => {
            setTimeout(() => {
                interaction.deleteReply().catch(e => logger.error("selectLinkPlayer.ts: interaction not found", e));
             }, 5000);
        });
        return
    }
    const host_channel: VoiceBasedChannel = tmp_host_channel;    
    const host_member: User = tmp_host_user;
    

    if (voice.id !== host_channel.id) {
        await interaction.followUp({
            content: `You must be in in this voice Channel ${host_channel}`, ephemeral:true
        }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });
        return;
    }

    sql = `SELECT is_host FROM players WHERE discord_user_id = ${user.id}`
    const is_host = await db.query(sql)
    if (is_host[0] !== undefined && is_host[0].is_host == 1) {
        sql = `INSERT INTO linked_players VALUES('${user.id}', (SELECT username FROM players WHERE client_id = ${client_id})) ON DUPLICATE KEY UPDATE username = (SELECT username FROM players WHERE client_id = ${client_id})`;
        await db.query(sql);
        sql = `UPDATE players SET discord_user_id = NULL, discord_voice_id = NULL, is_host = FALSE WHERE discord_user_id = ${user.id}`
        await db.query(sql)
        sql = `UPDATE players SET discord_user_id = ${user.id}, discord_voice_id = ${voice.id}, is_host = TRUE WHERE client_id = ${client_id}`
        await db.query(sql)
    } else {
        sql = `INSERT INTO linked_players VALUES('${user.id}', (SELECT username FROM players WHERE client_id = ${client_id})) ON DUPLICATE KEY UPDATE username = (SELECT username FROM players WHERE client_id = ${client_id})`;
        await db.query(sql);
        sql = `UPDATE players SET discord_user_id = NULL, discord_voice_id = NULL WHERE discord_user_id = ${user.id}`
        await db.query(sql)
        sql = `UPDATE players SET discord_user_id = ${user.id}, discord_voice_id = ${voice.id} WHERE client_id = ${client_id}`
        await db.query(sql)
    }

    await bot.updateEmbed(host[0].discord_text_id, host[0].discord_message_id, code, EmbedGameState.LOBBY, false);

    await interaction.followUp({
        content: "You are linked now", ephemeral:true
    }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });
}
