import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Mic,
  MicOff,
  Sparkles,
  Shield,
  Info,
  Heart,
  Pill,
  AlertTriangle,
  Sun
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { apiClient } from "../../services/apiClient";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
  source?: string;
}

export const LifeShieldChatbot: React.FC = () => {
  const { vitals, environment, user } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "bot",
      text: "Hello! 👋 I am your LifeShield AI Health & Safety Assistant. Ask me to explain your vital signs, weather & AQI risks, routine reminders, or emergency safety protocols.",
      time: "Now",
      source: "LifeShield AI",
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Send to FastAPI Server-Side AI endpoint
      const context = {
        vitals: {
          heartRate: vitals.heartRate,
          spO2: vitals.spO2,
          bodyTemperature: vitals.bodyTemperature,
          steps: vitals.stepsCount,
          activityLevel: vitals.activityLevel,
        },
        environment: {
          regionName: environment.locationName,
          temperature: environment.ambientTempC,
          aqi: environment.aqi,
          heatIndex: environment.heatIndexC,
        },
        user: {
          name: user.fullName,
          primaryLanguage: user.primaryLanguage,
        },
      };

      const res = await apiClient.ai.chat(q, context);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: res.source === "gemini" ? "Google Gemini" : res.source === "openai" ? "OpenAI GPT" : "LifeShield Clinical Safety",
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "I am having trouble reaching the server right now. If you are experiencing a medical emergency, please press the SOS button or contact local emergency services immediately.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: "System Fallback",
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Real Web Speech Recognition
  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = user.primaryLanguage === "te" ? "te-IN" : user.primaryLanguage === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
      setIsListening(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open LifeShield AI Assistant"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#00A88F] to-[#3478F6] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-50 group"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#16A673] border-2 border-white" />
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-[#0B1628] text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00A88F] to-[#7357E8] flex items-center justify-center text-white shadow-inner">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">LifeShield AI</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-[#00A88F] border border-teal-500/30">
                    Live Assistant
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A673] animate-pulse" />
                  <span>Health & Environmental Intelligence</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Medical Disclaimer Alert Banner */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200/80 text-[10px] text-slate-600 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#3478F6] shrink-0" />
            <span>Health & safety guidance only — not a clinical diagnosis or prescription.</span>
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F6F8FB]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                    m.sender === "user"
                      ? "bg-[#0B1628] text-white rounded-br-none"
                      : "bg-white text-slate-900 border border-slate-200/90 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  
                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 text-[9px] opacity-60 border-t border-slate-100/30">
                    {m.source && <span className="font-semibold">{m.source}</span>}
                    <span className="ml-auto">{m.time}</span>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#7357E8] animate-spin" />
                  <span>LifeShield is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {[
              { icon: Heart, text: "Explain my heart rate" },
              { icon: Sun, text: "Check heat & AQI risk" },
              { icon: Pill, text: "Medicine schedules" },
              { icon: AlertTriangle, text: "Emergency protocol" },
            ].map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.text}
                  onClick={() => handleSend(chip.text)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold shrink-0 flex items-center gap-1 transition-colors"
                >
                  <Icon className="w-3 h-3 text-[#3478F6]" />
                  <span>{chip.text}</span>
                </button>
              );
            })}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder={isListening ? "Listening to your voice..." : "Ask LifeShield AI..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white transition-all"
            />

            <button
              onClick={startVoiceInput}
              aria-label="Voice Input"
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? "bg-rose-50 text-[#E5485D] border-rose-200 animate-pulse"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="Speak question"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              aria-label="Send Message"
              className="p-2.5 rounded-xl bg-[#00A88F] hover:bg-[#008f7a] text-white disabled:opacity-40 disabled:hover:bg-[#00A88F] transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </>
  );
};

export default LifeShieldChatbot;