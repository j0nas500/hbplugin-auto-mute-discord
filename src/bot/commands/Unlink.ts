import { Logger } from "@skeldjs/hindenburg";
import { ActionRowBuilder, APIInteractionGuildMember, ApplicationCommandOptionType, ApplicationCommandType, Client, CommandInteraction, EmbedBuilder, GuildMember, Message, SelectMenuBuilder, SelectMenuOptionBuilder, TextChannel, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import { Command } from "../Command";
import embed, { EmbedGameState } from "../utils/embed";
import emoji, { Emoji } from "../utils/emoji";

export const Unlink: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "unlink",
    description: "unlink discord user to in-game user",
    defaultMemberPermissions: ["Connect"],
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "discord user to unlink",
            required: true,
        }
    ],
    run: async (client: Client, interaction: CommandInteraction, logger: Logger, db: DbConnection) => {
        await interaction.deferReply({ ephemeral: true })        
        
        const member: GuildMember | APIInteractionGuildMember | null = interaction.member;
        if (!(member instanceof GuildMember)) {
            await interaction.editReply({
                content: "ERROR"                
            }).catch(e => { logger.error("Can't editReply() in Unlink.ts", e) });
            return;
        }
        
        
        if (!member.voice.channelId) {
            await interaction.editReply({
                content: "You are not in a voice Channel"                
            }).catch(e => { logger.error("Can't editReply() in Unlink.ts", e) });
            return;
        }

        const unlinkUser: User = interaction.options.get("user", true).user as User

        let sql = `SELECT roomcode, discord_message_id, discord_text_id FROM players WHERE discord_user_id = '${member.id}' and is_host = TRUE`
        const host = await db.query(sql)
        if (host[0] === undefined) {
            await interaction.editReply({
                content: `You are not the Host of the Lobby!`                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }

        const code: string = host[0].roomcode;
        const message_id = host[0].discord_message_id;
        const text_id = host[0].discord_text_id;

        sql = `UPDATE players SET discord_user_id = NULL, discord_voice_id = NULL, is_host = FALSE WHERE discord_user_id = '${unlinkUser.id}'`
        const unlink = await db.query(sql);
        sql = `DELETE FROM linked_players WHERE discord_user_id = '${unlinkUser.id}'`        
        await db.query(sql)
        
        if (unlink.affectedRows == 1) {
            await interaction.editReply({
                content: `${unlinkUser} unlinked now`,
            }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });

            const channel = await client.channels.fetch(text_id)
            if (channel == undefined || !channel.isTextBased()) {
                logger.error("updateEmbed() in Bot.ts: Channel not found");
                const sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE discord_message_id = ${message_id}`;
                await db.query(sql);
                return
            }
            const message: Message<boolean> | void = await channel.messages.fetch(message_id).catch((e) => logger.error("updateEmbed() Message not found"));
            if (message == undefined) {
                logger.error("updateEmbed() Message undefined")
                return
            }
            await embed(client, logger, db, message, code, EmbedGameState.LOBBY, false);
            return;
        }
        await interaction.editReply({
            content: `${unlinkUser} is not linked`
        }).catch(e => { logger.error("Can't followUp()) in selectLinkPlayer.ts", e) });
        return;
    }
};