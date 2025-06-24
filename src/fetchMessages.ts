import * as cheerio from 'cheerio';
import { DPS_URL } from './config';
import { client } from './client';
import { formatHtmlContent } from './formatMessage';

export type Message = {
  subject: string;
  from: string;
  date: string;
  content: string;
  link: string;
};

export async function getUnreadMessageLinks(): Promise<string[]> {
  const links: string[] = [];
  let offset = 0;

  while (true) {
    const url = offset === 0 ? `${DPS_URL}/message` : `${DPS_URL}/message/index/${offset}`;
    const res = await client.get(url);
    const $ = cheerio.load(res.data);
    const unread = $('table tbody tr.unread');

    if (unread.length === 0) break;

    unread.each((_, row) => {
      const href = $(row).attr('data-href');
      if (href) links.push(href);
    });

    offset += 25;
  }

  return links.reverse();
}

export async function fetchMessage(link: string): Promise<Message> {
  const res = await client.get(link);
  const $ = cheerio.load(res.data);

  return {
    subject: $('.clearfix h3').first().text().trim(),
    from: $('table tbody tr:first-child td:first-child .lh-14').text().trim(),
    date: $('.panel-body .message-single .message-meta .pull-right').first().text().trim(),
    content: formatHtmlContent($('.message-content').html() || ''),
    link,
  };
}
