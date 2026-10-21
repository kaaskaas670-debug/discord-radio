import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

STREAMS = {
    "live": "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live_96.mp3",
    "nonstop": "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_nonstop_high.aac",
    "90s00s": "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_90s00s_high.aac",
    "top40": "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_top40_high.aac",
}

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"[ONLINE] Ingelogd als {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"[SYNC] {len(synced)} slash commands")
    except Exception as e:
        print(f"[ERROR] Sync failed: {e}")

def get_source(url):
    return discord.FFmpegPCMAudio(
        url,
        before_options="-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -probesize 256k",
        options="-vn -bufsize 64k"
    )

@bot.tree.command(name="qmusic", description="Speel Qmusic in je voice channel")
@discord.app_commands.describe(zender="Welke zender?")
@discord.app_commands.choices(zender=[
    discord.app_commands.Choice(name="Qmusic Live 100.4 FM", value="live"),
    discord.app_commands.Choice(name="Qmusic Non-Stop", value="nonstop"),
    discord.app_commands.Choice(name="Qmusic 90s & 00s", value="90s00s"),
    discord.app_commands.Choice(name="Qmusic Top 40", value="top40"),
])
async def qmusic(interaction: discord.Interaction, zender: str = "live"):
    if not interaction.user.voice or not interaction.user.voice.channel:
        await interaction.response.send_message("❌ Join eerst een voice channel!", ephemeral=True)
        return
    await interaction.response.defer()

    channel = interaction.user.voice.channel
    url = STREAMS.get(zender, STREAMS["live"])

    vc = interaction.guild.voice_client
    try:
        if vc and vc.is_connected():
            await vc.move_to(channel)
        else:
            vc = await channel.connect(self_deaf=True, timeout=20)
    except Exception as e:
        await interaction.followup.send(f"Kon niet joinen: {e}")
        return

    if vc.is_playing():
        vc.stop()

    vc.play(get_source(url))
    
    embed = discord.Embed(
        title="📻 Qmusic LIVE",
        description=f"**{zender.upper()}** speelt nu in {channel.mention}\n`/stop` om te stoppen",
        color=0xE6007E
    )
    await interaction.followup.send(embed=embed)

@bot.tree.command(name="stop", description="Stop radio en verlaat channel")
async def stop(interaction: discord.Interaction):
    vc = interaction.guild.voice_client
    if vc and vc.is_connected():
        await vc.disconnect()
        await interaction.response.send_message("👋 Gestopt!")
    else:
        await interaction.response.send_message("Ik zit nergens in.", ephemeral=True)

TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    raise ValueError("DISCORD_TOKEN ontbreekt in .env")
bot.run(TOKEN)
