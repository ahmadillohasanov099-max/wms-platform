import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, Sparkles, Minimize2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function AiRobotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '🤖 <b>WMS-AI Assistent:</b><br/>Assalomu alaykum! Men WMS ombor va moddiy boyliklar bo\'yicha sun\'iy intellekt yordamchingizman. Nimada yordam berishim mumkin?',
      timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const { user } = useAuthStore();

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || query.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setQuery('');
    setLoading(true);

    try {
      const res = await api.post('/telegram/ask-ai', { query: text, user });
      const answer = res.data?.answer || '🤖 Savolingiz bo\'yicha tahlil yakunlandi.';

      const aiMsg: Message = {
        sender: 'ai',
        text: answer,
        timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        sender: 'ai',
        text: '⚠️ WMS-AI servisi bilan aloqa bog\'lanishda xatolik yuz berdi.',
        timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    '📦 Ombor qoldiqlari qancha?',
    '⚠️ Zaxirasi kam tovarlar bormi?',
    '📱 Menga biriktirilgan jihozlar',
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-none select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto w-[350px] sm:w-[380px] h-[480px] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-teal-500/30 rounded-3xl shadow-2xl shadow-teal-950/50 flex flex-col overflow-hidden mb-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-teal-900/40 via-slate-900 to-slate-900 border-b border-teal-500/20">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="absolute -inset-1 bg-teal-500/40 rounded-full blur-xs animate-pulse" />
                  <img
                    src="/ai-image.png"
                    alt="AI Robot"
                    className="relative w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    WMS-AI Yordamchi
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                  </h3>
                  <p className="text-[10px] text-teal-300/80 font-mono">Sun'iy Intellekt Tahlilchisi</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-teal-900">
              {messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex flex-col max-w-[85%] text-xs rounded-2xl p-3 shadow-md',
                    m.sender === 'user'
                      ? 'ml-auto bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-br-none'
                      : 'mr-auto bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none'
                  )}
                >
                  <div
                    className="leading-relaxed space-y-1"
                    dangerouslySetInnerHTML={{ __html: m.text }}
                  />
                  <span
                    className={cn(
                      'text-[9px] mt-1 self-end opacity-70 font-mono',
                      m.sender === 'user' ? 'text-teal-100' : 'text-slate-400'
                    )}
                  >
                    {m.timestamp}
                  </span>
                </motion.div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-teal-400 bg-slate-800/60 p-2.5 rounded-xl border border-teal-500/20 max-w-[70%]">
                  <Bot className="w-4 h-4 animate-bounce" />
                  <span className="animate-pulse font-medium">AI javob tayyorlamoqda...</span>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800 flex gap-1.5 overflow-x-auto scrollbar-none">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full bg-teal-950/60 hover:bg-teal-900/80 border border-teal-500/30 text-teal-200 transition-all shrink-0 hover:scale-105 active:scale-95"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Savolingizni yozing..."
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="p-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-40 transition-all shrink-0 shadow-lg shadow-teal-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Robot Trigger Avatar Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
        whileTap={{ scale: 0.9 }}
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="pointer-events-auto relative group flex items-center justify-center cursor-pointer focus:outline-none"
        title="AI Robot Yordamchi"
      >
        {/* Glow Halo */}
        <div className="absolute -inset-2 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 rounded-full blur-md opacity-60 group-hover:opacity-100 transition-opacity animate-pulse" />

        {/* Robot Circle Box */}
        <div className="relative w-14 h-14 bg-slate-900/90 border-2 border-teal-400/80 rounded-full p-1.5 flex items-center justify-center shadow-2xl backdrop-blur-xl">
          <img
            src="/ai-image.png"
            alt="AI Robot Assistant"
            className="w-full h-full object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110"
          />

          {/* Online Notification Badge */}
          <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
          </span>
        </div>

        {/* Floating Tooltip Label */}
        <div className="absolute right-16 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-teal-500/40 text-teal-300 text-xs font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>WMS-AI Yordamchi</span>
        </div>
      </motion.button>
    </div>
  );
}
