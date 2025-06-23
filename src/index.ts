
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';
import { createEvents, EventAttributes } from 'ics';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import inquirer from 'inquirer';
dotenv.config();

const BASE_URL = 'https://campus.dpssrinagar.com';
const GMAIL_USER = 'peerhadi49@gmail.com';
const GMAIL_PASS = 'fyhf zwkr jils hfat';

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Referer': `${BASE_URL}/`,
    'Origin': BASE_URL,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
}));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

type Message = {
  subject: string;
  from: string;
  date: string;
  content: string;
  link: string;
};

function formatHtmlContent(html: string): string {
  const $ = cheerio.load(html);
  $('script, style').remove();
  $('br').replaceWith('\n');
  $('p').each((_, el) => { $(el).replaceWith(`\n${$(el).text().trim()}\n`); });
  $('li').each((_, el) => { $(el).replaceWith(`• ${$(el).text().trim()}\n`); });
  $('b, strong').each((_, el) => { $(el).replaceWith(`**${$(el).text().trim()}**`); });
  $('i, em').each((_, el) => { $(el).replaceWith(`*${$(el).text().trim()}*`); });
  return $.root().text().replace(/\n{2,}/g, '\n\n').trim();
}

function buildGeminiPrompt(message: Message): string {
  return `
You are an intelligent assistant that reads parent-school messages and extracts calendar event information. Think logically, should there be a reminder for this, if not, just return none.

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
  `.trim();
}

async function sendCalendarByEmail(toEmail: string, calendarData: string) {
  const mailOptions = {
    from: `"DPS Campus Notifications Sender" ${GMAIL_USER}`,
    to: toEmail,
    subject: '🗓️ DPS Campus Calendar Events',
    text: 'Attached is your personal school events calendar.',
    attachments: [
      {
        filename: 'dps-calendar.ics',
        content: calendarData,
        contentType: 'text/calendar',
      },
    ],
  };
  const info = await transporter.sendMail(mailOptions);
  console.log(`📬 Email sent: ${info.response}`);
}

async function login(username: string, password: string) {
  await client.post(`${BASE_URL}/user/login`, new URLSearchParams({ username, password }));
  console.log('✅ Logged in');
}

async function getUnreadMessageLinks(): Promise<string[]> {
  let offset = 0;
  const links: string[] = [];
  while (true) {
    const url = offset === 0 ? `${BASE_URL}/message` : `${BASE_URL}/message/index/${offset}`;
    const res = await client.get(url);
    const $ = cheerio.load(res.data);
    const unreadRows = $('table tbody tr.unread');
    if (unreadRows.length === 0) break;
    unreadRows.each((_, el) => {
      const href = $(el).attr('data-href');
      if (href) links.push(href);
    });
    offset += 25;
  }
  return links.reverse();
}

async function fetchMessage(link: string): Promise<Message> {
  const res = await client.get(link);
  const $ = cheerio.load(res.data);
  const subject = $('.clearfix h3').first().text().trim();
  const from = $('table tbody tr:first-child td:first-child .lh-14').first().text().trim();
  const date = $('.panel-body .message-single .message-meta .clearfix .pull-right').first().text().trim();
  const rawHtml = $('.message-content').html() || '';
  const content = formatHtmlContent(rawHtml);
  return { subject, from, date, content, link };
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCJM7haCDjYDueDFO1ng-GRj6SrWWJc9iA');

async function extractEventsWithGemini(messages: Message[]): Promise<EventAttributes[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const events: EventAttributes[] = [];

  for (const msg of messages) {
    const prompt = buildGeminiPrompt(msg);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const titleMatch = text.match(/Title:\s*(.+)/i);
    const dateMatch = text.match(/Date:\s*(\d{4})-(\d{2})-(\d{2})/i);
    const descriptionMatch = text.match(/Description:\s*([\s\S]+)/i);

    if (!dateMatch) continue;

    const [, year, month, day] = dateMatch.map(Number);
    const title = titleMatch?.[1].trim() || msg.subject || 'School Event';
    const description = descriptionMatch?.[1].trim() || msg.content;
    const eventDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (eventDate < today) {
      console.log(`⏳ Skipping past event on ${eventDate.toDateString()}`);
      continue;
    }

    events.push({
      title,
      description,
      start: [year, month, day, 8, 0],
      duration: { hours: 1 },
    });
  }

  return events;
}

async function generateCalendarString(messages: Message[]): Promise<string | null> {
  const events = await extractEventsWithGemini(messages);
  if (events.length === 0) return null;
  return new Promise((resolve, reject) => {
    createEvents(events, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
}

async function main() {
  console.log('\n🎓 DPS Campus CLI — Personalized School Calendar Generator\n');

  const { username, password } = await inquirer.prompt([
    { type: 'input', name: 'username', message: '👤 Username:' },
    { type: 'password', name: 'password', message: '🔒 Password:', mask: '*' },
  ]);

  await login(username, password);

  console.log('\n📥 Fetching unread messages...');
  const links = await getUnreadMessageLinks();
  const messages = await Promise.all(links.map(fetchMessage));

  if (messages.length === 0) {
    console.log('\n📭 No unread messages 🎉');
    return;
  }

  const calendarData = await generateCalendarString(messages);
  if (!calendarData) {
    console.log('\n🕵️‍♂️ No calendar-worthy events found.');
    return;
  }

  const { selectedEmails } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedEmails',
      message: '📧 Select email(s) to send calendar to:',
      choices: [
        'peerhadi49@gmail.com',
        'shazya.manzoor@gmail.com',
        'maizahtaha2012@gmail.com',
        'tawushafeez@gmail.com',
        'zayaantaha@icloud.com',
      ],
      validate: input => input.length ? true : 'Select at least one email.',
    },
  ]);

  for (const email of selectedEmails) {
    await sendCalendarByEmail(email, calendarData);
  }

  console.log('\n✅ All done! Enjoy your calendar 😎\n');
}

main();
