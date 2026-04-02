import { ButtonInteraction, GuildMember, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { getUserWallet } from '../../database/models/Economy';

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

function parseCards(data: string): { suit: string; value: string; num: number }[] {
  try { return JSON.parse(data); } catch { return []; }
}

const handler: ButtonHandler = {
  customId: 'bj',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!interaction.message.embeds[0]?.description) return;

    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const betAmount = parseInt(parts[2]!) || 10;

    // Parse current cards from embed description
    const desc = interaction.message.embeds[0].description;
    const playerMatch = desc.match(/\*\*Your hand:\*\* (.+?) \(Total:/);
    const dealerMatch = desc.match(/\*\*Dealer:\*\* (.+?)(?:\n|$)/);

    if (!playerMatch || !dealerMatch) {
      await interaction.reply({ content: 'Game error. Try again.', ephemeral: true });
      return;
    }

    // Reconstruct cards from embed text
    const playerCards: { suit: string; value: string; num: number }[] = [];
    const dealerCards: { suit: string; value: string; num: number }[] = [];

    const cardRegex = /([A2-9JQK]|10)([♠♥♦♣♠️♥️♦️♣️])/g;
    let match;
    while ((match = cardRegex.exec(playerMatch[1]!)) !== null) {
      const v = match[1]!;
      const num = v === 'A' ? 11 : (isNaN(parseInt(v)) ? 10 : Math.min(parseInt(v), 10));
      playerCards.push({ suit: match[2]!, value: v, num });
    }

    const dealerText = dealerMatch[1]!;
    const dMatches = [...dealerText.matchAll(cardRegex)];
    for (const m of dMatches) {
      if (m[1] === '?' || m[2] === '?') continue;
      const v = m[1]!;
      const num = v === 'A' ? 11 : (isNaN(parseInt(v)) ? 10 : Math.min(parseInt(v), 10));
      dealerCards.push({ suit: m[2]!, value: v, num });
    }

    if (action === 'hit') {
      playerCards.push(getCard());
      const total = handTotal(playerCards);

      if (total > 21) {
        // Player busts
        const wallet = await getUserWallet(interaction.user.id, interaction.guild.id);
        wallet.balance = Math.max(0, wallet.balance - betAmount);
        await wallet.save();

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Blackjack - Bust!')
          .setDescription(
            `**Your hand:** ${cardStr(playerCards)} (Total: ${total})\n` +
            `**Dealer:** ${cardStr(dealerCards)} (${handTotal(dealerCards)})\n\n` +
            `You went bust! Lost **${betAmount}** coins`
          );
        await interaction.update({ embeds: [embed], components: [] });
      } else {
        // Continue
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Blackjack')
          .setDescription(
            `**Your hand:** ${cardStr(playerCards)} (Total: ${total})\n` +
            `**Dealer:** ${dealerCards[0]!.value}${dealerCards[0]!.suit} | ??\n\n` +
            `Bet: **${betAmount}** coins\nHit or Stand?`
          );
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`bj:hit:${betAmount}`).setLabel('Hit').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`bj:stand:${betAmount}`).setLabel('Stand').setStyle(ButtonStyle.Danger)
        );
        await interaction.update({ embeds: [embed], components: [row] });
      }

    } else if (action === 'stand') {
      // Dealer draws until 17
      while (handTotal(dealerCards) < 17) {
        dealerCards.push(getCard());
      }

      const playerTotal = handTotal(playerCards);
      const dealerTotal = handTotal(dealerCards);

      let result: string;
      let color: number;
      let won = false;

      if (dealerTotal > 21) {
        result = `Dealer busts! You won **${betAmount * 2}** coins!`;
        color = 0x57F287;
        won = true;
      } else if (playerTotal > dealerTotal) {
        result = `You won **${betAmount * 2}** coins!`;
        color = 0x57F287;
        won = true;
      } else if (playerTotal === dealerTotal) {
        result = `Push! It's a tie. Bet returned.`;
        color = 0xFEE75C;
      } else {
        result = `Dealer wins. You lost **${betAmount}** coins.`;
        color = 0xED4245;
      }

      const wallet = await getUserWallet(interaction.user.id, interaction.guild.id);
      if (won) {
        wallet.balance += betAmount;
      } else if (playerTotal !== dealerTotal) {
        wallet.balance = Math.max(0, wallet.balance - betAmount);
      }
      await wallet.save();

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Blackjack - Result')
        .setDescription(
          `**Your hand:** ${cardStr(playerCards)} (Total: ${playerTotal})\n` +
          `**Dealer:** ${cardStr(dealerCards)} (Total: ${dealerTotal})\n\n` +
          result
        )
        .addFields({ name: 'Balance', value: `${wallet.balance} coins`, inline: true });

      await interaction.update({ embeds: [embed], components: [] });
    }
  },
};

export default handler;
