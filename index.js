require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { getScheduleStatus, getCurrentWeek, getAssignedTasks, colorForStatus } = require('./lib/jira');
const { getJiraEmail } = require('./lib/users');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}. Listening for /track.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'my-tasks') {
    await interaction.deferReply();

    const jiraEmail = getJiraEmail(interaction.user.id);
    if (!jiraEmail) {
      await interaction.editReply(
        "I don't know your Jira account yet. Ask whoever runs the bot to add your Discord ID to `config/users.json`."
      );
      return;
    }

    try {
      const tasks = await getAssignedTasks(jiraEmail);

      if (tasks.length === 0) {
        await interaction.editReply('✅ Nothing open assigned to you right now.');
        return;
      }

      const lines = tasks.map((t) => {
        const due = t.fields.duedate ? `due ${t.fields.duedate}` : 'no due date';
        const url = `${process.env.JIRA_BASE_URL}/browse/${t.key}`;
        return `**[${t.key}](${url})** ${t.fields.summary} — ${t.fields.status.name} — ${due}`;
      });

      // Overall embed color: red if anything is overdue, otherwise the status color of the soonest task.
      const today = new Date().toISOString().slice(0, 10);
      const hasOverdue = tasks.some((t) => t.fields.duedate && t.fields.duedate < today);
      const color = hasOverdue ? 0xE74C3C : colorForStatus(tasks[0].fields.status.name);

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${interaction.user.username}'s Open Tasks`)
        .setDescription(lines.join('\n'))
        .setColor(color)
        .setFooter({ text: `${tasks.length} task${tasks.length === 1 ? '' : 's'} assigned` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply('⚠️ Could not reach Jira right now. Try again in a moment.');
    }
    return;
  }

  if (interaction.commandName !== 'track') return;

  // Jira calls can take a moment; defer so Discord doesn't time out the interaction.
  await interaction.deferReply();

  try {
    const { verdict, color, overdue, dueSoon } = await getScheduleStatus();
    const { weekNumber, totalWeeks } = getCurrentWeek();

    const overdueList = overdue.length
      ? overdue.slice(0, 5).map((i) => `[${i.key}](${process.env.JIRA_BASE_URL}/browse/${i.key})`).join(', ') +
        (overdue.length > 5 ? ` and ${overdue.length - 5} more` : '')
      : 'None';

    const dueSoonList = dueSoon.length
      ? dueSoon.slice(0, 5).map((i) => `[${i.key}](${process.env.JIRA_BASE_URL}/browse/${i.key})`).join(', ') +
        (dueSoon.length > 5 ? ` and ${dueSoon.length - 5} more` : '')
      : 'None';

    const embed = new EmbedBuilder()
      .setTitle('📊 Schedule Check')
      .setDescription(verdict)
      .setColor(color)
      .addFields(
        { name: 'Week', value: `${weekNumber} of ${totalWeeks}`, inline: true },
        { name: 'Overdue', value: `${overdue.length} tasks`, inline: true },
        { name: 'Due within 3 days', value: `${dueSoon.length} tasks`, inline: true },
        { name: 'Overdue tickets', value: overdueList, inline: false },
        { name: 'Due soon tickets', value: dueSoonList, inline: false },
      )
      .setFooter({ text: 'TMC HRIS - KL Projects' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.editReply('⚠️ Could not reach Jira right now. Try again in a moment.');
  }
});

client.login(process.env.DISCORD_TOKEN);
