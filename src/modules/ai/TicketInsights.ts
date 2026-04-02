import { config } from '../../config';
import { logger } from '../../utils/logger';

export type TicketInsightResult = {
  summary: string;
  classification: string;
  staffHint: string;
};

const FALLBACK: TicketInsightResult = {
  summary: 'Imposta OPENAI_API_KEY nel file .env per abilitare riassunto e classificazione AI.',
  classification: 'non_disponibile',
  staffHint: 'Aggiungi la chiave API OpenAI nella dashboard server (file .env) per suggerimenti automatici.',
};

export class TicketInsights {
  static async analyzeTranscript(lines: { authorTag: string; content: string }[]): Promise<TicketInsightResult> {
    if (!config.openaiKey) {
      return FALLBACK;
    }

    const transcript = lines
      .slice(-80)
      .map((l) => `${l.authorTag}: ${l.content}`)
      .join('\n')
      .slice(0, 12000);

    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: config.openaiKey });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Sei un assistente per staff di supporto Discord. Rispondi SOLO con JSON valido, senza markdown, con chiavi: ' +
              '"classification" (una tra: domanda | richiesta | spam | incerto), ' +
              '"summary" (2-4 frasi in italiano, utile per transcript), ' +
              '"staffHint" (una frase: cosa sembra volere l\'utente o problema probabile).',
          },
          {
            role: 'user',
            content: `Messaggi ticket:\n${transcript || '(vuoto)'}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(raw) as Partial<TicketInsightResult>;
      return {
        summary: String(parsed.summary ?? '').slice(0, 1500) || FALLBACK.summary,
        classification: String(parsed.classification ?? 'incerto').slice(0, 64),
        staffHint: String(parsed.staffHint ?? '').slice(0, 500) || FALLBACK.staffHint,
      };
    } catch (e) {
      logger.warn('TicketInsights.analyzeTranscript failed', e instanceof Error ? e : new Error(String(e)));
      return {
        summary: 'Analisi AI non disponibile (errore API).',
        classification: 'errore',
        staffHint: 'Riprova più tardi o verifica la chiave OpenAI e i limiti di rate.',
      };
    }
  }
}
