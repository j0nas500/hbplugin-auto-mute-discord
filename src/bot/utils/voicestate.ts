import { Logger } from "@skeldjs/hindenburg";
import { GuildMember, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
export enum GameVoiceStateEnum {
    GAME_START,
    GAME_END,
    MEETING_START,
    MEETING_END,
    MUTE_ONLY,
}

export enum VoiceStateEnum {
    MUTE_DEAFEN,
    UNMUTE_UNDEAF,
    MUTE_UNDEAF,
    MUTE_ONLY,
}



export default async (mainBot: Bot, secondBot: Bot, db: DbConnection, code: string, gameVoiceState: GameVoiceStateEnum, logger: Logger, deadplayerId?: number): Promise<void> => {


    //if (gameVoiceState == GameVoiceStateEnum.MUTE_ONLY && !queue.idle()) return;  
    /*for (const promise of promiseQueue) {
        promise.cancel();
    }*/


    switch (gameVoiceState) {
        case GameVoiceStateEnum.GAME_START:
            const sql_gameStart = `SELECT discord_user_id, discord_voice_id FROM players WHERE discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const gameStart = await db.query(sql_gameStart);
            if (gameStart[0] == undefined) return

            const a = await splitMembers(gameStart, mainBot, secondBot, logger, VoiceStateEnum.MUTE_DEAFEN)

            break;
        case GameVoiceStateEnum.GAME_END:
            const sql_gameEnd = `SELECT discord_user_id, discord_voice_id FROM players WHERE discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const gameEnd = await db.query(sql_gameEnd);
            if (gameEnd[0] == undefined) return;

            const b = await splitMembers(gameEnd, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF)

            break
        case GameVoiceStateEnum.MEETING_START:
            const sql_meetingStartAlive = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = FALSE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const meetingStartAlive = await db.query(sql_meetingStartAlive);
            const sql_meetingStartDead = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = TRUE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const meetingStartDead = await db.query(sql_meetingStartDead);

            let calls
            if (meetingStartDead[0] !== undefined) {
                calls = await splitMembers(meetingStartDead, mainBot, secondBot, logger, VoiceStateEnum.MUTE_UNDEAF)
            }
            if (meetingStartAlive[0] !== undefined) {
                const c = await splitMembers(meetingStartAlive, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF, calls)
            }

            break;
        case GameVoiceStateEnum.MEETING_END:
            const sql_meetingEndAlive = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = FALSE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const meetingEndAlive = await db.query(sql_meetingEndAlive);
            const sql_meetingEndDead = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = TRUE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const meetingEndDead = await db.query(sql_meetingEndDead);

            let calls_2
            if (meetingEndAlive[0] !== undefined) {
                calls_2 = await splitMembers(meetingEndAlive, mainBot, secondBot, logger, VoiceStateEnum.MUTE_DEAFEN)
            }

            if (meetingEndDead[0] !== undefined) {
                const d = await splitMembers(meetingEndDead, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF, calls_2)
            }

            break;
        case GameVoiceStateEnum.MUTE_ONLY:
            const sql_muteOnly = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = TRUE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}' and client_id = ${deadplayerId}`;
            const muteOnly = await db.query(sql_muteOnly);
            if (muteOnly[0] == undefined) return;

            const e = await splitMembers(muteOnly, mainBot, secondBot, logger, VoiceStateEnum.MUTE_ONLY)

            break;
    }
}

async function splitMembers(result: any, mainBot: Bot, secondBot: Bot, logger: Logger, voicestate: VoiceStateEnum, calls: number = 0) {
    const channelMain: VoiceBasedChannel = await mainBot.client.channels.fetch(result[0].discord_voice_id) as VoiceBasedChannel;
    const channelSecond: VoiceBasedChannel = await secondBot.client.channels.fetch(result[0].discord_voice_id) as VoiceBasedChannel;

    if (channelMain == undefined || channelSecond == undefined) return 0;

    channelMain.members.forEach(async member => {
        //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] MAIN mute_deafen()", e));
        const a = await handleQueue(channelMain, member.id, logger, voicestate);
        calls += 1;
    })

    /*const membersMain: Collection<string, GuildMember> = channelMain.members
    const membersSecond: Collection<string, GuildMember> = channelSecond.members

    for (let i = 0; i < membersMain.size; i++) {
        if (calls % 2 == 0) {
            const member: GuildMember = await channelSecond.guild.members.fetch(result[i].discord_user_id);
            //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] SECOND mute_deafen()", e));
            await handleQueue(channelSecond, membersSecond.at(i)?.id as string, logger, voicestate);
            calls += 1;
            continue
        }

        //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] MAIN mute_deafen()", e));
        await handleQueue(channelMain, membersMain.at(i)?.id as string, logger, voicestate);
        calls += 1;
        continue
    }*/
    /*
    cancel(false)
    for (let i = 0; i < result.length; i++) {

        if (isCancelled) continue

        if (calls % 2 == 0) {
            //const member: GuildMember = await channelSecond.guild.members.fetch(result[i].discord_user_id);
            //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] SECOND mute_deafen()", e));
            const second = await handleQueue(channelSecond, result[i].discord_user_id, logger, voicestate);
            calls += 1;
            continue
        }

        //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] MAIN mute_deafen()", e));
        const main = await handleQueue(channelMain, result[i].discord_user_id, logger, voicestate);
        calls += 1;
        continue
    }*/
    logger.debug("Calls", calls)
    return calls
}

async function handleQueue(channel: VoiceBasedChannel, member_id: string, logger: Logger, voiceState: VoiceStateEnum) {

    //const member: GuildMember = await channel.guild.members.fetch(member_id);
    //if (member.voice.channel == undefined) return;


    try {
        switch (voiceState) {
            case VoiceStateEnum.MUTE_DEAFEN:
                await channel.guild.members.fetch(member_id).then(member => {
                    if (member.voice.channel == undefined) return
                    //if (member.voice.serverMute && member.voice.serverDeaf) return
                    member.edit({ mute: true, deaf: true })
                    logger.debug((channel.client.user.username == "AutoMute") ? `[BOT] MAIN ${member.displayName} muted and deafed` : `[BOT] SECOND ${member.displayName} muted and deafed`);
                }).catch((e) => logger.error((channel.client.user.username == "AutoMute") ? "[BOT] MAIN mute_deaf()" : "[BOT] SECOND mute_deaf()", e));
                break;
            case VoiceStateEnum.UNMUTE_UNDEAF:
                await channel.guild.members.fetch(member_id).then(member => {
                    if (member.voice.channel == undefined) return
                    //if (!member.voice.serverMute && !member.voice.serverDeaf) {logger.error("IF"); return}
                    member.edit({ mute: false, deaf: false })
                    logger.debug((channel.client.user.username == "AutoMute") ? `[BOT] MAIN ${member.displayName} unmuted and undeafed` : `[BOT] SECOND ${member.displayName} unmuted and undeafed`);
                }).catch((e) => logger.error((channel.client.user.username == "AutoMute") ? "[BOT] MAIN unmute_undeaf()" : "[BOT] SECOND unmute_undeaf()", e));
                break;
            case VoiceStateEnum.MUTE_ONLY:
                await channel.guild.members.fetch(member_id).then(member => {
                    if (member.voice.channel == undefined) return
                    //if (member.voice.serverMute) return
                    member.edit({ mute: true })
                    logger.debug((channel.client.user.username == "AutoMute") ? `[BOT] MAIN ${member.displayName} muted` : `[BOT] SECOND ${member.displayName} muted`);
                }).catch((e) => logger.error((channel.client.user.username == "AutoMute") ? "[BOT] MAIN mute()" : "[BOT] SECOND mute()", e));
                break;
            case VoiceStateEnum.MUTE_UNDEAF:
                await channel.guild.members.fetch(member_id).then(member => {
                    if (member.voice.channel == undefined) return
                    //if (member.voice.serverMute && !member.voice.serverDeaf) return
                    member.edit({ mute: true, deaf: false })
                    logger.debug((channel.client.user.username == "AutoMute") ? `[BOT] MAIN ${member.displayName} muted and undeafed` : `[BOT] SECOND ${member.displayName} muted and undeafed`);
                }).catch((e) => logger.error((channel.client.user.username == "AutoMute") ? "[BOT] MAIN mute_undeaf()" : "[BOT] SECOND mute_undeaf()", e));
                break;
        }

    } catch (err: any) {
        logger.error("CATCH");
    }
    finally {
    }
}

