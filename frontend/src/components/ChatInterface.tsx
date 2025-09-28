// This is the final, integrated version of your chat interface.
// It connects the beautiful UI to the powerful RAG AI backend.

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2 } from 'lucide-react';

// --- CORE INTEGRATION ---
// 1. Import the real API function and its response type.
import { askAI, AIResponse } from '@/services/api';
// We also import our utility for parsing the AI's data response.
import { parseSqlResult } from '@/lib/utils';

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
}

const ChatInterface = ({ onDataReceived }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your ARGO data assistant. How can I help you explore oceanographic data today?",
      sender: 'assistant',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic to keep the latest message in view.
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // --- CORE INTEGRATION ---
      // 2. Call the REAL AI backend instead of a mock function.
      const response: AIResponse = await askAI(currentInput);

      let assistantContent = "Sorry, I encountered an issue.";
      
      if (response.error) {
        assistantContent = `An error occurred: ${response.error}`;
        onDataReceived([], "Error executing query.");
      } else {
        // 3. Handle the two types of responses from the AI Router
        if (response.sql_query) { // This was a data query
          const parsedData = parseSqlResult(response.sql_query, response.result_data);
          
          if (parsedData.length > 0) {
            assistantContent = `I found ${parsedData.length} records. The exploration panel has been updated.`;
            // 4. Send the real, parsed data up to the parent component.
            onDataReceived(parsedData, response.sql_query);
          } else {
            assistantContent = "I ran the query, but it returned no results. Please try a different question.";
            onDataReceived([], response.sql_query);
          }
        } else { // This was a conversational response
          assistantContent = (response.result_data as string) || "I'm not sure how to answer that.";
          // We don't update the data panel for a simple chat message.
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Failed to connect to the AI server. Please make sure it is running.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // The rest of your beautiful UI code remains the same.
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gradient-surface">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-ocean rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">ARGO Assistant</h3>
            <p className="text-xs text-muted-foreground">Ocean Data AI</p>
          </div>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex space-x-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
                    {message.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`rounded-lg p-3 ${
                  message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary'
                }`}>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
               <div className="flex space-x-3 max-w-[80%]">
                 <Avatar className="w-8 h-8">
                   <AvatarFallback className="bg-secondary"><Bot className="w-4 h-4" /></AvatarFallback>
                 </Avatar>
                 <div className="bg-secondary rounded-lg p-3">
                   <div className="flex items-center space-x-2">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     <p className="text-sm">Processing your query...</p>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-gradient-surface/30">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about ARGO data..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

