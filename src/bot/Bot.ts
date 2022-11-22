import { Channel, Client, GatewayIntentBits, Message, StageChannel, TextChannel, VoiceBasedChannel, VoiceChannel } from "discord.js";

import { AutoMuteDiscordPluginConfig } from "../plugin";
import { Logger } from "@skeldjs/hindenburg";
import ready from "./events/ready";
import voiceStateUpdate from "./events/voiceStateUpdate";
import interactionCreate from "./events/interactionCreate";
import { DbConnection } from "../DbConnection";
import { channel } from "diagnostics_channel";
import embed, { EmbedGameState } from "./utils/embed";

export class Bot {
    public client: Client
    private logger: Logger
    private db: DbConnection | undefined

    constructor(public config: AutoMuteDiscordPluginConfig, logger: Logger, db?: DbConnection) {
        this.logger = logger
        this.db = db
        this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

    }

    addEvents() {
        ready(this.client, this.logger);
        if (this.db === undefined) return
        voiceStateUpdate(this.client, this.logger, this.db, this)
        interactionCreate(this.client, this.logger, this.db, this)

    }

    login(token: string) {
        this.client.login(token).catch(error => {
            this.logger.error("ERROR BOT LOGIN")
            this.logger.error(error)
        })
    }

    async updateEmbed(channel_id: string, message_id: string, code: string, gameState: EmbedGameState, autoLink: boolean) {
        if (message_id == undefined || channel_id == undefined) {
            this.logger.error("Message or Channel ID undefined in updateEmbed()")
            this.logger.debug("channel_id", channel_id)
            this.logger.debug("message_id", message_id)
            return
        }

        if (code == undefined) {
            this.logger.error("CODE undefined in updateEmbed()")
            this.logger.debug("channel_id", channel_id)
            return
        }

        if (this.db == undefined) {
            this.logger.error("updateEmbed() in Bot.ts: DB CONNECTION undefined")
            return
        }
        const channel = await this.client.channels.fetch(channel_id)
        if (channel == undefined || !channel.isTextBased()) {
            this.logger.error("updateEmbed() in Bot.ts: Channel not found");
            const sql = `UPDATE players SET discord_message_id = NULL, discord_text_id = NULL, is_host = FALSE WHERE discord_message_id = ${message_id}`;
            await this.db.query(sql);
            return
        }
        const message: Message<boolean> | void = await channel.messages.fetch(message_id).catch((e) => this.logger.error("updateEmbed() Message not found"));
        if (message == undefined) {
            this.logger.error("updateEmbed() Message undefined")
            return
        }
        await embed(this.client, this.logger, this.db, message, code, gameState, autoLink)       
    }
    
}

