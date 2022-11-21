import { Logger } from "@skeldjs/hindenburg";
import { Client } from "discord.js";
import { CommandsList } from "../CommandsList"

export default (client: Client, logger: Logger): void => {
    client.on("ready", async () => {
        if (!client.user || !client.application) {
            return;
        }
        await client.application.commands.set(CommandsList)
        logger.info(`[BOT] ${client.user.username} is online`);
    });
}; 