import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { soundFx } from '../../lib/soundFx';

export interface FAQItem {
  q: string;
  a: string;
}

const defaultFaqs: FAQItem[] = [
  {
    q: 'How does the 15-Day Internship model work?',
    a: 'Each morning at 9:00 AM, a production-level challenge unlocks with a detailed brief and starter assets. You work on the task, submit your deliverable link (GitHub PR, Loom walkthrough, or Google Drive cut) before midnight, and receive structured feedback and grading from assigned mentors within 24 hours.',
  },
  {
    q: 'Do I need prior experience in coding or video editing?',
    a: 'We welcome motivated beginners and intermediate creators. Both the Coding and Creative tracks start with solid foundations on Day 1 and ramp up to production-grade portfolio deliverables by Day 15.',
  },
  {
    q: 'How is WhatsApp integrated into the learning experience?',
    a: 'ProCut Hub connects directly to your WhatsApp. You receive daily challenge drops, workshop reminders, and personalized inactivity alerts. Plus, you can click one button to open a direct WhatsApp chat with your mentor for real-time blocker resolution with an average daytime response SLA under 15 minutes.',
  },
  {
    q: 'How much time do I need to commit each day?',
    a: 'Plan for approximately 1.5 to 2.5 focused hours each day. The tasks are engineered to simulate real studio and software development deadlines without exhausting your schedule.',
  },
  {
    q: 'What certificate and credentials do I graduate with?',
    a: 'Upon successfully completing all 15 sprint tasks and passing mentor review, you receive a cryptographically verified Digital Internship Certificate and a personalized Mentor Letter of Recommendation to showcase on LinkedIn and your resume.',
  },
  {
    q: 'Can I access the live workshops if I miss a stream?',
    a: 'Yes! All live workshops and critique masterclasses are recorded in full high-definition and uploaded directly to your cohort workshops portal within 2 hours of the broadcast.',
  },
  {
    q: 'What if I face an emergency or fall behind on a day?',
    a: 'Our platform includes a built-in "Streak Freeze" grace pass. If you let your WhatsApp mentor know ahead of time, you can catch up during the designated Day 5 or Day 10 review buffer windows without failing the cohort requirements.',
  },
  {
    q: 'Are the starter assets and code templates included in the fee?',
    a: 'Yes! You receive instant access to licensed 4K RAW cinema footage, 2,500+ sound effects, and production-ready Next.js / Supabase GitHub boilerplates with lifetime usage rights.',
  },
];

export interface LandingFAQAccordionProps {
  faqs?: FAQItem[];
}

export function LandingFAQAccordion({ faqs = defaultFaqs }: LandingFAQAccordionProps) {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-3xl px-5 lg:px-8 relative z-10">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
            Frequently Answered
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Everything You Need to Know
          </h2>
        </div>

        <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
          {faqs.map((faq, index) => (
            <div key={faq.q} className="py-5">
              <button
                data-cursor="EXPAND FAQ"
                onClick={() => {
                  const next = faqOpen === index ? null : index;
                  setFaqOpen(next);
                  if (next !== null) soundFx.playBlip(440, 0.03, 'triangle', 0.03);
                }}
                className="flex w-full items-center justify-between gap-5 text-left text-sm font-black text-white hover:text-orange-400 transition"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`shrink-0 transition-transform ${
                    faqOpen === index ? 'rotate-180 text-orange-400' : 'text-slate-400'
                  }`}
                  size={18}
                />
              </button>
              {faqOpen === index && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
