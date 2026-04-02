import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { EconomyManager } from '../../../modules/economy/EconomyManager';
import { getUserWallet } from '../../../database/models/Economy';

function getCard(): { suit: string; value: string; num: number } {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suit = suits[Math.floor(Math.random() * suits.length)]!;
  const vi = Math.floor(Math.random() * values.length);
  const value = values[vi]!;
  const num = vi === 0 ? 11 : Math.min(vi + 1, 10);
  return { suit, value, num };
}

function handTotal(cards: { num: number; value: string }[]): number {
  let total = cards.reduce((s, c) => s + c.num, 0);
  let aces = cards.filter(c => c.value === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function cardStr(cards: { suit: string; value: string }[]): string {
  return cards.map(c => `${c.value}${c.suit}`).join(' ');
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Play casino games to win coins!')
    .addSubcommand(sub => sub
      .setName('coinflip')
      .setDescription('Flip a coin - pick heads or tails')
      .addStringOption(o => o.setName('choice').setDescription('Heads or Tails').setRequired(true).addChoices(
        { name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }
      ))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('slots')
      .setDescription('Spin the slot machine!')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('roulette')
      .setDescription('Spin the roulette wheel')
      .addStringOption(o => o.setName('bet').setDescription('What to bet on').setRequired(true).addChoices(
        { name: 'Red', value: 'red' }, { name: 'Black', value: 'black' },
        { name: 'Green (0)', value: 'green' }, { name: 'Even', value: 'even' }, { name: 'Odd', value: 'odd' }
      ))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('blackjack')
      .setDescription('Play a hand of blackjack')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1))) as SlashCommandBuilder,

  category: 'Economy',

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guildId || !interaction.guild) return;

    const sub = interaction.options.getSubcommand(false);
    if (!sub) {
      await interaction.reply({ content: 'Use a subcommand: /gamble coinflip, /gamble slots, /gamble roulette, /gamble blackjack', ephemeral: true });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);

    if (sub === 'coinflip') {
      const choice = interaction.options.getString('choice', true);
      const result = await EconomyManager.gamble(interaction.member as any, amount);
      const coin = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === coin;

      const embed = new EmbedBuilder()
        .setColor(won ? 0x57F287 : 0xED4245)
        .setTitle(won ? 'You Won!' : 'You Lost!')
        .setDescription(`The coin landed on **${coin}**! You chose **${choice}**.\n${won ? `+${amount} coins` : `-${amount} coins`}`)
        .addFields({ name: 'Balance', value: `${result.newBalance} coins`, inline: true });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'slots') {
      const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
      const r1 = symbols[Math.floor(Math.random() * symbols.length)]!;
      const r2 = symbols[Math.floor(Math.random() * symbols.length)]!;
      const r3 = symbols[Math.floor(Math.random() * symbols.length)]!;

      let multiplier = 0;
      if (r1 === r2 && r2 === r3) multiplier = r1 === '💎' ? 10 : r1 === '7️⃣' ? 7 : 5;
      else if (r1 === r2 || r2 === r3 || r1 === r3) multiplier = 2;

      const won = multiplier > 0;
      const winnings = won ? amount * multiplier : 0;

      if (won) {
        const wallet = await getUserWallet(interaction.user.id, interaction.guildId);
        wallet.balance += winnings;
        await wallet.save();
      } else {
        await EconomyManager.gamble(interaction.member as any, amount);
      }

      const embed = new EmbedBuilder()
        .setColor(won ? 0x57F287 : 0xED4245)
        .setTitle(won ? `Won ${winnings} coins!` : 'Better luck next time!')
        .setDescription(`[ ${r1} | ${r2} | ${r3} ]\n${won ? `${multiplier}x multiplier!` : `Lost ${amount} coins`}`);

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'roulette') {
      const bet = interaction.options.getString('bet', true);
      const number = Math.floor(Math.random() * 37);
      const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
      const isBlack = number !== 0 && !isRed;
      const isEven = number !== 0 && number % 2 === 0;
      const isOdd = number !== 0 && number % 2 === 1;

      let won = false;
      let multiplier = 1;
      if (bet === 'red' && isRed) { won = true; multiplier = 2; }
      else if (bet === 'black' && isBlack) { won = true; multiplier = 2; }
      else if (bet === 'green' && number === 0) { won = true; multiplier = 14; }
      else if (bet === 'even' && isEven) { won = true; multiplier = 2; }
      else if (bet === 'odd' && isOdd) { won = true; multiplier = 2; }

      const color = number === 0 ? '🟢' : isRed ? '🔴' : '⚫';
      const winnings = won ? amount * multiplier : 0;

      if (won) {
        const wallet = await getUserWallet(interaction.user.id, interaction.guildId);
        wallet.balance += winnings;
        await wallet.save();
      } else {
        await EconomyManager.gamble(interaction.member as any, amount);
      }

      const embed = new EmbedBuilder()
        .setColor(won ? 0x57F287 : 0xED4245)
        .setTitle(`Roulette: ${color} ${number}`)
        .setDescription(won ? `Won **${winnings}** coins! (${multiplier}x)` : `Lost **${amount}** coins`)
        .addFields({ name: 'Your bet', value: `${bet} — ${amount} coins`, inline: true });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'blackjack') {
      const playerCards = [getCard(), getCard()];
      const dealerCards = [getCard(), getCard()];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Blackjack')
        .setDescription(
          `**Your hand:** ${cardStr(playerCards)} (Total: ${handTotal(playerCards)})\n` +
          `**Dealer:** ${dealerCards[0]!.value}${dealerCards[0]!.suit} | ??\n\n` +
          `Bet: **${amount}** coins\nHit or Stand?`
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`bj:hit:${amount}`).setLabel('Hit').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bj:stand:${amount}`).setLabel('Stand').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  },
};

export default command;
