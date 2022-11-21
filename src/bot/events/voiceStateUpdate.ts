import { Logger } from "@skeldjs/hindenburg";
import { Client, VoiceState } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import { EmbedGameState } from "../utils";

export default (client: Client, logger: Logger, db: DbConnection, bot: Bot): void => {
    client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {

        if (oldState.channel == newState.channel) return;

        if (oldState.channel != undefined) {
            const sql = `UPDATE players SET discord_user_id = NULL, discord_voice_id = NULL, is_host = FALSE WHERE discord_user_id = ${oldState.member?.id}`;
            const result = await db.query(sql);
            if (result.affectedRows == 1) {
                const sql = `SELECT discord_message_id, discord_text_id, roomcode FROM players WHERE roomcode = (SELECT roomcode FROM players WHERE discord_voice_id = '${oldState.channelId}')`;
                const result = await db.query(sql);
                if (result[0] == undefined) return;
                bot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, result[0].roomcode, EmbedGameState.LOBBY, false);
            }
        }

        if (newState.channel != undefined) {
            const sql = `SELECT discord_voice_id, discord_message_id, discord_text_id, roomcode FROM players WHERE is_host = TRUE AND discord_voice_id = '${newState.channelId}'`;
            const result = await db.query(sql);
            if (result[0] == undefined) return
            bot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, result[0].roomcode, EmbedGameState.LOBBY, true)
        }
        
        logger.debug(`OLD ${oldState.channel?.name} NEW ${newState.channel?.name}`)
    });
}; 