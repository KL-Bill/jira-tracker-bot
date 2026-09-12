# TMC Track Bot

A tiny Discord bot with two commands:

- **`/track`** — hits Jira live and tells you, right now, whether TMC HRIS is on
  schedule. Same verdict logic as the Friday auto-report, just on-demand.
- **`/my-tasks`** — shows the caller's own open Jira tasks, soonest due date first.

```
📊 Schedule Check                       📋 kenlloyd's Open Tasks
🟢 ON TRACK                             KAN-411 A.4b My Pay — In Progress — due 2026-10-23
                                         KAN-467 Notification service — Backlog — no due date
Week      Overdue    Due within 3 days
6 of 17   0 tasks    0 tasks            2 tasks assigned

Overdue tickets: None
Due soon tickets: None
```

Both commands share the same Jira client (`lib/jira.js`) and the same status
color scheme as the Jira automation rules — a task's color means the same thing
everywhere: in the Friday Discord post, in `/track`, and in `/my-tasks`.

---

## 1. Create the Discord bot

1. Go to https://discord.com/developers/applications → **New Application** → name it (e.g. "TMC Track Bot").
2. Left sidebar → **Bot** → **Reset Token** → copy it. This is `DISCORD_TOKEN`. Keep it secret — anyone with it can control the bot.
3. Still on the **Bot** page, turn **off** all three Privileged Gateway Intents (this bot doesn't need them).
4. Left sidebar → **General Information** → copy **Application ID**. This is `DISCORD_CLIENT_ID`.
5. Left sidebar → **OAuth2** → **URL Generator**:
   - Scopes: check `bot` and `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`
   - Copy the generated URL, open it, pick your **KL Projects** server, authorize.
6. In Discord, right-click your server icon → **Copy Server ID** (enable Developer Mode in Settings → Advanced if you don't see this). This is `DISCORD_GUILD_ID` — only needed for instant testing, optional for production.

## 2. Get a Jira API token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. **Create API token** → name it → copy it. This is `JIRA_API_TOKEN`.
3. `JIRA_EMAIL` is the email you log into Jira with.

## 3. Configure

Copy `.env.example` to `.env` and fill in all the values from steps 1–2.

```bash
cp .env.example .env
```

### Map each teammate to their Jira account (needed for `/my-tasks`)

There's no login flow here — for a team this size, a plain mapping file is
simpler and more reliable than building account-linking. Edit
`config/users.json`:

1. In Discord, turn on Developer Mode: Settings → Advanced → Developer Mode.
2. Right-click each teammate → **Copy User ID**.
3. Add a line per person:

```json
{
  "123456789012345678": "ken@example.com",
  "987654321098765432": "otherperson@example.com"
}
```

Key = Discord user ID, value = the exact email that person logs into Jira with.
Anyone not listed gets a friendly "I don't know your Jira account yet" reply
instead of an error — add them to the file and they're in.

`/track` needs none of this — it's project-wide, not personal.

## 4. Test locally

```bash
npm install
npm run deploy-commands   # registers /track and /my-tasks (instant if DISCORD_GUILD_ID is set)
npm start
```

Go to Discord and type `/track` in any channel the bot can see — it should reply
within a couple seconds. Then add yourself to `config/users.json` (see above)
and try `/my-tasks`.

## 5. Deploy to Railway (so it stays running)

1. Push this folder to a GitHub repo (private is fine).
2. Go to https://railway.app → **New Project** → **Deploy from GitHub repo** → pick it.
3. Railway auto-detects Node and runs `npm start`.
4. In the Railway project → **Variables** tab, paste in every value from your `.env` file (same names).
5. **Before the first deploy actually goes live**, run `npm run deploy-commands` once — either:
   - locally, with your real `.env` filled in, or
   - via Railway's **one-off command** feature (Settings → run a command) if you'd rather not run it locally.
   This step only needs to happen once, or again if you ever change the command definition in `deploy-commands.js`.
6. Once deployed, Railway keeps the process alive. `/track` works in Discord from anywhere, anytime.

**Note on the free tier:** Railway's free tier includes a monthly usage allowance (hours + a small credit). A bot this small, doing nothing but waiting for a slash command, uses very little — it should comfortably fit. If you ever see it sleep or get suspended, that's the usage cap; either upgrade or move to Render's free tier as a backup (same setup, different dashboard).

## Notes

- The `/track` verdict logic is a mirror of the Jira automation rule "Weekly schedule
  verdict" — same JQL, same thresholds. The two will never disagree.
- `PROJECT_START_DATE` and `PROJECT_TOTAL_WEEKS` in `.env` control the "Week X of Y"
  display. Adjust `PROJECT_TOTAL_WEEKS` if the timeline changes.
- To add more commands later (e.g. `/track phase P4`), add a new `SlashCommandBuilder`
  in `deploy-commands.js` and a new handler branch in `index.js`.
