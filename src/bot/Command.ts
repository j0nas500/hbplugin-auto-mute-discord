import { Logger } from "@skeldjs/hindenburg";
import { ChatInputApplicationCommandData, Client, CommandInteraction } from "discord.js";
import { DbConnection } from "../DbConnection";

export interface Command extends ChatInputApplicationCommandData {
    run: (client: Client, interaction: CommandInteraction, logger: Logger, db: DbConnection) => void
}