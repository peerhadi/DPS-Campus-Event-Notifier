import * as cheerio from 'cheerio';

export function formatHtmlContent(html: string): string {
  const $ = cheerio.load(html);
  $('script, style').remove();
  $('br').replaceWith('\n');
  $('p').each((_, el) => {
    $(el).replaceWith(`\n${$(el).text().trim()}\n`);
  });

  $('li').each((_, el) => {
    $(el).replaceWith(`• ${$(el).text().trim()}\n`);
  });

  $('b, strong').each((_, el) => {
    $(el).replaceWith(`**${$(el).text().trim()}**`);
  });

  $('i, em').each((_, el) => {
    $(el).replaceWith(`*${$(el).text().trim()}*`);
  });
  return $.root().text().replace(/\n{2,}/g, '\n\n').trim();
}
