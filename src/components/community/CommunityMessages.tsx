import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Smile,
  Paperclip,
  Search,
  Lock,
  MessageCircle,
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  listChannelMessages,
  sendChatMessage,
  subscribeToChatChannel,
  DEFAULT_CHANNELS,
  DEFAULT_DIRECT_MESSAGES,
  type ChatMessage,
} from '../../lib/communityMessageService';

interface CommunityMessagesProps {
  initialChannelId?: string;
}

export const CommunityMessages: React.FC<CommunityMessagesProps> = ({
  initialChannelId = 'batch-15-community',
}) => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [currentChannelId, setCurrentChannelId] = useState(initialChannelId);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load active channel info
  const activeChannel = DEFAULT_CHANNELS.find((c) => c.id === currentChannelId);
  const activeDm = DEFAULT_DIRECT_MESSAGES.find((d) => d.id === currentChannelId);

  const title = activeChannel ? activeChannel.name : activeDm ? activeDm.name : 'Chat';
  const subtitle = activeChannel
    ? activeChannel.description
    : activeDm
    ? `${activeDm.role.toUpperCase()} · ${activeDm.online ? 'Online now' : 'Offline'}`
    : '';

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  useEffect(() => {
    let active = true;
    listChannelMessages(currentChannelId).then((data) => {
      if (active) {
        setMessages(data);
        scrollToBottom();
      }
    });

    const unsubscribe = subscribeToChatChannel(currentChannelId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      scrollToBottom();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentChannelId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    const sender = {
      id: user?.id || 'current-user',
      name: profile?.full_name || 'You',
      role: (profile?.role || 'student') as 'student' | 'mentor' | 'admin' | 'creator',
    };

    try {
      const sent = await sendChatMessage(currentChannelId, sender, draft);
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      scrollToBottom();
    } finally {
      setSending(false);
    }
  };

  const filteredChannels = DEFAULT_CHANNELS.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDms = DEFAULT_DIRECT_MESSAGES.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-1 h-[calc(100vh-73px)] overflow-hidden bg-white dark:bg-slate-950">
      {/* Left Chat Sidebar (Channels & Direct Messages) */}
      <div className="w-80 border-r border-slate-200/80 flex flex-col dark:border-slate-800 dark:bg-slate-900/50">
        {/* Search Bar */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or channels..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Sub Tabs: Channels vs DMs */}
          <div className="mt-3 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setActiveTab('channels')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                activeTab === 'channels'
                  ? 'bg-white text-slate-950 shadow-2xs font-black dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => setActiveTab('dms')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                activeTab === 'dms'
                  ? 'bg-white text-slate-950 shadow-2xs font-black dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              Direct Messages
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeTab === 'channels' ? (
            filteredChannels.map((channel) => {
              const isSelected = currentChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => setCurrentChannelId(channel.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-orange-50/80 text-orange-950 font-black dark:bg-orange-950/40 dark:text-orange-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base shrink-0">{channel.icon || '💬'}</span>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{channel.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{channel.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {channel.is_locked && <Lock size={12} className="text-slate-400" />}
                    {Boolean(channel.unread_count && channel.unread_count > 0) && (
                      <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white">
                        {channel.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            filteredDms.map((dm) => {
              const isSelected = currentChannelId === dm.id;
              return (
                <button
                  key={dm.id}
                  onClick={() => setCurrentChannelId(dm.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-orange-50/80 text-orange-950 font-black dark:bg-orange-950/40 dark:text-orange-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative shrink-0">
                      <div className="flex size-8 items-center justify-center rounded-full bg-slate-200 font-bold text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {dm.name.slice(0, 2).toUpperCase()}
                      </div>
                      {dm.online && (
                        <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{dm.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{dm.last_message}</p>
                    </div>
                  </div>

                  {Boolean(dm.unread_count && dm.unread_count > 0) && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white shrink-0">
                      {dm.unread_count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Stream & Input Pane */}
      <div className="flex flex-1 flex-col h-full bg-slate-50/40 dark:bg-slate-950">
        {/* Chat Stream Header */}
        <div className="h-16 border-b border-slate-200/80 px-5 flex items-center justify-between bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3 truncate">
            <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-800 font-bold text-sm dark:bg-orange-950/50 dark:text-orange-300">
              {activeChannel?.icon || <MessageCircle size={18} />}
            </div>
            <div className="truncate">
              <h2 className="text-sm font-black text-slate-950 dark:text-white truncate">
                {title}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            title="Channel options"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Message Bubble Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-xl ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-800 text-xs font-black dark:bg-slate-800 dark:text-slate-200">
                  {msg.sender_name.slice(0, 2).toUpperCase()}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-1 ${isMe ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 text-[11px] ${isMe ? 'justify-end' : ''}`}>
                    <span className="font-black text-slate-900 dark:text-white">
                      {isMe ? 'You' : msg.sender_name}
                    </span>
                    {msg.sender_role === 'creator' ? (
                      <span className="rounded-full bg-orange-500 px-1.5 py-0.2 text-[9px] font-black uppercase text-white">
                        CREATOR
                      </span>
                    ) : msg.sender_role === 'mentor' ? (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        MENTOR
                      </span>
                    ) : null}
                    <span className="text-slate-400 text-[10px]">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                      isMe
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-tr-xs'
                        : 'bg-white text-slate-900 border border-slate-200/70 rounded-tl-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Composer */}
        <div className="p-4 bg-white border-t border-slate-200/80 dark:border-slate-800 dark:bg-slate-950">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button
              type="button"
              title="Attach media or project file"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition"
            >
              <Paperclip size={18} />
            </button>

            <button
              type="button"
              title="Add emoji"
              onClick={() => setDraft((d) => `${d} 🔥`)}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition"
            >
              <Smile size={18} />
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${title}...`}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white hover:bg-orange-600 disabled:opacity-40 transition shadow-sm"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
