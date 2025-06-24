
import nodemailer from 'nodemailer';
import { MAIL, PASSWORD } from './config';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: MAIL, pass: PASSWORD },
});

export async function sendCalendarEmail(to: string, calendar: string) {
  await transporter.sendMail({
    from: `"DPS CLI" <${MAIL}>`,
    to,
    subject: '📅 DPS Events Calendar',
    text: 'Attached is your personal school events calendar.',
    attachments: [
      { filename: 'events.ics', content: calendar, contentType: 'text/calendar' },
    ],
  });
}
