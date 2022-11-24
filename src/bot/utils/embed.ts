import { Color, GameState, Logger } from "@skeldjs/hindenburg";
import { ActionRowBuilder, APIEmbedField, Channel, Client, EmbedBuilder, GuildMember, Message, SelectMenuBuilder, SelectMenuOptionBuilder, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import emoji, { Emoji } from "./emoji";

export enum EmbedGameState {
    LOBBY,
    TASKS,
    DISCUSSION
}

export default async (client: Client, logger: Logger, db: DbConnection, msg: Message<boolean>, code: string, gameState: EmbedGameState, autoLink: boolean) => {
    
    let sql = `SELECT username, discord_user_id, discord_voice_id FROM players WHERE roomcode = '${code}' AND is_host = TRUE`;
    const host = await db.query(sql);

    if (host[0] == undefined) {
        logger.debug("embed.ts: Host undefined");
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        await msg.edit({components: []}).catch(e => logger.error("embed.ts: Embed not found", e)).then(() => {
            setTimeout(() => {
                if (msg.deletable) msg.delete().catch(e => logger.error("embed.ts: Embed not found", e));
             }, 5000);
        });
        return;
    }

    const tmp_host_channel: Channel | undefined = client.channels.cache.get(host[0].discord_voice_id);
    const tmp_host_user: User | undefined = client.users.cache.get(host[0].discord_user_id);
    if (tmp_host_channel == undefined || !(tmp_host_channel.isVoiceBased())) {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        logger.error("embed.ts: Host Channel not found");
        await msg.edit({components: []}).catch(e => logger.error("embed.ts: Embed not found", e)).then(() => {
            setTimeout(() => {
                if (msg.deletable) msg.delete().catch(e => logger.error("embed.ts: Embed not found", e));
             }, 5000);
        });
        return
    }
    if (tmp_host_user == undefined) {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        logger.error("embed.ts: Host Member not found");
        await msg.edit({components: []}).catch(e => logger.error("embed.ts: Embed not found", e)).then(() => {
            setTimeout(() => {
                if (msg.deletable) msg.delete().catch(e => logger.error("embed.ts: Embed not found", e));
             }, 5000);
        });
        return
    }
    const host_channel: VoiceBasedChannel = tmp_host_channel;    
    const host_member: User = tmp_host_user;

    if (autoLink) {
        host_channel.members.forEach(async member => {
            sql = `UPDATE players SET discord_text_id = '${msg.channelId}', discord_message_id = '${msg.id}', discord_voice_id = '${host_channel.id}', discord_user_id = (SELECT discord_user_id FROM linked_players WHERE discord_user_id = '${member.id}') WHERE roomcode = '${code}' AND username = (SELECT username FROM linked_players WHERE discord_user_id = '${member.id}' AND discord_user_id IS NOT NULL)`
            await db.query(sql)
        })
    }

    sql = `SELECT username, discord_user_id, color_id, is_ghost FROM players WHERE roomcode = '${code}'`;
    const all_players = await db.query(sql);
    sql = `SELECT username, discord_user_id, color_id, is_ghost FROM players WHERE roomcode = '${code}' AND discord_user_id IS NOT NULL`
    const connected_players = await db.query(sql);

    if (all_players[0] == undefined) {
        logger.error(`embed.ts: No Lobby with room code ${code} found!`);
        await msg.edit({components: []}).catch(e => logger.error("embed.ts: Embed not found", e)).then(() => {
            setTimeout(() => {
                if (msg.deletable) msg.delete().catch(e => logger.error("embed.ts: Embed not found", e));
             }, 5000);
        });
        return
    }

    const embed: EmbedBuilder = await createEmbed(all_players, connected_players, code, host_channel, host_member, gameState)
    sql = `SELECT client_id, username, color_id FROM players WHERE roomcode = '${code}' and discord_user_id IS NULL`
    const notLinkedPlayers = await db.query(sql)
    const component: ActionRowBuilder<SelectMenuBuilder> = createSelectMenu(notLinkedPlayers)

    await msg.edit({ content: "", embeds: [embed], components: [component] }).catch(async e => {
        sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE roomcode = '${code}'`
        await db.query(sql)
        logger.error("embed.ts: Embed not edited", e)
    });
}

async function createEmbed(all_players: any, connected_players: any, code: string, host_channel: VoiceBasedChannel, host_member: User, gameState: EmbedGameState): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();
    switch(gameState) {
        case EmbedGameState.LOBBY:
            embed.setTitle("LOBBY");
            embed.setColor("Green");
            break;
        case EmbedGameState.TASKS:
            embed.setTitle("TASKS");
            embed.setColor("Blue");
            break;
        case EmbedGameState.DISCUSSION:
            embed.setTitle("DISCUSSION")
            embed.setColor("DarkVividPink")
            break;
    }

    embed.addFields(
        { name: "Host", value: `${host_member}`, inline: true },
        { name: "Channel", value: `${host_channel}`, inline: true },
        { name: "Players Linked", value: `${connected_players.length}/${all_players.length}`, inline: true},
        { name: "🔒 Code", value: `${code}`, inline: false}
    )

    const playersFields: APIEmbedField | APIEmbedField[] = [];
    await all_players.forEach(async (player: any) => {
        if (player.discord_user_id == undefined && player.color_id !== undefined) {
            if (player.is_ghost == 1) {
                playersFields.push(
                    { 
                        name: `${emoji(player.color_id, Emoji.DEAD)} ${player.username}`,
                        value: "unlinked",
                        inline: true
                    });
                return;
            }
            playersFields.push(
                { 
                    name: `${emoji(player.color_id, Emoji.ALIVE)} ${player.username}`,
                    value: "unlinked",
                    inline: true
                });            
            return;
        }

        if (player.discord_user_id == undefined) {
            playersFields.push(
                {
                    name: `${player.username}`,
                    value: "unlinked",
                    inline: true
                });
            return;
        }

        let user: GuildMember = await host_channel.guild.members.fetch(player.discord_user_id)
        if (player.is_ghost == 1) {
            playersFields.push(
                {
                    name: `${emoji(player.color_id, Emoji.DEAD)} ${player.username}`,
                    value: `${user}`,
                    inline: true
                });
            return;
        }
        playersFields.push(
            {
                name: `${emoji(player.color_id, Emoji.ALIVE)} ${player.username}`,
                value: `${user}`,
                inline: true
            });
    })

    return embed.addFields(playersFields);
}

function createSelectMenu(notLinkedPlayers: any) {

    const component = new ActionRowBuilder<SelectMenuBuilder>
    const selectMenu = new SelectMenuBuilder();
    selectMenu.setCustomId("select-link-player")

    notLinkedPlayers.forEach((player: any) => {
        let selectMenuOption = new SelectMenuOptionBuilder();
        selectMenuOption.setLabel(player.username);
        selectMenuOption.setValue(String(player.client_id));
        selectMenuOption.setEmoji(emoji(player.color_id, Emoji.ALIVE))
        selectMenu.addOptions(selectMenuOption);
    });

    let selectMenuOption = new SelectMenuOptionBuilder();
    selectMenuOption.setLabel("unlink");
    selectMenuOption.setValue("unlink");
    selectMenuOption.setEmoji("❌");
    selectMenu.addOptions(selectMenuOption);

    component.addComponents(selectMenu);
    return component;
}

