// This is the final, integrated version of your chat interface.
// It connects the beautiful UI to the powerful RAG AI backend.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronRight, Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- CORE INTEGRATION ---
// 1. Import the real API function and its response type.
import { askAI, AIResponse } from '@/services/api';

interface GuidedSummary {
  signature: string;
  headline: string;
  highlights: string[];
  columns: string[];
  sampleFloat?: string;
}

// --- Define the shape of our chat messages ---
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatInterfaceProps {
  // This function will pass the REAL data up to the main dashboard
  onDataReceived: (data: Record<string, any>[], sqlQuery: string) => void;
  onComplexitySignal: (delta: number, query: string) => void;
  dataSummary: GuidedSummary | null;
  palettePrefill: string | null;
  onPrefillConsumed: () => void;
}

const evaluateComplexity = (query: string) => {
  const normalized = query.toLowerCase();
  let score = 0;

  const advancedKeywords = /(join|window|rank|dense_rank|correl|regression|cluster|anomal|fourier|decomposition|kalman|wavelet|predict)/;
  const analyticKeywords = /(avg|sum|count|variance|stddev|percentile|median|quantile|lag|lead|partition|group by|order by)/;
  const conditionalPatterns = /(>=|<=|!=| like | between | in \(|case when)/;
  const geospatialPatterns = /(polygon|bbox|buffer|distance|geography|geospatial|haversine)/;

  if (advancedKeywords.test(normalized)) score += 4;
  if (analyticKeywords.test(normalized)) score += 2;
  if (conditionalPatterns.test(normalized)) score += 1;
  if (geospatialPatterns.test(normalized)) score += 2;
  if (normalized.length > 140) score += 2;
  if ((normalized.match(/[()]/g) || []).length > 4) score += 1;

  return score;
};

const classifyComplexity = (score: number) => {
  if (score >= 6) return { delta: 3, classification: 'advanced' as const };
  if (score >= 4) return { delta: 2, classification: 'intermediate' as const };
  if (score >= 2) return { delta: 1, classification: 'intermediate' as const };
  if (score >= 1) return { delta: 1, classification: 'basic' as const };
  return { delta: -1, classification: 'basic' as const };
};

const ChatInterface = ({
  onDataReceived,
  onComplexitySignal,
  dataSummary,
  palettePrefill,
  onPrefillConsumed,
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Welcome to FloatChat — your ARGO mission copilot.
Ask a question to surface floats, profiles, or trends when you're ready.`,
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isViewportReady, setIsViewportReady] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const summarySignatureRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);
  const composerRef = useRef<HTMLFormElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const bottomSafePadding = composerHeight + 48;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessagesBadge, setShowNewMessagesBadge] = useState(false);
  const ensureChatPadding = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const paddingValue = `${bottomSafePadding}px`;
    viewport.style.setProperty('--chat-bottom-padding', paddingValue);
    viewport.style.setProperty('padding-bottom', paddingValue, 'important');
  }, [bottomSafePadding]);

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;

    viewportRef.current = viewport;
    setIsViewportReady(true);

    const handleScroll = () => {
      if (!viewportRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const atBottom = distanceFromBottom <= 16;

      setIsAtBottom(atBottom);
      if (atBottom) {
        setShowNewMessagesBadge(false);
      }
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isViewportReady) return;
    ensureChatPadding();
  }, [isViewportReady, ensureChatPadding]);

  useEffect(() => {
    if (!isViewportReady) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new MutationObserver(() => {
      ensureChatPadding();
    });

    observer.observe(viewport, { childList: true, subtree: true, attributes: true });

    return () => observer.disconnect();
  }, [isViewportReady, ensureChatPadding]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const messageAdded = messages.length > messageCountRef.current;

    if (messageAdded) {
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setShowNewMessagesBadge(true);
      }
    }

    messageCountRef.current = messages.length;
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (!palettePrefill) return;
    setInput(palettePrefill);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    onPrefillConsumed();
  }, [palettePrefill, onPrefillConsumed]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    if (typeof window === 'undefined' || !composerRef.current) return;

    const updateHeight = () => {
      if (!composerRef.current) return;
      const nextHeight = composerRef.current.offsetHeight;
      setComposerHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(composerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dataSummary) return;
    if (dataSummary.signature === summarySignatureRef.current) return;
    summarySignatureRef.current = dataSummary.signature;

    const summaryMessage: Message = {
      id: `${Date.now()}-summary`,
      content: `Here’s what I’m seeing:

• ${dataSummary.headline}
${dataSummary.highlights.map((line) => `• ${line}`).join('\n')}

Let me know if you’d like to dive into any detail further or filter this view.`,
      sender: 'assistant',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, summaryMessage]);
  }, [dataSummary]);

  const sendPrompt = async (prompt: string, options?: { preserveInput?: boolean }) => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const timestamp = new Date();
    const userMessage: Message = {
      id: timestamp.getTime().toString(),
      content: trimmed,
      sender: 'user',
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);

    if (!options?.preserveInput) {
      setInput('');
    }

    const score = evaluateComplexity(trimmed);
    const { delta } = classifyComplexity(score);
    onComplexitySignal(delta, trimmed);

    setIsLoading(true);

    try {
      const response: AIResponse = await askAI(trimmed);

      let assistantContent = 'Sorry, I encountered an issue.';

      if (response.error) {
        assistantContent = `An error occurred: ${response.error}`;
        onDataReceived([], 'Error executing query.');
      } else if (Array.isArray(response.result_data)) {
        const data = response.result_data;
        if (data && data.length > 0) {
          assistantContent = `I pulled ${data.length} records and synced them with the main viewscreen.`;
          onDataReceived(data, response.sql_query || '');
        } else {
          assistantContent = 'The query ran successfully but returned no rows. Adjust your parameters and try again.';
          onDataReceived([], response.sql_query || '');
        }
      } else {
        assistantContent = (response.result_data as string) || "I'm not sure how to answer that.";
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        content: assistantContent,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        content: 'Failed to connect to the AI server. Please make sure it is running.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendPrompt(input);

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 text-sm">
      <header className="shrink-0 rounded-2xl border border-white/20 bg-white/70 px-5 py-3 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-ocean text-white shadow-md shadow-sky-500/30">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">FloatChat</h3>
              <p className="text-[0.7rem] text-muted-foreground">Quick intel, minimal noise.</p>
            </div>
          </div>
        </div>
      </header>

      <ScrollArea ref={scrollAreaRef} className="data-scroll relative flex-1 min-h-0 max-h-[calc(100vh-260px)] rounded-[24px] border border-white/20 bg-white/55 p-5 shadow-[0_34px_68px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div
          className="relative flex flex-col gap-6 pr-6 sm:pr-8"
          style={{ paddingBottom: `${bottomSafePadding}px` }}
        >
          {messages.map((message) => (
            <div key={message.id} className="flex w-full justify-start">
              <div className="flex w-full max-w-none items-start gap-4">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={message.sender === 'user' ? 'bg-primary text-primary-foreground shadow-[0_10px_25px_-15px_rgba(14,165,233,0.7)]' : 'bg-secondary/70 text-slate-700 dark:bg-white/[0.08] dark:text-white'}>
                    {message.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    'relative w-fit max-w-[80%] overflow-visible rounded-2xl p-4 text-left transition-shadow sm:max-w-[75%] xl:max-w-[70%]',
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-sky-500/25'
                      : 'bg-white/85 text-slate-700 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-lg dark:bg-white/[0.07] dark:text-slate-100'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[78%] items-start gap-4">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary/70 text-slate-700 dark:bg-white/[0.08] dark:text-white">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-white/85 p-4 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-md dark:bg-white/[0.07]">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Processing your query...</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showNewMessagesBadge && (
            <div
              className="pointer-events-none absolute left-0 right-0 flex justify-center"
              style={{ bottom: `${composerHeight + 32}px` }}
            >
              <button
                type="button"
                onClick={() => {
                  scrollToBottom();
                  setShowNewMessagesBadge(false);
                }}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white shadow-lg shadow-slate-900/25 transition hover:-translate-y-0.5 dark:bg-white/85 dark:text-slate-900"
              >
                New message
                <ChevronRight className="h-3 w-3 rotate-90" />
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
        ref={composerRef}
        className="shrink-0 rounded-[24px] border border-white/20 bg-white/65 px-5 py-4 shadow-[0_22px_44px_-35px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-300">
          <span>Chat Composer</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative flex min-h-[150px] flex-1 rounded-[32px] border border-white/25 bg-white/90 px-5 py-5 shadow-inner shadow-slate-900/10 transition focus-within:border-primary/40 focus-within:shadow-[0_18px_42px_-28px_rgba(37,99,235,0.45)] dark:border-white/10 dark:bg-white/[0.08]">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Craft your directive or ask a follow-up..."
              rows={1}
              className="w-full resize-none border-none bg-transparent pr-14 text-base leading-relaxed tracking-tight outline-none focus-visible:ring-0"
              disabled={isLoading}
              ref={inputRef}
              aria-label="Chat composer"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-ocean shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
