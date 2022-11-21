import { Logger } from "@skeldjs/hindenburg";
import { Client, Interaction, CommandInteraction, SelectMenuInteraction, Message} from "discord.js";
import { DbConnection } from "../../DbConnection";
import { Bot } from "../Bot";
import { CommandsList } from "../CommandsList";
import selectHostPlayer from "../components/selectHostPlayer";
import selectLinkPlayer from "../components/selectLinkPlayer";
import selectRemoteLinkPlayer from "../components/selectRemoteLinkPlayer";

export default (client: Client, logger: Logger, db: DbConnection, bot: Bot): void => {
    client.on("interactionCreate",async (interaction: Interaction) => {
        if (interaction.isCommand() || interaction.isContextMenuCommand()) {
            await handleSlashCommand(client, interaction, logger, db)
        }
        if (interaction.isSelectMenu()) {
            await handleSelectMenu(client, interaction, logger, db, bot)
        }
    })
}

const handleSlashCommand = async (client: Client, interaction: CommandInteraction, logger: Logger, db: DbConnection): Promise<void> => {
    const slashCommand = CommandsList.find(cmd => cmd.name === interaction.commandName)
    if (!slashCommand) {
        interaction.followUp({ content: "An error has occurred" }).catch(err => {
            logger.error("ERROR handleSlashCommand followUp")
            logger.error(err)
        })
        return;
    }
    //await interaction.deferReply()
    slashCommand.run(client, interaction, logger, db);
};

const handleSelectMenu = async (client: Client, interaction: SelectMenuInteraction, logger: Logger, db: DbConnection, bot: Bot): Promise<void> => {
    if (interaction.customId === "select-host-player") selectHostPlayer(client, interaction, logger, db, bot);
    if (interaction.customId === "select-link-player") selectLinkPlayer(client, interaction, logger, db, bot);
    if (interaction.customId === "select-remote-link-player") selectRemoteLinkPlayer(client, interaction, logger, db, bot);
}