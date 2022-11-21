import { Command } from "./Command";
import { Link } from "./commands/Link";
import { Setup } from "./commands/Setup";
import { Unlink } from "./commands/Unlink";

export const CommandsList: Command[] = [Setup, Link, Unlink]; 