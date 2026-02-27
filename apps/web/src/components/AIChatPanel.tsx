'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Sparkles,
  Mail,
  Loader2,
  User,
  Bot,
  Paperclip,
  ExternalLink,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: EmailResult[];
  timestamp: Date;
}

interface EmailResult {
  id: string;
  subject: string;
  from: { name: string; email: string };
  receivedDateTime: string;
  preview: string;
  hasAttachments: boolean;
  importance: string;
}

const suggestedQueries = [
  "Montre-moi les emails du tribunal cette semaine",
  "Emails urgents non lus",
  "Messages des confrères avec pièces jointes",
  "Recherche 'convocation audience'",
];

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || loading) return;

    // Basic prompt-injection defense: if the trimmed message starts with a
    // role keyword that could hijack the system prompt (case-insensitive),
    // prepend a space so the AI backend never treats it as a literal role
    // header.  This is a defence-in-depth measure; server-side validation
    // should be the primary guard.
    const sanitizedQuery = /^(system|assistant)\s*:/i.test(query.trim())
      ? ' ' + query.trim()
      : query.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: sanitizedQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/azure/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: sanitizedQuery,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errMsg = data?.error || `Erreur ${response.status}`;
        throw new Error(errMsg);
      }

      let cleanMessage = data.message;
      if (data.action?.explanation) {
        cleanMessage = data.action.explanation;
      } else {
        cleanMessage = cleanMessage.replace(/```json[\s\S]*?```/g, '').trim();
        cleanMessage = cleanMessage.replace(/\{[\s\S]*"action"[\s\S]*\}/g, '').trim();
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanMessage || (data.results?.length > 0
          ? `J'ai trouvé ${data.results.length} email(s) correspondant à votre recherche.`
          : "Je n'ai pas trouvé de résultats pour cette recherche."),
        results: data.results,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erreur : ${error instanceof Error ? error.message : 'Veuillez réessayer.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[var(--foreground)] text-white shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex items-center justify-center hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] transition-shadow duration-300"
          >
            <Sparkles className="w-5 h-5" strokeWidth={1.8} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
            className={`fixed z-50 bg-white rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col ${
              isExpanded
                ? 'inset-4 md:inset-8'
                : 'bottom-6 right-6 w-[420px] h-[600px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--foreground)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Assistant IA</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)]">Recherche intelligente d&apos;emails</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" strokeWidth={1.8} /> : <Maximize2 className="w-4 h-4" strokeWidth={1.8} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="text-center py-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-5">
                    <MessageSquare className="w-6 h-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-1.5">
                    Comment puis-je vous aider ?
                  </h4>
                  <p className="text-[13px] text-[var(--muted-foreground)] mb-8">
                    Posez des questions sur vos emails en langage naturel
                  </p>
                  <div className="space-y-2">
                    {suggestedQueries.map((query, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                        onClick={() => sendMessage(query)}
                        className="block w-full text-left px-4 py-3 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] text-[13px] text-[var(--foreground)] transition-all duration-200"
                      >
                        {query}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-[var(--foreground)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : ''}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-[var(--foreground)] text-white'
                            : 'bg-[var(--muted)] text-[var(--foreground)]'
                        }`}
                      >
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {/* Email Results */}
                      {message.results && message.results.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          {message.results.map((email) => (
                            <motion.div
                              key={email.id}
                              initial={{ opacity: 0, scale: 0.97 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white rounded-xl shadow-[var(--shadow-card)] p-3.5 hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 cursor-pointer group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] flex-shrink-0">
                                  <Mail className="w-3.5 h-3.5 text-[var(--muted-foreground)]" strokeWidth={1.8} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-[13px] text-[var(--foreground)] truncate">
                                      {email.subject}
                                    </p>
                                    {email.hasAttachments && (
                                      <Paperclip className="w-3 h-3 text-[var(--muted-foreground)] flex-shrink-0" strokeWidth={1.8} />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                                    {email.from.name} · {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true, locale: fr })}
                                  </p>
                                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1 line-clamp-2 opacity-70">
                                    {email.preview}
                                  </p>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 px-1 opacity-60">
                        {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-[var(--muted-foreground)]" strokeWidth={2} />
                      </div>
                    )}
                  </motion.div>
                ))
              )}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--foreground)] flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  </div>
                  <div className="bg-[var(--muted)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" />
                      <span className="text-[13px] text-[var(--muted-foreground)]">Recherche en cours...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)]">
              <div className="flex gap-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Demandez-moi de chercher des emails..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[13px] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="px-4 py-3 rounded-xl bg-[var(--foreground)] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:opacity-90"
                >
                  <Send className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
