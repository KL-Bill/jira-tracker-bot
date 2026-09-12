require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('track')
    .setDescription('Show if TMC HRIS is on schedule right now'),
  new SlashCommandBuilder()
    .setName('my-tasks')
    .setDescription('Show your open Jira tasks, soonest due date first'),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      // Guild-scoped: shows up instantly, good for testing.
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered /track for guild ${guildId} (instant).`);
    } else {
      // Global: works in any server the bot is in, but can take up to an hour to appear.
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered /track globally (may take up to 1 hour to appear).');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
