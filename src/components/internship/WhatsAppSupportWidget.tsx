import { useState } from 'react';
import {
  Check,
  ExternalLink,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { generateWhatsAppClickToChatUrl, sendWhatsAppNotification } from '../../lib/whatsappService';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/useToast';

interface WhatsAppSupportWidgetProps {
  userId: string;
  studentName: string;
  cohortName?: string;
  currentDay?: number;
  initialPhone?: string;
  mentorPhone?: string;
}

export function WhatsAppSupportWidget({
  userId,
  studentName,
  cohortName = '15-Day Internship',
  currentDay = 1,
  initialPhone = '',
  mentorPhone = '919876543210',
}: WhatsAppSupportWidgetProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [studentPhone, setStudentPhone] = useState(initialPhone);
  const [customMsg, setCustomMsg] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const handleSavePhone = async () => {
    if (!studentPhone.trim()) return;
    try {
      setIsSavingPhone(true);
      const clean = studentPhone.replace(/[^0-9]/g, '');
      const { error } = await supabase
        .from('profiles')
        .update({
          whatsapp_number: clean,
          whatsapp_opt_in: true,
        })
        .eq('id', userId);

      if (error) {
        console.warn('Could not update profile phone:', error.message);
      }
      setPhoneSaved(true);
      toast.success('WhatsApp number saved for daily challenge drops & alerts!');
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch {
      toast.error('Failed to update WhatsApp preferences');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleLaunchWhatsApp = async (text: string, eventType: 'custom' | 'daily_challenge' | 'welcome' = 'custom') => {
    // Record log
    try {
      await sendWhatsAppNotification(userId, mentorPhone, eventType, text);
    } catch (e) {
      console.warn('WhatsApp log dispatch fallback:', e);
    }
    const url = generateWhatsAppClickToChatUrl(mentorPhone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const defaultChallengeMsg = `Hi Mentor! I am ${studentName} from ${cohortName}. I am working on Day ${currentDay} and have a quick question.`;
  const blockerMsg = `Hi Mentor! I ran into a blocker in my production task for Day ${currentDay} and need some guidance.`;
  const syncMsg = `Hi Mentor! Could we do a quick 10-minute 1-on-1 doubt clearing call on Google Meet regarding Day ${currentDay}?`;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:bg-[#20ba59] transition-all duration-300 hover:scale-105 focus:outline-none"
          title="Chat with Mentor on WhatsApp"
        >
          <MessageCircle size={28} className="fill-current text-white" />
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
            1
          </span>
          <span className="sr-only">Open WhatsApp Mentor Support</span>
        </button>
      )}

      {/* Floating Popup Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white font-bold text-sm">
                    💬
                  </div>
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight leading-none text-white">
                    Mentor WhatsApp Direct
                  </h3>
                  <p className="text-[11px] text-emerald-100 mt-1">
                    Typically replies in 15–30 mins
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Context Notice */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Need real-time code reviews, video cut critique, or quick feedback? Send a WhatsApp message straight to your assigned mentor.
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Quick Messages (1-Click)
              </p>

              <button
                type="button"
                onClick={() => handleLaunchWhatsApp(defaultChallengeMsg, 'daily_challenge')}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    Ask about Day {currentDay} Challenge
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    "{defaultChallengeMsg}"
                  </p>
                </div>
                <ExternalLink size={13} className="text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => handleLaunchWhatsApp(blockerMsg, 'custom')}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    Report a Technical Blocker
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    "I ran into a blocker in my production task..."
                  </p>
                </div>
                <ExternalLink size={13} className="text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => handleLaunchWhatsApp(syncMsg, 'custom')}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    Request 1:1 Doubt Clearing
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    "Could we do a quick 10-minute sync..."
                  </p>
                </div>
                <ExternalLink size={13} className="text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
              </button>
            </div>

            {/* Custom Message Field */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Or type custom query:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your question..."
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#25D366]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customMsg.trim()) {
                      handleLaunchWhatsApp(
                        `Hi Mentor (${cohortName}): ${customMsg.trim()}`,
                        'custom'
                      );
                      setCustomMsg('');
                    }
                  }}
                  disabled={!customMsg.trim()}
                  className="rounded-xl bg-[#25D366] px-3 text-white disabled:opacity-50 hover:bg-[#20ba59]"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* Student's WhatsApp Phone Number Sync */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Phone size={10} />
                  Receive Daily Tasks via WhatsApp
                </label>
                {phoneSaved && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSavePhone}
                  disabled={isSavingPhone || !studentPhone.trim()}
                  className="rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-3 py-1.5 text-xs font-bold disabled:opacity-50 hover:opacity-90"
                >
                  {isSavingPhone ? '...' : 'Save'}
                </button>
              </div>
              <p className="text-[9px] text-slate-400">
                We send daily 9:00 AM challenge drops and inactivity notifications.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
