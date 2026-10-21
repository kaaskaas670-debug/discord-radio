const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const STREAMS = {
    live: 'https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live_96.mp3',
    nonstop: 'https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_nonstop_high.aac',
    '90s00s': 'https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_90s00s_high.aac',
    top40: 'https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_top40_high.aac'
};

client.once('ready', async () => {
    console.log(`[ONLINE] Ingelogd als ${client.user.tag}`);
    try {
        const commands = [
            new SlashCommandBuilder()
                .setName('qmusic')
                .setDescription('Speel Qmusic in je voice channel')
                .addStringOption(opt => opt.setName('zender')
                    .setDescription('Welke zender?')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Qmusic Live 100.4 FM', value: 'live' },
                        { name: 'Qmusic Non-Stop', value: 'nonstop' },
                        { name: 'Qmusic 90s & 00s', value: '90s00s' },
                        { name: 'Qmusic Top 40', value: 'top40' }
                    )),
            new SlashCommandBuilder().setName('stop').setDescription('Stop radio en verlaat channel')
        ];
        await client.application.commands.set(commands);
        console.log('[SYNC] Slash commands gesynct');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'qmusic') {
        const memberChannel = interaction.member.voice.channel;
        if (!memberChannel) {
            return interaction.reply({ content: '❌ Join eerst een voice channel!', ephemeral: true });
        }
        await interaction.deferReply();

        const zender = interaction.options.getString('zender') || 'live';
        const url = STREAMS[zender] || STREAMS.live;

        const connection = getVoiceConnection(interaction.guildId) || joinVoiceChannel({
            channelId: memberChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        const player = createPlayer();
        const resource = createAudioResource(url, { inlineVolume: true });
        resource.volume.setVolume(0.5);

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            // auto reconnect voor radio
            try {
                const newResource = createAudioResource(url);
                player.play(newResource);
            } catch {}
        });

        const embed = new EmbedBuilder()
            .setTitle('📻 Qmusic LIVE')
            .setDescription(`**${zender.toUpperCase()}** speelt nu in ${memberChannel}\n\`/stop\` om te stoppen`)
            .setColor(0xE6007E);

        await interaction.followUp({ embeds: [embed] });
    }

    if (interaction.commandName === 'stop') {
        const conn = getVoiceConnection(interaction.guildId);
        if (conn) {
            conn.destroy();
            await interaction.reply('👋 Gestopt!');
        } else {
            await interaction.reply({ content: 'Ik zit nergens in.', ephemeral: true });
        }
    }
});

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
    console.error('❌ DISCORD_TOKEN ontbreekt! Zet hem in Startup Variables');
    process.exit(1);
}
client.login(token);
