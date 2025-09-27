import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle, Bot, User, Loader2 } from 'lucide-react';
import { floatChatAPI, ChatMessage, DataFilters } from '@/services/api';

interface EnhancedChatInterfaceProps {
  onDataAction?: (action: any) => void;
  filters?: DataFilters;
}

const EnhancedChatInterface = ({ onDataAction, filters }: EnhancedChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: `🌊 **Welcome to FloatChat - ARGO Ocean Research Assistant**

I'm here to help you analyze oceanographic data from the global ARGO float network. As a research tool, I can assist with:

📊 **Data Analysis & Visualization**
• Temperature and salinity profiles at specific locations
• Time-series analysis for climate research
• Data quality assessment and validation

🗺️ **Spatial & Temporal Queries**
• Regional oceanographic conditions
• Seasonal and interannual variability
• Cross-basin comparisons

🔬 **Research Applications**
• Climate change studies
• Ocean circulation analysis
• Water mass identification

**Example Research Queries:**
• "Show temperature profiles in the North Atlantic during winter 2023"
• "Compare salinity trends in the Pacific vs Atlantic equatorial regions"
• "Analyze data quality for floats in the Southern Ocean"
• "Find temperature anomalies in the Indian Ocean monsoon region"

What oceanographic research question can I help you explore today?`,
      sender: 'assistant',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    // Add a small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await floatChatAPI.sendChatMessage(inputValue, filters);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response.reply,
        sender: 'assistant',
        timestamp: new Date(),
        actions: response.actions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Execute actions
      if (response.actions && onDataAction) {
        response.actions.forEach(action => onDataAction(action));
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
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
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-card/50 to-muted/20">
      <div className="p-6 border-b border-border/40 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">
              RESEARCH ASSISTANT
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">
              AI-Powered Oceanographic Analysis
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={chatContainerRef}
          className="flex-1 px-6 py-4 overflow-y-auto scrollbar-thin"
          style={{
            maxHeight: 'calc(100vh - 300px)',
            minHeight: '400px'
          }}
        >
          <div className="space-y-4 pb-4 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.actions.map((action, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {action.type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-secondary rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-secondary-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border/40 bg-gradient-to-r from-muted/30 via-card/50 to-muted/30">
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <div
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 cursor-pointer hover:scale-105 transition-all duration-300 group"
                onClick={() => setInputValue("Show me temperature profiles in the North Atlantic")}
              >
                <span className="text-xs font-bold text-primary group-hover:text-accent transition-colors">
                  🌡️ TEMPERATURE ANALYSIS
                </span>
              </div>
              <div
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent/20 to-primary/20 border border-accent/30 cursor-pointer hover:scale-105 transition-all duration-300 group"
                onClick={() => setInputValue("Compare salinity data between Pacific and Atlantic")}
              >
                <span className="text-xs font-bold text-accent group-hover:text-primary transition-colors">
                  💧 SALINITY COMPARISON
                </span>
              </div>
              <div
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 cursor-pointer hover:scale-105 transition-all duration-300 group"
                onClick={() => setInputValue("Find active floats in the Southern Ocean")}
              >
                <span className="text-xs font-bold text-primary group-hover:text-accent transition-colors">
                  🗺️ REGIONAL SEARCH
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about ocean data, regional analysis, or specific research questions..."
                className="h-14 text-base font-medium bg-background/50 border-2 border-border/50 focus:border-primary/50 rounded-2xl pl-6 pr-6 placeholder:text-muted-foreground/70"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="h-14 w-14 rounded-2xl modern-button shadow-xl border-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            ⚡ Pro Tip: Be specific about location, time period, and parameters for optimal analysis
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatInterface;
