import { AsyncQueue } from "@sapphire/async-queue";
import { Logger } from "@skeldjs/hindenburg";
import async from "async";
import { Channel, GuildMember, TextChannel, User, VoiceBasedChannel } from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";

export enum GameVoiceStateEnum {
    GAME_START,
    GAME_END,
    MEETING_START,
    MEETING_END,
    MUTE_ONLY
}

export enum VoiceStateEnum {
    MUTE_DEAFEN,
    UNMUTE_UNDEAF,
    MUTE_UNDEAF,
    MUTE_ONLY,
}

export const queue = async.queue((_task, _completed) => {

})

export default async (mainBot: Bot, secondBot: Bot, db: DbConnection, code: string, gameVoiceState: GameVoiceStateEnum, logger: Logger): Promise<void> => {
    
    if (gameVoiceState == GameVoiceStateEnum.MUTE_ONLY && !queue.idle()) return;  
    queue.kill()

    switch(gameVoiceState) {
        case GameVoiceStateEnum.GAME_START:
            const sql_gameStart = `SELECT discord_user_id, discord_voice_id FROM players WHERE discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const gameStart = await db.query(sql_gameStart);
            if (gameStart[0] == undefined) return;

            await splitMembers(gameStart, mainBot, secondBot, logger, VoiceStateEnum.MUTE_DEAFEN)

            break;
        case GameVoiceStateEnum.GAME_END:
            const sql_gameEnd = `SELECT discord_user_id, discord_voice_id FROM players WHERE discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const gameEnd = await db.query(sql_gameEnd);
            if (gameEnd[0] == undefined) return;

            await splitMembers(gameEnd, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF)

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
                await splitMembers(meetingStartAlive, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF, calls)
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
                await splitMembers(meetingEndDead, mainBot, secondBot, logger, VoiceStateEnum.UNMUTE_UNDEAF, calls_2)
            }

            break;
        case GameVoiceStateEnum.MUTE_ONLY:
            const sql_muteOnly = `SELECT discord_user_id, discord_voice_id FROM players WHERE is_ghost = TRUE and discord_user_id IS NOT NULL and discord_voice_id IS NOT NULL and roomcode = '${code}'`;
            const muteOnly = await db.query(sql_muteOnly);
            if (muteOnly[0] == undefined) return;
            
            await splitMembers(muteOnly, mainBot, secondBot, logger, VoiceStateEnum.MUTE_ONLY)

            break;
    }
}

async function splitMembers(result: any, mainBot: Bot, secondBot: Bot, logger: Logger,  voicestate: VoiceStateEnum, calls: number = 0) {
    const channelMain: VoiceBasedChannel = await mainBot.client.channels.fetch(result[0].discord_voice_id) as VoiceBasedChannel;
    const channelSecond: VoiceBasedChannel = await secondBot.client.channels.fetch(result[0].discord_voice_id) as VoiceBasedChannel;

    if (channelMain == undefined || channelSecond == undefined) return 0;

    for(let i = 0; i < result.length; i++) {
        const member: GuildMember = await channelMain.guild.members.fetch(result[i].discord_user_id);
        if (member.voice.channel == undefined) continue;

        if (calls % 2 == 0) {
            const member: GuildMember = await channelSecond.guild.members.fetch(result[i].discord_user_id);
            //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] SECOND mute_deafen()", e));
            queue.push(handleQueue(member, false, logger, voicestate));
            calls += 1;
            continue
        }

        //await member.edit({mute: true, deaf: true}).catch((e) => logger.error("[BOT] MAIN mute_deafen()", e));
        queue.push(handleQueue(member, true, logger, voicestate));
        calls += 1;
        continue
    }
    logger.debug("Calls", calls)
    return calls
}

async function handleQueue(member: GuildMember, isMain: boolean, logger: Logger, voiceState: VoiceStateEnum) {
    try {
        switch(voiceState) {
            case VoiceStateEnum.MUTE_DEAFEN:
                if (member.voice.serverMute && member.voice.serverDeaf) break;
                await member.edit({mute: true, deaf: true}).catch((e) => logger.error((isMain) ? "[BOT] MAIN mute_deaf()" : "[BOT] SECOND mute_deaf()", e));
                logger.debug((isMain) ? `[BOT] MAIN ${member.displayName} muted and deafed` : `[BOT] SECOND ${member.displayName} muted and deafed`);
                break;
            case VoiceStateEnum.UNMUTE_UNDEAF:
                if (member.voice.serverMute && !member.voice.serverDeaf) { logger.error("IF"); break;}
                logger.error("NOT IF")
                await member.edit({mute: false, deaf: false}).catch((e) => logger.error((isMain) ? "[BOT] MAIN mute_deafen()" : "[BOT] SECOND mute_deafen()", e));
                logger.debug((isMain) ? `[BOT] MAIN ${member.displayName} unmuted and undeafed` : `[BOT] SECOND ${member.displayName} unmuted and undeafed`);
                break;
            case VoiceStateEnum.MUTE_ONLY:
                if (member.voice.serverMute) break;
                await member.edit({mute: true}).catch((e) => logger.error((isMain) ? "[BOT] MAIN mute_deafen()" : "[BOT] SECOND mute_deafen()", e));
                logger.debug((isMain) ? `[BOT] MAIN ${member.displayName} muted` : `[BOT] SECOND ${member.displayName} muted`);
                break;
            case VoiceStateEnum.MUTE_UNDEAF:
                if (member.voice.serverMute && !member.voice.serverDeaf) break;
                await member.edit({mute: true, deaf: false}).catch((e) => logger.error((isMain) ? "[BOT] MAIN mute_deafen()" : "[BOT] SECOND mute_deafen()", e));
                logger.debug((isMain) ? `[BOT] MAIN ${member.displayName} muted and undeafed` : `[BOT] SECOND ${member.displayName} muted and undeafed`);
                break;
        }
        
    } catch(err: any) {
        logger.error("CATCH");
    } 
    finally {
        
    }
}

