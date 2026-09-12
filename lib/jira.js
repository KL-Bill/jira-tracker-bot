const fetch = require('node-fetch');

const BASE = process.env.JIRA_BASE_URL;
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

/**
 * Runs a JQL query and returns the matching issues (up to 100).
 * Same endpoint and shape used by the Jira automation rules built for this project.
 */
async function searchIssues(jql, fields = ['key', 'summary']) {
  const res = await fetch(`${BASE}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({ jql, maxResults: 100, fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira search failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.issues || [];
}

/**
 * Counts overdue, due-soon (next 3 days), and lists both sets of issues.
 * Mirrors exactly the JQL used in the "Weekly schedule verdict" Jira automation rule,
 * so the bot and the Friday auto-report never disagree.
 */
async function getScheduleStatus() {
  const project = process.env.JIRA_PROJECT_KEY;

  const overdueJql = `project = ${project} AND issuetype = Task AND status not in (Done) AND duedate < now()`;
  const dueSoonJql = `project = ${project} AND issuetype = Task AND status not in (Done) AND duedate >= now() AND duedate <= 3d`;

  const [overdue, dueSoon] = await Promise.all([
    searchIssues(overdueJql, ['key', 'summary', 'duedate']),
    searchIssues(dueSoonJql, ['key', 'summary', 'duedate']),
  ]);

  let verdict, color;
  if (overdue.length > 0) {
    verdict = '🔴 BEHIND SCHEDULE';
    color = 0xE74C3C;
  } else if (dueSoon.length > 0) {
    verdict = '🟡 TIGHT MARGIN';
    color = 0xF1C40F;
  } else {
    verdict = '🟢 ON TRACK';
    color = 0x2ECC71;
  }

  return { verdict, color, overdue, dueSoon };
}

/**
 * Computes which project week we're currently in, based on a fixed start date.
 */
function getCurrentWeek() {
  const start = new Date(process.env.PROJECT_START_DATE);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = now.getTime() - start.getTime();
  const weekNumber = Math.max(1, Math.floor(diff / msPerWeek) + 1);
  const totalWeeks = parseInt(process.env.PROJECT_TOTAL_WEEKS || '17', 10);
  return { weekNumber, totalWeeks };
}

/**
 * Same six-status color mapping used in the Jira automation rules,
 * so a task's color means the same thing whether you see it in Discord's
 * auto-posted card or in /my-tasks.
 */
const STATUS_COLORS = {
  Backlog: 0x99AAB5,
  Ready: 0x00FFA2,
  'In Progress': 0x3498DB,
  'In Review': 0x9B59B6,
  Testing: 0xF5A623,
  Done: 0x2ECC71,
};

function colorForStatus(statusName) {
  return STATUS_COLORS[statusName] || 0x99AAB5;
}

/**
 * Fetches open (non-Done) tasks assigned to the given Jira email,
 * soonest due date first (tasks with no due date last).
 */
async function getAssignedTasks(jiraEmail) {
  const project = process.env.JIRA_PROJECT_KEY;
  // const jql = `project = ${project} AND issuetype = Task AND status != Done AND assignee = "${jiraEmail}" ORDER BY duedate ASC`;
  const jql = `project = ${project} AND status != Done AND assignee = "${jiraEmail}" ORDER BY duedate ASC`;
  return searchIssues(jql, ['key', 'summary', 'status', 'duedate']);
}

module.exports = { searchIssues, getScheduleStatus, getCurrentWeek, getAssignedTasks, colorForStatus };
