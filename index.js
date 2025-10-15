import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  EmbedBuilder 
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

// ====== CONFIG ======
const monitoredBots = [
  "MONITORED_BOT_ID_1", // example: music bot
  "MONITORED_BOT_ID_2", // example: moderation bot
];
const ALERT_CHANNEL_ID = "YOUR_ALERT_CHANNEL_ID";
const GUILD_ID = "YOUR_GUILD_ID";
const CHECK_INTERVAL = 60 * 1000; // 1 minute

// ====== SLASH COMMAND REGISTRATION ======
const commands = [
  {
    name: "status",
    description: "Show the current status of all monitored bots",
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// ====== STATUS CHECK FUNCTION ======
async function getBotStatuses(guild) {
  const statuses = {};
  for (const botId of monitoredBots) {
    const member = await guild.members.fetch(botId).catch(() => null);
    const status = member?.presence?.status || "offline";
    statuses[botId] = status;
  }
  return statuses;
}

async function checkBots() {
  const channel = await client.channels.fetch(ALERT_CHANNEL_ID);
  if (!channel) return console.error("❌ Alert channel not found");
  const guild = channel.guild;

  const statuses = await getBotStatuses(guild);
  for (const [botId, status] of Object.entries(statuses)) {
    if (status === "offline") {
      await channel.send(
        `⚠️ <@${botId}> is **offline** as of <t:${Math.floor(Date.now() / 1000)}:T>.`
      );
    }
  }
}

// ====== SLASH COMMAND HANDLER ======
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "status") {
    const guild = interaction.guild;
    const statuses = await getBotStatuses(guild);

    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Status Monitor")
      .setColor(0x5865f2)
      .setTimestamp();

    for (const [botId, status] of Object.entries(statuses)) {
      const emoji =
        status === "online"
          ? "✅"
          : status === "idle"
          ? "🌙"
          : status === "dnd"
          ? "⛔"
          : "🔴";
      embed.addFields({
        name: `<@${botId}>`,
        value: `${emoji} **${status.toUpperCase()}**`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// ====== STARTUP ======
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();

  // Run periodic checks
  await checkBots();
  setInterval(checkBots, CHECK_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
