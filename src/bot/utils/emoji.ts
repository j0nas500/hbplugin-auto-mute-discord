export enum Emoji{
    ALIVE,
    DEAD,
    Name
}

export default (id: number, emojiEnum: Emoji): string => {
    switch(emojiEnum) {
        case Emoji.ALIVE:
            return getEmoji(id);
        case Emoji.DEAD:
            return getEmojiDead(id);
        case Emoji.Name:
            return getEmojiName(id);
    }    
}

function getEmoji(id: number): string {
    switch(id) {
        case 0:
            return "<:aured:760499127569219654>"
        case 1:
            return "<:aublue:760499129188352032>"
        case 2:
            return "<:augreen:760499131122319400>"
        case 3:
            return "<:aupink:760499132430942229>"
        case 4:
            return "<:auorange:760499134398201905>"
        case 5:
            return "<:auyellow:760499136326795274>"
        case 6:
            return "<:aublack:760499138470215691>"
        case 7:
            return "<:auwhite:760499140835803207>"
        case 8:
            return "<:aupurple:760499143050526791>"
        case 9:
            return "<:aubrown:760499145101410375>"
        case 10:
            return "<:aucyan:760499147337367603>"
        case 11:
            return "<:aulime:760499151736930325>"
        case 12:
            return "<:aumaroon:855851753520758824>"
        case 13:
            return "<:aurose:855851754684022814>"
        case 14:
            return "<:aubanana:855851755745312790>"
        case 15:
            return "<:augray:855851757447544842>"
        case 16:
            return "<:autan:855851758768226314>"
        case 17:
            return "<:aucoral:855851759653879879>"
        default:
            return "<:aured:760499127569219654>"
    }
}

function getEmojiDead(id: number): string {
    switch(id) {
        case 0:
            return "<:auredd:1042300451921600512>"
        case 1:
            return "<:aublued:1042303352677081169>"
        case 2:
            return "<:augreend:1042303618927317073>"
        case 3:
            return "<:aupinkd:1042303751224045590>"
        case 4:
            return "<:auoranged:1042303721104744499>"
        case 5:
            return "<:auyellowd:1042304104308953158>"
        case 6:
            return "<:aublackd:1042303279440334878>"
        case 7:
            return "<:auwhited:1042304060797222962>"
        case 8:
            return "<:aupurpled:1042303785021747250>"
        case 9:
            return "<:aubrownd:1042303397157683240>"
        case 10:
            return "<:aucyand:1042303541408182282>"
        case 11:
            return "<:aulimed:1042303646089613382>"
        case 12:
            return "<:aumaroond:1042303685880991754>"
        case 13:
            return "<:aurosed:1042303921261125724>"
        case 14:
            return "<:aubananad:1042303225166037012>"
        case 15:
            return "<:augrayd:1042303581467979856>"
        case 16:
            return "<:autand:1042303998914478111>"
        case 17:
            return "<:aucorald:1042303431043452999>"
        default:
            return "<:auredd:1042300451921600512>"
    }
}

function getEmojiName(id: number): string {
    switch(id) {
        case 0:
            return "red"
        case 1:
            return "blue"
        case 2:
            return "green"
        case 3:
            return "pink"
        case 4:
            return "orange"
        case 5:
            return "yellow"
        case 6:
            return "black"
        case 7:
            return "white"
        case 8:
            return "purple"
        case 9:
            return "brown"
        case 10:
            return "cyan"
        case 11:
            return "lime"
        case 12:
            return "maroon"
        case 13:
            return "rose"
        case 14:
            return "banana"
        case 15:
            return "gray"
        case 16:
            return "tan"
        case 17:
            return "coral"
        default:
            return "red"
    }
}
