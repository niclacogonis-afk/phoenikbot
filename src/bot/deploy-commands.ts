import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { Command } from '../types';

const commands: object[] = [];
const commandsPath = path.join(__dirname, 'commands');

function loadCommandsFromDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      loadCommandsFromDir(itemPath);
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      try {
        const mod = require(itemPath);
        const command: Command = mod.default ?? mod;
        if (command?.data) {
          commands.push(command.data.toJSON());
        }
      } catch (err) {
        console.error(`Failed to load ${item}:`, err);
      }
    }
  }
}

loadCommandsFromDir(commandsPath);

const rest = new REST({ version: '10' }).setToken(process.env['DISCORD_TOKEN']!);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env['CLIENT_ID']!),
      { body: commands }
    );
    console.log(`✅ Successfully registered ${commands.length} slash commands globally.`);
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();
