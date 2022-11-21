import {
    HindenburgPlugin,
    WorkerPlugin,
    EventListener,
    PlayerSetNameEvent,
    Room,
    Worker,
    GameCode,
    PlayerLeaveEvent,
    PlayerSetColorEvent,
    PlayerDieEvent,
    RoomGameStartEvent,
    RoomGameEndEvent,
    PlayerStartMeetingEvent,
    MeetingHudVotingCompleteEvent
} from "@skeldjs/hindenburg";
import { Client, GatewayIntentBits } from "discord.js";
import mariadb from 'mariadb';
import { userInfo } from "os";
import { EmbedGameState } from "./bot";
import { Bot } from "./bot/Bot";
import voicestate, { GameVoiceStateEnum } from "./bot/utils/voicestate";
import { DbConnection } from "./DbConnection";

export interface AutoMuteDiscordPluginConfig {
    botTokenMain: string;
    botTokenSecond: string;
    mariadbDatabase: string;
    mariadbUser: string;
    mariadbPassword: string;
    mariadbHost: string;
    mariadbPort: number;
}

@HindenburgPlugin("hbplugin-auto-mute-discord")
export class AutoMuteDiscordPlugin extends WorkerPlugin {
    db: DbConnection;
    mainBot: Bot
    secondBot: Bot
    controller: AbortController

    constructor(public readonly worker: Worker, public config: AutoMuteDiscordPluginConfig) {
        super(worker, config);
        this.controller = new AbortController()
        this.db = new DbConnection(config.mariadbDatabase, config.mariadbUser, config.mariadbPassword, config.mariadbHost, config.mariadbPort, this.logger);
        this.mainBot = new Bot(config, this.logger, this.db);
        this.secondBot = new Bot(config, this.logger);  
        this.mainBot.addEvents();
        this.secondBot.addEvents();
        this.mainBot.login(config.botTokenMain);
        this.secondBot.login(config.botTokenSecond);
           
    }

    onConfigUpdate(oldConfig: any, newConfig: any) {
        this.db = new DbConnection(newConfig.mariadbDatabase, newConfig.mariadbUser, newConfig.mariadbPassword, newConfig.mariadbHost, newConfig.mariadbPort, this.worker.logger);
    }

    async onPluginLoad() {
        const sqlDropPlayers = 'DROP TABLE IF EXISTS players'
        const sqlCreatePlayers = `CREATE TABLE players(
            client_id INTEGER NOT NULL,
            roomcode VARCHAR(6) NOT NULL,
            username VARCHAR(10) NOT NULL,
            color_id INTEGER,
            is_ghost BOOLEAN NOT NULL,
            is_host BOOLEAN NOT NULL,
            discord_user_id VARCHAR(25) UNIQUE,
            discord_voice_id VARCHAR(25),
            discord_text_id VARCHAR(25),
            discord_message_id VARCHAR(25),                        
            PRIMARY KEY (client_id),
            FOREIGN KEY (discord_user_id) REFERENCES linked_players(discord_user_id)
            ON UPDATE CASCADE
            ON DELETE SET NULL);`
        const sqlCreateLinkedPlayers = `CREATE TABLE IF NOT EXISTS linked_players(
            discord_user_id VARCHAR(25),
            username VARCHAR(10) NOT NULL,
            PRIMARY KEY (discord_user_id));`
        await this.db.query(sqlDropPlayers);
        await this.db.query(sqlCreateLinkedPlayers)
        await this.db.query(sqlCreatePlayers);
    }

    @EventListener("player.setname")
    async onPlayerSetName(ev: PlayerSetNameEvent<Room>) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        let sql = `INSERT INTO players (client_id, roomcode, username, is_ghost, is_host) VALUES(${ev.player.clientId}, '${roomcode}', '${ev.newName}', FALSE, FALSE) ON DUPLICATE KEY UPDATE username = '${ev.newName}'`
        await this.db.query(sql);

        sql = `SELECT discord_message_id, discord_text_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.LOBBY, true);
    }

    @EventListener("player.leave")
    async onPlayerLeave(ev: PlayerLeaveEvent<Room>) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        let sql = `SELECT discord_text_id, discord_message_id FROM players WHERE roomcode = '${roomcode}' and is_host = TRUE`
        
        const result = await this.db.query(sql);
        sql = `DELETE FROM players WHERE client_id = ${ev.player.clientId}`
        await this.db.query(sql)

        if (result[0] == undefined || result[0].discord_message_id == undefined) return;
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.LOBBY, false);
    }

    @EventListener("player.setcolor")
    async onPlayerSetColor(ev: PlayerSetColorEvent<Room>) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        let sql = `UPDATE players SET color_id = ${ev.newColor} WHERE client_id = ${ev.player.clientId}`
        await this.db.query(sql);

        sql = `SELECT discord_message_id, discord_text_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.LOBBY, false);
    }

    @EventListener("player.die")
    async onPlayerDie(ev: PlayerDieEvent<Room>) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        let sql = `UPDATE players SET is_ghost = TRUE WHERE client_id = ${ev.player.clientId}`
        await this.db.query(sql);

        this.logger.debug("PLAYER DIE")
        try {
            await voicestate(this.mainBot, this.secondBot, this.db, roomcode, GameVoiceStateEnum.MUTE_ONLY, this.logger);
        } catch (error: any) {
            if (error.name === "AbortError") this.logger.info("[BOT] ABORT: Mute Only");
            else this.logger.error("[BOT] ERROR: Mute Only", error);
        }
    }

    @EventListener("room.gamestart")
    async onGameStart(ev: RoomGameStartEvent) {
        const roomcode = GameCode.convertIntToString(ev.room.code)
        const sql = `SELECT discord_text_id, discord_message_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;

        const sql_update = `UPDATE players SET is_ghost = FALSE WHERE roomcode = '${roomcode}'`;
        await this.db.query(sql_update);

        this.logger.debug("ROOM GAMESTART")
        try {
            await voicestate(this.mainBot, this.secondBot, this.db, roomcode, GameVoiceStateEnum.GAME_START, this.logger);
        } catch (error: any) {
            if (error.name === "AbortError") this.logger.info("[BOT] ABORT: Game Start");
            else this.logger.error("[BOT] ERROR: Game Start", error);
        }
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.TASKS, false);
    }

    @EventListener("room.gameend")
    async onGameEnd(ev: RoomGameEndEvent) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        let sql = `SELECT discord_text_id, discord_message_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;

        sql = `UPDATE players SET is_ghost = FALSE WHERE roomcode = '${roomcode}'`;
        await this.db.query(sql);
        
        this.logger.debug("ROOM GAMEEND")
        try {
            await voicestate(this.mainBot, this.secondBot, this.db, roomcode, GameVoiceStateEnum.GAME_END, this.logger);
        } catch (error: any) {
            if (error.name === "AbortError") this.logger.info("[BOT] ABORT: Game End");
            else this.logger.error("[BOT] ERROR: Game End", error);
        }
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.LOBBY, false);
    }

    @EventListener("player.startmeeting")
    async onPlayerStartMeeting(ev: PlayerStartMeetingEvent<Room>) {
        const roomcode = GameCode.convertIntToString(ev.room.code);
        const sql = `SELECT discord_text_id, discord_message_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;
      
        this.logger.debug("START MEETING")
        try {
            await voicestate(this.mainBot, this.secondBot, this.db, roomcode, GameVoiceStateEnum.MEETING_START, this.logger);
        } catch (error: any) {
            if (error.name === "AbortError") this.logger.info("[BOT] ABORT: Meeting Start");
            else this.logger.error("[BOT] ERROR: Meeting Start", error);
        }
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.DISCUSSION, false);
    }

    @EventListener("meeting.votingcomplete")
    async onMeetingVotingComplete(ev: MeetingHudVotingCompleteEvent<Room>) {          
        const roomcode = GameCode.convertIntToString(ev.room.code);
        const sql = `SELECT discord_text_id, discord_message_id FROM players WHERE roomcode = '${roomcode}'`;
        const result = await this.db.query(sql);
        if (result[0] == undefined || result[0].discord_message_id == undefined) return;

        this.logger.debug("VOTING COMPLETE")
        try {
            await voicestate(this.mainBot, this.secondBot, this.db, roomcode, GameVoiceStateEnum.MEETING_END, this.logger);
        } catch (error: any) {
            if (error.name === "AbortError") this.logger.info("[BOT] ABORT: Meeting End");
            else this.logger.error("[BOT] ERROR: Meeting End", error);
        }
        await this.mainBot.updateEmbed(result[0].discord_text_id, result[0].discord_message_id, roomcode, EmbedGameState.TASKS, false);
    }




}

