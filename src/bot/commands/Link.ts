import { Logger } from "@skeldjs/hindenburg";
import { ActionRowBuilder, APIInteractionGuildMember, ApplicationCommandOptionType, ApplicationCommandType, Client, CommandInteraction, EmbedBuilder, GuildMember, Message, SelectMenuBuilder, SelectMenuOptionBuilder, TextChannel, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import { Command } from "../Command";
import embed, { EmbedGameState } from "../utils/embed";
import emoji, { Emoji } from "../utils/emoji";

export const Link: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "link",
    description: "link discord user to in-game user",
    defaultMemberPermissions: ["Connect"],
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "discord user to link",
            required: true,
        }
    ],
    run: async (client: Client, interaction: CommandInteraction, logger: Logger, db: DbConnection) => {
        await interaction.deferReply({ ephemeral: true })        
        
        const member: GuildMember | APIInteractionGuildMember | null = interaction.member;
        if (!(member instanceof GuildMember)) {
            await interaction.editReply({
                content: "ERROR"                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }
        
        
        if (!member.voice.channelId) {
            await interaction.editReply({
                content: "You are not in a voice Channel"                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }

        const hostChannel: VoiceBasedChannel = member.voice.channel as VoiceBasedChannel

        const linkUser: User = interaction.options.get("user", true).user as User
        const linkMember: GuildMember = await interaction.guild?.members.fetch(linkUser) as GuildMember;


        if (!linkMember.voice.channelId) {
            await interaction.editReply({
                content: `${linkMember} is not in a voice Channel`                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }

        if (linkMember.voice.channelId != member.voice.channelId) {
            await interaction.editReply({
                content: `${linkMember} is not in the same Voice Channel like you`                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }


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

        sql = `SELECT username FROM players WHERE discord_user_id = '${linkMember.id}'`
        const allreadyLinked = await db.query(sql)
        if (allreadyLinked[0] !== undefined) {
            await interaction.editReply({
                content: `${linkMember} allready linked to ${allreadyLinked[0].username}`                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }



        sql = `SELECT username, color_id, client_id FROM players WHERE roomcode = '${code}' and discord_user_id IS NULL`
        const players = await db.query(sql)

        if (players[0] === undefined) {
            await interaction.editReply({
                content: `No in-game Player to link!`                
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }

        if (players.length > 1) {
            const row = new ActionRowBuilder<SelectMenuBuilder>();
            const selectMenu = new SelectMenuBuilder();
            selectMenu.setCustomId("select-remote-link-player")

            players.forEach((player: any) => {
                let selectMenuOption = new SelectMenuOptionBuilder();
                selectMenuOption.setLabel(player.username);
                selectMenuOption.setValue(String(player.client_id));
                selectMenuOption.setEmoji(emoji(player.color_id, Emoji.ALIVE))
                selectMenu.addOptions(selectMenuOption);
            });
            
            row.addComponents(selectMenu);
            

            const embed = new EmbedBuilder().setDescription(`${linkMember}`).setFooter({iconURL: `${linkMember.displayAvatarURL()}`, text: `${linkMember.id}`});
           
            await interaction.editReply({
                content: "Select in-game Username for:", embeds: [embed], components: [row]
            }).catch(e => { logger.error("Can't editReply() in Link.ts", e) });
            return;
        }

        sql = `UPDATE players SET discord_message_id = ${message_id}, discord_text_id = ${text_id}, discord_voice_id = ${hostChannel.id}, discord_user_id = ${linkMember.id} WHERE roomcode = '${code}' and client_id = ${players[0].client_id}`;
        db.query(sql);

        await interaction.editReply({
            content: "Setup complete"
        });

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
    }
};