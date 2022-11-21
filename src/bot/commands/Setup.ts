import { Logger } from "@skeldjs/hindenburg";
import { ActionRowBuilder, APIInteractionGuildMember, ApplicationCommandOptionType, ApplicationCommandType, Client, CommandInteraction, GuildMember, Message, SelectMenuBuilder, SelectMenuOptionBuilder, TextChannel, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Command } from "../Command";
import embed, { EmbedGameState } from "../utils/embed";
import emoji, { Emoji } from "../utils/emoji";

export const Setup: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "setup",
    description: "Setup for Auto Mute",
    defaultMemberPermissions: ["Connect"],
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "roomcode",
            description: "Roomcode of your Among Us Lobby",
            required: true,
            minLength: 4,
            maxLength: 6,
        }
    ],
    run: async (client: Client, interaction: CommandInteraction, logger: Logger, db: DbConnection) => {
        await interaction.deferReply({ ephemeral: true })        
        
        const member: GuildMember | APIInteractionGuildMember | null = interaction.member;
        if (!(member instanceof GuildMember)) {
            await interaction.editReply({
                content: "ERROR"                
            }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
            return;
        }
        
        
        if (!member.voice.channelId) {
            await interaction.editReply({
                content: "You are not in a voice Channel"                
            }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
            return;
        }

        const channel: VoiceBasedChannel = member.voice.channel as VoiceBasedChannel

        let code: string = interaction.options.get("roomcode")?.value as string
        code = code.toUpperCase()
        if (code.includes(";") || code.includes("'") || code.includes("`") || code.includes("DROP")) {
            await interaction.editReply({
                content: "Don't try it"                
            }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
            return;
        }

        let sql = `SELECT username, color_id, client_id FROM players WHERE roomcode = '${code}'`
        const players = await db.query(sql)
        if (players[0] === undefined) {
            await interaction.editReply({
                content: `No Lobby with room code ${code} found!`                
            }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
            return;
        }

        sql = `SELECT discord_user_id, discord_text_id, discord_message_id FROM players WHERE roomcode = '${code}' and is_host = TRUE`;
        const host = await db.query(sql);
        if (host[0] !== undefined) {
            if (member.id !== host[0].discord_user_id) {
                await interaction.editReply({
                    content: "You are not the Host of the Lobby"                
                }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
                return;
            }

            const channelId = host[0].discord_text_id;
            const messageId = host[0].discord_message_id;
            const channel: TextChannel = await client.channels.fetch(channelId).catch(e => { logger.error("Setup.ts TextChannel not found", e) }) as TextChannel;
            await channel.messages.edit(messageId, {components: undefined}).catch(e => { logger.error("Setup.ts Message Edit failed", e) }).then(() => { setTimeout(() => undefined, 5000)});
            await channel.messages.delete(messageId);
        }

        if (players.length > 1) {
            const row = new ActionRowBuilder<SelectMenuBuilder>();
            const selectMenu = new SelectMenuBuilder();
            selectMenu.setCustomId("select-host-player")

            players.forEach((player: any) => {
                let selectMenuOption = new SelectMenuOptionBuilder();
                selectMenuOption.setLabel(player.username);
                selectMenuOption.setValue(String(player.client_id));
                selectMenuOption.setEmoji(emoji(player.color_id, Emoji.ALIVE))
                selectMenu.addOptions(selectMenuOption);
            });
            
            row.addComponents(selectMenu);

           
            await interaction.editReply({
                content: "Select your in-game Username", components: [row]
            }).catch(e => { logger.error("Can't editReply() in Setup.ts", e) });
            return;
        }

        await interaction.editReply({
            content: "Setup complete"
        });

        const tmp: Message<boolean> | void = await interaction.followUp({
            content: players[0].username, ephemeral: false
        }).catch(e => { logger.error("Can't followUp() in interactionCreate.ts", e) });
    
        if (!(tmp instanceof Message<boolean>)) {
            await interaction.editReply({
                content: "ERROR", components: []
            }).catch(e => { logger.error("Can't followUp() in interactionCreate.ts", e) });
            return
        }
        
        const msg: Message<boolean> = tmp;
    
        sql = `INSERT INTO linked_players VALUES('${member.id}', '${players[0].username}') ON DUPLICATE KEY UPDATE username = '${players[0].username}'`;
        await db.query(sql);
        sql = `UPDATE players SET discord_message_id = '${msg.id}', discord_text_id = '${msg.channelId}', discord_voice_id = '${channel.id}', discord_user_id = '${member.id}', is_host = TRUE WHERE client_id = ${players[0].client_id}`;
        await db.query(sql);

        await embed(client, logger, db, msg, code, EmbedGameState.LOBBY, true);
    }
};