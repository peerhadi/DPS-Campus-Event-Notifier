import { createEvents, EventAttributes } from 'ics';

export function generateCalendar(events: EventAttributes[]): Promise<string> {
  return new Promise((resolve, reject) => {
    createEvents(events, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
}
