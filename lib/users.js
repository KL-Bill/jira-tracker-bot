const fs = require('fs');
const path = require('path');

const MAP_PATH = path.join(__dirname, '..', 'config', 'users.json');

function loadMap() {
  const raw = fs.readFileSync(MAP_PATH, 'utf8');
  const map = JSON.parse(raw);
  delete map._comment;
  return map;
}

/**
 * Returns the Jira email mapped to a Discord user ID, or null if unmapped.
 */
function getJiraEmail(discordUserId) {
  const map = loadMap();
  return map[discordUserId] || null;
}

module.exports = { getJiraEmail };
