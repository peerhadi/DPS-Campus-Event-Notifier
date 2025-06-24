import axios from 'axios';
import { Message } from './fetchMessages';
import { OPENROUTER_API_KEY } from './config';
import { EventAttributes } from 'ics';

function buildPrompt(message: Message): string {
  return `
You are an intelligent assistant that reads parent-school messages and extracts calendar event information. Look, whenever there is the word previous, DO NOT think of it as the text you've read before, it's not that, it's the text after that, and also stop wherever you see Regards, and do not start from the end of the message, from the start.

Analyze the message and extract:

1. A **short, meaningful title** (avoid generic words like "Inbox", "Message").
2. The **event date** in **YYYY-MM-DD** format.
3. A **short description** (2–3 sentence summary).

Format your response like this:

Title: <title>
Date: <YYYY-MM-DD>
Description: <description>

Message:
${message.content}
  .trim();`
}

export async function extractEventFromMessage(msg: Message): Promise<EventAttributes | null> {
  const prompt = buildPrompt(msg)
  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const text = res.data.choices[0].message.content;

  const titleMatch = text.match(/Title:\s*(.+)/i);
  const dateMatch = text.match(/Date:\s*(\d{4})-(\d{2})-(\d{2})/i);
  const descriptionMatch = text.match(/Description:\s*([\s\S]+)/i);

  if (!dateMatch) return null;

  const [, y, m, d] = dateMatch.map(Number);
  const eventDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (eventDate < today) return null;

  return {
    title: titleMatch?.[1] || msg.subject,
    description: descriptionMatch?.[1] || '',
    start: [y, m, d, 8, 0],
    duration: { hours: 1 },
  };
}
