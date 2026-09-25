import { describe, it, expect } from 'vitest';
import {
  formatWhatsAppChallengeMessage,
  formatWhatsAppWorkshopAlert,
  formatWhatsAppInactivityNudge,
  formatWhatsAppFeedbackAlert,
  generateWhatsAppClickToChatUrl,
} from '../../lib/whatsappService';
import { DEFAULT_15_DAY_CURRICULUM } from '../../lib/internshipService';

describe('15-Day Internship Platform & WhatsApp Suite', () => {
  it('has 15 curated daily challenges in the default curriculum', () => {
    expect(DEFAULT_15_DAY_CURRICULUM).toHaveLength(15);
    expect(DEFAULT_15_DAY_CURRICULUM[0].day_number).toBe(1);
    expect(DEFAULT_15_DAY_CURRICULUM[14].day_number).toBe(15);

    // Verify all days 1 to 15 exist in order
    for (let day = 1; day <= 15; day++) {
      const ch = DEFAULT_15_DAY_CURRICULUM.find((c) => c.day_number === day);
      expect(ch).toBeDefined();
      expect(ch?.title).toContain(`Day ${day.toString().padStart(2, '0')}`);
      expect(ch?.deadline_hours).toBeGreaterThanOrEqual(24);
    }
  });

  it('generates direct WhatsApp click-to-chat URLs with sanitized numbers and encoded parameters', () => {
    const phone = '+91 98765-43210';
    const text = 'Hello Mentor! I need help with Day 03 challenge.';
    const url = generateWhatsAppClickToChatUrl(phone, text);

    expect(url).toContain('https://wa.me/919876543210?text=');
    expect(url).toContain(encodeURIComponent(text));
  });

  it('formats daily challenge notification messages with emojis, title, deadline, and links', () => {
    const msg = formatWhatsAppChallengeMessage(
      'Alex',
      3,
      'Dynamic Typography & Kinetic Titles',
      'general',
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain('ProCut Hub 15-Day Internship — Day 3 Challenge Drop');
    expect(msg).toContain('Hey Alex!');
    expect(msg).toContain('Dynamic Typography & Kinetic Titles');
    expect(msg).toContain('https://procut.app/student/dashboard?tab=internship_sprint');
  });

  it('formats workshop alert messages with start time and video link', () => {
    const msg = formatWhatsAppWorkshopAlert(
      'Jordan',
      'Live Masterclass: Color Grading & Finishing',
      '7:00 PM IST',
      'https://meet.google.com/xyz-abc-123'
    );

    expect(msg).toContain('Live Masterclass Alert');
    expect(msg).toContain('Jordan');
    expect(msg).toContain('Color Grading & Finishing');
    expect(msg).toContain('7:00 PM IST');
    expect(msg).toContain('https://meet.google.com/xyz-abc-123');
  });

  it('formats inactivity nudges with sprint context to protect completion streaks', () => {
    const msg = formatWhatsAppInactivityNudge(
      'Sam',
      4,
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain("Don't lose your streak, Sam!");
    expect(msg).toContain('Day 4');
    expect(msg).toContain('Certificate of Completion');
  });

  it('formats mentor feedback review notifications with status badge and score', () => {
    const msg = formatWhatsAppFeedbackAlert(
      'Ria',
      'Day 05 Multi-Track Sound Design',
      'accepted',
      94,
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain('Mentor Review: ACCEPTED');
    expect(msg).toContain('*Score:* 94/100');
    expect(msg).toContain('Day 05 Multi-Track Sound Design');
  });
});
