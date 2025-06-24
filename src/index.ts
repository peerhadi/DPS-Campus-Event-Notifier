import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import boxen from 'boxen';
import enquirer from 'enquirer';
import Table from 'cli-table3';
import stringWidth from 'string-width';

import { login } from './auth';
import { getUnreadMessageLinks, fetchMessage } from './fetchMessages';
import { extractEventFromMessage } from './aiExtractor';
import { generateCalendar } from './calendar';
import { sendCalendarEmail } from './emailSender';
import prompts from 'prompts';
const { Input, Password } = require('enquirer');

function centerText(text: string): string {
  const width = process.stdout.columns || 80;
  return text
    .split('\n')
    .map(line => {
      const lineWidth = stringWidth(line);
      const padding = Math.max(0, Math.floor((width - lineWidth) / 2));
      return ' '.repeat(padding) + line;
    })
    .join('\n');
}

async function main() {


  console.clear();
  console.log(chalk.yellow(centerText(figlet.textSync('DPS CLI'))));
  console.log(centerText(chalk.yellow('\n===== DPS Campus Notification Fetcher =====\n')));


  const username = await new Input({
    name: 'username',
    message: chalk.yellow(' Username:'),
    format(value: string) {
      return chalk.yellow(value)
    }
  }).run();

  const password = await new Password({
    name: 'password',
    message: chalk.yellow(' Password:'),
    format(value: string) {
      return chalk.yellow(Array.from({ length: value.length }).fill('*').join(""))
    },
    mask: '*',
  }).run();
  const loginSpinner = ora(centerText('🔐 Logging in...')).start();
  try {
    await login(username, password);
    loginSpinner.succeed(centerText('✅ Logged in successfully!'));
  } catch {
    loginSpinner.fail(centerText('❌ Login failed. Check credentials.'));
    process.exit(1);
  }

  const fetchSpinner = ora(centerText('📥 Fetching unread messages...')).start();
  const links = await getUnreadMessageLinks();
  const messages = await Promise.all(links.map(fetchMessage));
  fetchSpinner.succeed(centerText(`📨 ${messages.length} messages fetched.`));

  if (messages.length === 0) {
    console.log(centerText(chalk.yellow('\n📭 No unread messages 🎉\n')));
    return;
  }

  const events = (await Promise.all(messages.map(extractEventFromMessage))).filter(e => e !== null) as any[];
  if (events.length === 0) {
    console.log(centerText(chalk.yellow('\n🕵️‍♂️ No calendar-worthy events found.\n')));
    return;
  }

  const calendar = await generateCalendar(events);

  const table = new Table({
    head: [chalk.blue('Date'), chalk.blue('Title')],
    colWidths: [20, 60],
  });

  for (const event of events) {
    const [y, m, d] = event.start;
    table.push([`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, event.title]);
  }

  console.log(centerText('\n🗓️  Events Extracted:\n'));
  console.log(centerText(table.toString()));

  const { selectedEmails } = await enquirer.prompt([
    {
      type: 'select',
      multiple: true,
      name: 'selectedEmails',
      message: chalk.yellow('📧 Select email(s) to send calendar to:'),
      choices: [
        'peerhadi49@gmail.com',
        'shazya.manzoor@gmail.com',
        'tawushafeez@gmail.com',
        'zayaantaha@icloud.com',
        'maizahtaha2012@gmail.com',
      ].map(email => ({ name: email })),
      validate: input => input.length ? true : '⚠️ Select at least one email.',
    },
  ]) as { selectedEmails: string[] };

  console.log(centerText(chalk.bold('\n📧 Sending Calendar(s)...\n')));

  for (const email of selectedEmails) {
    await sendCalendarEmail(email, calendar);
    console.log(centerText(chalk.green(`✅ Sent to ${email}`)));
  }

  console.log(centerText(boxen('🎉  All done! Enjoy your calendar 😎', {
    padding: 1,
    borderStyle: 'double',
    borderColor: 'cyan',
    align: 'center',
  })));
}

main()
