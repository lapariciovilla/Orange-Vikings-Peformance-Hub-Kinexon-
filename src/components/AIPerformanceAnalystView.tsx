import React, { useState } from 'react';
import { AIChatMessage, PlayerSessionRecord, SessionMeta, Player } from '../types';
import { DataStore } from '../lib/dataStore';
import { Bot, Send, Sparkles, User as UserIcon, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';

interface AIPerformanceAnalystViewProps {
  roster: Player[];
  sessions: SessionMeta[];
  records: PlayerSessionRecord[];
}

const SAMPLE_QUESTIONS = [
  'Who had the highest distance today?',
  'Who had the highest mechanical load this week?',
  'Rank the players by deceleration load over the last 7 days.',
  'Compare Aoki and Kodama over the last two weeks.',
  'Which players had unusually high external load today?',
  'Who had the highest jump exposure this week?',
];

export const AIPerformanceAnalystView: React.FC<AIPerformanceAnalystViewProps> = ({
  roster,
  sessions,
  records,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: 'Greetings Coach Luis. I am your Orange Vikings AI Performance Analyst. Ask me anything about KINEXON load data, player comparisons, or volume/intensity trends.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: AIChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInputText('');
    setIsLoading(true);

    try {
      // Build precise deterministic database context for backend
      const latestSession = sessions[0] || null;
      const latestRecords = latestSession ? DataStore.getRecordsForSession(latestSession.id) : [];
      const teamAverages = DataStore.calculateTeamAverages(latestRecords);

      const contextData = {
        rosterCount: roster.length,
        sessionCount: sessions.length,
        latestSession,
        latestRecords: latestRecords.map((r) => ({
          player_number: r.player_number,
          player_name: r.player_name,
          position: r.position,
          distance_m: r.distance_m,
          accumulated_acceleration_load: r.accumulated_acceleration_load,
          deceleration_load: r.deceleration_load,
          jump_load: r.jump_load,
          mechanical_load: r.mechanical_load,
        })),
        teamAverages,
        allRecentSessions: sessions.slice(0, 10),
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          contextData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get analysis');
      }

      const assistantMsg: AIChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('AI Error:', err);
      const errorMsg: AIChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `Error analyzing request: ${err.message || 'Server error'}. Please verify GEMINI_API_KEY in Settings -> Secrets.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100 flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl shrink-0 flex items-center justify-between">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-0.5">
            AI DECISION SUPPORT ASSISTANT
          </div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center space-x-2">
            <Bot className="w-5 h-5 text-orange-500" />
            <span>ASK THE PERFORMANCE ANALYST</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Query Orange Vikings KINEXON external-load data & sports-science trends.
          </p>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 bg-orange-950/60 border border-orange-800/60 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini 3.6 Flash</span>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 shrink-0">
        <span className="text-[11px] font-extrabold text-zinc-500 uppercase whitespace-nowrap">
          SUGGESTED:
        </span>
        {SAMPLE_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/50 text-zinc-300 hover:text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message History Thread */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-y-auto space-y-4 shadow-inner">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-xl p-4 text-xs leading-relaxed space-y-2 ${
                m.sender === 'user'
                  ? 'bg-orange-600 text-zinc-950 font-bold shadow-lg'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 shadow-md'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] opacity-75 font-black uppercase tracking-wider mb-1">
                <span>{m.sender === 'user' ? 'Coach Luis' : 'AI Performance Analyst'}</span>
                <span>{m.timestamp}</span>
              </div>
              <div className="whitespace-pre-wrap font-sans">{m.text}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-orange-400 flex items-center space-x-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing KINEXON database & performing S&C calculations...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="shrink-0 flex items-center space-x-2">
        <input
          type="text"
          id="ai-prompt-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question about Orange Vikings training or player load data..."
          className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-orange-500 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none shadow-lg"
        />
        <button
          id="ai-send-btn"
          onClick={() => handleSend()}
          disabled={isLoading || !inputText.trim()}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-zinc-950 font-black px-5 py-3 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all"
        >
          <span>SEND</span>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
