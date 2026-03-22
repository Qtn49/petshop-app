'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Trash2,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react';

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

const SUGGESTIONS = [
  {
    label: 'Sales & improvements',
    text: 'Analyse my Square sales and top products, then suggest 3 concrete improvements',
  },
  {
    label: 'Local market trends',
    text: 'What are the current pet shop trends I can apply in my area?',
  },
  {
    label: 'Stock health check',
    text: "Which of my products haven't sold in 30 days and should I discount or remove?",
  },
];

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
        />
      ))}
    </span>
  );
}

function parseSseLine(
  line: string
): { type: 'delta'; value: string } | { type: 'error'; error: string } | { type: 'stream_done' } | { type: 'title'; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^data:\s*(.*)$/);
  if (!m) return null;
  const payload = m[1].trim();
  if (payload === '[DONE]') return { type: 'stream_done' };
  if (payload.startsWith('__TITLE__:')) {
    return { type: 'title', value: payload.slice(9).trim() };
  }
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed === 'string') {
      return { type: 'delta', value: parsed };
    }
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return { type: 'error', error: String((parsed as { error: string }).error) };
    }
  } catch {
    return null;
  }
  return null;
}

export default function ChatbotButton() {
  const { user } = useAuth();
  const userId = user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [badge, setBadge] = useState(0);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isOpenRef = useRef(isOpen);
  const queueRef = useRef<string>('');
  const displayedRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDoneRef = useRef(false);
  const userScrolledRef = useRef(false);
  const lastScrollTimeRef = useRef(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/chat/conversations?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    }
  }, [userId, selectedId]);

  const fetchMessages = useCallback(async (convId: string) => {
    if (!userId) return;
    const res = await fetch(
      `/api/chat/messages?conversationId=${convId}&userId=${userId}`
    );
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    } else {
      setMessages([]);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && isOpen) {
      fetchConversations();
    }
  }, [userId, isOpen, fetchConversations]);

  useEffect(() => {
    if (selectedId && isOpen) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
    setStreamingContent('');
  }, [selectedId, isOpen, fetchMessages]);

  useEffect(() => {
    if (!isLoading && !streamingContent) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // Intentionally only scroll on messages change, not during streaming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleOpen = () => {
    setIsOpen(true);
    setBadge(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowConvDropdown(false);
  };

  const handleNewConversation = async () => {
    if (!userId) return;
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.status === 403) {
      setShowLimitModal(true);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setConversations((prev) => [data, ...prev]);
      setSelectedId(data.id);
      setMessages([]);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!userId) return;
    await fetch(`/api/chat/conversations?id=${id}&userId=${userId}`, {
      method: 'DELETE',
    });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      setSelectedId(conversations[0]?.id ?? null);
      setMessages([]);
    }
  };

  const sendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !userId || isLoading) return;
    setInput('');
    setStreamingContent('');
    setIsLoading(true);
    userScrolledRef.current = false;
    queueRef.current = '';
    displayedRef.current = '';
    streamDoneRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    let convId = selectedId;
    const needsNewConversation = !convId || conversations.length === 0;
    if (needsNewConversation) {
      const createRes = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (createRes.status === 403) {
        setShowLimitModal(true);
        setIsLoading(false);
        return;
      }
      if (!createRes.ok) {
        setIsLoading(false);
        return;
      }
      const newConv = await createRes.json();
      convId = newConv.id;
      setConversations((prev) => [newConv, ...prev]);
      setSelectedId(convId);
      setMessages([{ id: 'temp-u', role: 'user', content: trimmed, created_at: new Date().toISOString() }]);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: 'temp-u', role: 'user', content: trimmed, created_at: new Date().toISOString() },
      ]);
    }

    abortRef.current = new AbortController();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        conversationId: convId,
        userId,
      }),
      signal: abortRef.current.signal,
    });

    if (!res.ok) {
      setStreamingContent(`Error: ${(await res.json().catch(() => ({}))).error ?? res.statusText}`);
      setIsLoading(false);
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let finished = false;

    const startTypingInterval = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (queueRef.current.length === 0) {
          if (streamDoneRef.current && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        const take = Math.min(2, queueRef.current.length);
        displayedRef.current += queueRef.current.slice(0, take);
        queueRef.current = queueRef.current.slice(take);
        setStreamingContent(displayedRef.current);
        if (!userScrolledRef.current) {
          const now = Date.now();
          if (now - lastScrollTimeRef.current > 300) {
            lastScrollTimeRef.current = now;
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }
      }, 18);
    };

    try {
      while (reader && !finished) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(0), { stream: !done });
        const blocks = buffer.split('\n\n');
        buffer = done ? '' : blocks.pop() ?? '';
        for (const block of blocks) {
          for (const line of block.split('\n')) {
            const parsed = parseSseLine(line);
            if (!parsed) continue;
            if (parsed.type === 'stream_done') {
              finished = true;
              streamDoneRef.current = true;
              displayedRef.current += queueRef.current;
              queueRef.current = '';
              setStreamingContent(displayedRef.current);
              if (!userScrolledRef.current) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              break;
            }
            if (parsed.type === 'title') {
              const titleVal = parsed.value;
              setConversations((prev) =>
                prev.map((c) => (c.id === convId ? { ...c, title: titleVal } : c))
              );
            } else if (parsed.type === 'error') {
              fullText = parsed.error;
              streamDoneRef.current = true;
              displayedRef.current = parsed.error;
              setStreamingContent(parsed.error);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            } else if (parsed.type === 'delta') {
              fullText += parsed.value;
              queueRef.current += parsed.value;
              startTypingInterval();
            }
          }
          if (finished) break;
        }
        if (done && !finished && buffer.trim()) {
          for (const line of buffer.split('\n')) {
            const parsed = parseSseLine(line);
            if (!parsed) continue;
            if (parsed.type === 'stream_done') {
              finished = true;
              streamDoneRef.current = true;
              displayedRef.current += queueRef.current;
              queueRef.current = '';
              setStreamingContent(displayedRef.current);
              if (!userScrolledRef.current) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              break;
            }
            if (parsed.type === 'title') {
              const titleVal = parsed.value;
              setConversations((prev) =>
                prev.map((c) => (c.id === convId ? { ...c, title: titleVal } : c))
              );
            } else if (parsed.type === 'error') {
              fullText = parsed.error;
              streamDoneRef.current = true;
              displayedRef.current = parsed.error;
              setStreamingContent(parsed.error);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            } else if (parsed.type === 'delta') {
              fullText += parsed.value;
              queueRef.current += parsed.value;
              startTypingInterval();
            }
          }
        }
        if (done) break;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStreamingContent(`Error: ${(err as Error).message}`);
      }
    }

    if (fullText && convId) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'temp-a',
          role: 'assistant',
          content: fullText,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
    setIsLoading(false);
    fetchConversations();
    if (convId) fetchMessages(convId);
    if (!isOpenRef.current) {
      setBadge(1);
    }
  };

  const handleSend = () => {
    sendChatMessage(input);
  };

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const showSuggestions =
    messages.length === 0 && !streamingContent && !isLoading;

  if (!userId) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-24 lg:bottom-6 right-6 md:right-24 z-50 w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-lg flex items-center justify-center transition"
        aria-label="Open chat"
      >
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>

      {showLimitModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button
              type="button"
              onClick={() => setShowLimitModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-lg text-slate-900 pr-8">
              Conversations limit reached
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              You&apos;ve reached the maximum of 5 conversations for this plan.
              Contact the developer to unlock unlimited conversations.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <a
                href="mailto:guez.quentin@gmail.com"
                className="w-full text-center py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
              >
                Contact developer
              </a>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:items-end md:justify-end md:p-0">
          <div
            className="absolute inset-0 bg-black/30 md:bg-transparent"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="relative w-full md:w-[380px] h-[500px] md:max-h-[85vh] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col md:ml-auto md:mr-6 md:mb-20"
            style={{ animation: 'chatbotSlideUp 0.3s ease-out' }}
          >
            <style>{`@keyframes chatbotSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

            <div className="flex-shrink-0 p-3 border-b border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 min-w-0">
                  <button
                    onClick={() => setShowConvDropdown(!showConvDropdown)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-left"
                  >
                    <span className="truncate text-sm font-medium text-slate-800">
                      {selectedConv?.title ?? 'New conversation'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition ${showConvDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <p className="text-xs text-stone-400 italic truncate max-w-[200px] mt-1">
                    {selectedConv?.title ?? 'New conversation'}
                  </p>
                  {showConvDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowConvDropdown(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-auto">
                        <button
                          onClick={handleNewConversation}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
                        >
                          <Plus className="w-4 h-4" />
                          New conversation
                        </button>
                        {conversations.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center group"
                          >
                            <button
                              onClick={() => {
                                setSelectedId(c.id);
                                setShowConvDropdown(false);
                              }}
                              className="flex-1 px-3 py-2 text-sm text-left truncate hover:bg-slate-50"
                            >
                              {c.title}
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(e, c.id)}
                              className="p-2 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={() => {
                const el = messagesContainerRef.current;
                if (el && el.scrollTop < el.scrollHeight - el.clientHeight - 50) {
                  userScrolledRef.current = true;
                }
              }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <span className="mr-2 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-lg">
                      🐾
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      m.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-slate-200 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-stone prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streamingContent && (
                <div className="flex justify-start">
                  <span className="mr-2 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-lg">
                    🐾
                  </span>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2 bg-slate-200 text-slate-800">
                    <div className="prose prose-sm max-w-none prose-stone prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              {isLoading && !streamingContent && (
                <div className="flex justify-start">
                  <span className="mr-2 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-lg">
                    🐾
                  </span>
                  <div className="rounded-2xl rounded-bl-md px-4 py-2 bg-slate-200">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {showSuggestions && (
              <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => sendChatMessage(s.text)}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 cursor-pointer hover:bg-amber-100 transition text-left text-sm text-stone-700"
                  >
                    <span className="font-bold text-xs text-stone-800 block mb-1">
                      {s.label}
                    </span>
                    {s.text}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-shrink-0 p-3 border-t border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  aria-label="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
