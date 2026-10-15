/**
 * OnyxGuard - Commands Cache Generator
 * Reads all command files from disk and writes commands-cache.json
 * This runs WITHOUT the bot being online — pure static extraction.
 * 
 * Usage: node scripts/generate-commands-cache.js
 */

const { readdirSync, writeFileSync } = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');

class StubClient {
  constructor() {
    this.config = {
      Client: {
        PrimaryColor: '#ff2b43',
        SuccessColor: '#00e676',
        ErrorColor: '#ff1744',
        emoji: { tick: '✅', down: '❌', up: '✅' },
        TopGG: '',
        botId: '',
        botSecret: '',
      },
    };
    this.util = {};
  }
}

const COMMANDS_DIR = path.resolve(__dirname, '../src/commands');
const OUTPUT_FILE = path.resolve(__dirname, '../commands-cache.json');

function extractCommands() {
  const results = [];
  const stubClient = new StubClient();
  const categories = readdirSync(COMMANDS_DIR);

  for (const category of categories) {
    const categoryPath = path.join(COMMANDS_DIR, category);
    let files;
    try {
      files = readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const CommandClass = require(filePath);
        if (typeof CommandClass !== 'function') continue;

        const cmdName = file.replace('.js', '').toLowerCase();
        const instance = new CommandClass(stubClient, cmdName);
        const g = instance.Global || {};
        const rawUsage = g.usage || instance.usage || instance.examples;
        let usageText = '$' + (instance.name || cmdName);

        if (Array.isArray(rawUsage) && rawUsage.length > 0) {
          usageText = rawUsage[0].startsWith('$') ? rawUsage[0] : '$' + rawUsage[0];
        } else if (typeof rawUsage === 'string' && rawUsage !== 'No usage provided.') {
          usageText = rawUsage.startsWith('$') ? rawUsage : '$' + rawUsage;
        }

        const userPermsArray = Array.isArray(g.userPerms)
          ? g.userPerms
          : (instance.userPerms instanceof PermissionsBitField ? instance.userPerms.toArray() : []);
        const botPermsArray = Array.isArray(g.botPerms)
          ? g.botPerms
          : (instance.botPerms instanceof PermissionsBitField ? instance.botPerms.toArray() : []);
        const permsString = userPermsArray.length > 0 ? userPermsArray.join(', ') : 'Everyone';
        const cat = g.category || instance.category || category;

        if (cat === 'Owners' || cat === 'Owner') continue;

        results.push({
          name: g.name || instance.name || cmdName,
          description: g.description || instance.description || 'No description provided.',
          category: cat,
          usage: usageText,
          aliases: Array.isArray(g.aliases) ? g.aliases : (Array.isArray(instance.aliases) ? instance.aliases : []),
          cooldown: typeof g.cooldown === 'number' ? g.cooldown : (typeof instance.cooldown === 'number' ? instance.cooldown : 3),
          userPerms: userPermsArray,
          botPerms: botPermsArray,
          permissions: permsString,
        });
      } catch (err) {
        console.warn('  Warning skipped ' + file + ': ' + err.message);
      }
    }
  }
  return results;
}

const commands = extractCommands();
writeFileSync(OUTPUT_FILE, JSON.stringify(commands, null, 2), 'utf-8');
console.log('Written ' + commands.length + ' commands to commands-cache.json');
const cats = {};
for (const c of commands) cats[c.category] = (cats[c.category] || 0) + 1;
for (const [cat, count] of Object.entries(cats)) {
  console.log('  ' + cat + ': ' + count);
}
