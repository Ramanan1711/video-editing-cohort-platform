import { useState } from 'react';
import {
  Check,
  ExternalLink,
  MessageCircle,
  Phone,
  QrCode,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DEFAULT_ACADEMY_WHATSAPP,
  generateWhatsAppClickToChatUrl,
  normalizeWhatsAppPhone,
  sendWhatsAppNotification,
  type WhatsAppEventType,
} from '../../lib/whatsappService';
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
  mentorPhone = DEFAULT_ACADEMY_WHATSAPP,
}: WhatsAppSupportWidgetProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'qr'>('chat');
  const [selectedTemplate, setSelectedTemplate] = useState<'challenge' | 'blocker' | 'sync'>('challenge');
  const [studentPhone, setStudentPhone] = useState(initialPhone);
  const [customMsg, setCustomMsg] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const handleSavePhone = async () => {
    if (!studentPhone.trim()) return;
    try {
      setIsSavingPhone(true);
      const clean = normalizeWhatsAppPhone(studentPhone);
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

  const handleLaunchWhatsApp = (text: string, eventType: WhatsAppEventType = 'custom') => {
    const targetPhone = mentorPhone || DEFAULT_ACADEMY_WHATSAPP;
    const url = generateWhatsAppClickToChatUrl(targetPhone, text);

    // 1. Open immediately on user gesture to guarantee zero popup-blocker issues
    window.open(url, '_blank', 'noopener,noreferrer');

    // 2. Log in background asynchronously without blocking the UI
    sendWhatsAppNotification(userId, targetPhone, eventType, text).catch((err) => {
      console.warn('Background WhatsApp telemetry log failed:', err);
    });
  };

  const defaultChallengeMsg = `Hi Mentor! I am ${studentName} from ${cohortName}. I am working on Day ${currentDay} and have a quick question.`;
  const blockerMsg = `Hi Mentor! I ran into a blocker in my production task for Day ${currentDay} and need some guidance.`;
  const syncMsg = `Hi Mentor! Could we do a quick 10-minute 1-on-1 doubt clearing call on Google Meet regarding Day ${currentDay}?`;

  const getActiveQrMessage = () => {
    if (selectedTemplate === 'blocker') return blockerMsg;
    if (selectedTemplate === 'sync') return syncMsg;
    return defaultChallengeMsg;
  };

  const targetPhone = mentorPhone || DEFAULT_ACADEMY_WHATSAPP;
  const qrMessageText = customMsg.trim()
    ? `Hi Mentor (${cohortName}): ${customMsg.trim()}`
    : getActiveQrMessage();

  const qrChatUrl = generateWhatsAppClickToChatUrl(targetPhone, qrMessageText);
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrChatUrl)}`;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
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
        <div className="w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
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
                    +{normalizeWhatsAppPhone(mentorPhone)} • Typically replies in 15–30 mins
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

          {/* Mode Selector Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Direct WhatsApp Chat"
            >
              <MessageCircle size={14} className={activeTab === 'chat' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
              <span>Direct Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'qr'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Scan QR to Chat on Mobile"
            >
              <QrCode size={14} className={activeTab === 'qr' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
              <span>Scan QR to Chat on Mobile</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {activeTab === 'chat' ? (
              <>
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
              </>
            ) : (
              /* QR Code Mode */
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 p-3 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="flex items-start gap-2.5">
                    <Smartphone size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Scan QR to Chat on Mobile
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                        Point your phone camera or WhatsApp scanner here to start chatting instantly without logging into WhatsApp Web!
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Display */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/80 inline-flex items-center justify-center">
                    <img
                      src={qrCodeImageUrl}
                      alt="Scan QR to Chat on Mobile"
                      width={160}
                      height={160}
                      className="size-40 rounded-lg block"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Point phone camera to chat in 2 seconds</span>
                  </div>
                </div>

                {/* Template Selector for QR */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Select Context for QR Message
                  </p>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate('challenge')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition text-center truncate ${
                        selectedTemplate === 'challenge'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Day {currentDay} Task
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate('blocker')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition text-center truncate ${
                        selectedTemplate === 'blocker'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Blocker
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate('sync')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition text-center truncate ${
                        selectedTemplate === 'sync'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      1:1 Sync
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-2.5 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 italic">
                    "{qrMessageText}"
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchWhatsApp(qrMessageText, 'custom')}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    <span>Or launch WhatsApp on this device</span>
                  </button>
                </div>
              </div>
            )}

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
                  placeholder="+91 90809 95108"
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
