import { NextResponse } from 'next/server';

export async function GET() {
  const now = Date.now();
  const events = [
    {
      id: 'cal-001', source: 'microsoft',
      subject: 'Hartmann Group — Block Booking Follow-up',
      bodyPreview: 'Confirm final room allocation for 12-room block (March 15-18)',
      start: new Date(now + 2 * 86_400_000).toISOString(),
      end: new Date(now + 2 * 86_400_000 + 3_600_000).toISOString(),
      location: 'Reservations Office', isAllDay: false,
      attendees: [{ name: 'Hartmann Group Travel', email: 'corporate.travel@hartmann-group.de' }],
      categories: ['Reservations'], importance: 'high', organizer: 'Demo User',
    },
    {
      id: 'cal-002', source: 'microsoft',
      subject: 'Grand Ballroom Site Visit — Metropolitan Arts Gala',
      bodyPreview: 'Walk-through for April 5 Gala Dinner setup (200 covers)',
      start: new Date(now + 5 * 86_400_000).toISOString(),
      end: new Date(now + 5 * 86_400_000 + 5_400_000).toISOString(),
      location: 'Grand Ballroom', isAllDay: false,
      attendees: [{ name: 'Metropolitan Arts Foundation', email: 'events@metropolitan-arts.org' }],
      categories: ['Events'], importance: 'high', organizer: 'Demo User',
    },
    {
      id: 'cal-003', source: 'microsoft',
      subject: 'VIP Check-in — Sterling Investments Director',
      bodyPreview: '4-night stay preparation for Director Suite',
      start: new Date(now + 7 * 86_400_000).toISOString(),
      end: new Date(now + 7 * 86_400_000 + 1_800_000).toISOString(),
      location: 'Reception — Director Suite 701', isAllDay: false,
      attendees: [], categories: ['Concierge'], importance: 'high', organizer: 'Demo User',
    },
    {
      id: 'cal-004', source: 'microsoft',
      subject: 'Monthly Housekeeping Review — CleanPro Services',
      bodyPreview: 'Monthly service review and contract renewal discussion',
      start: new Date(now + 10 * 86_400_000).toISOString(),
      end: new Date(now + 10 * 86_400_000 + 3_600_000).toISOString(),
      location: 'Conference Room B', isAllDay: false,
      attendees: [{ name: 'CleanPro Services', email: 'housekeeping@cleanpro.com' }],
      categories: ['Operations'], importance: 'normal', organizer: 'Demo User',
    },
  ];
  return NextResponse.json({ events, count: events.length });
}
