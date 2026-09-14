import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  Zap,
  AlertTriangle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Moon
} from 'lucide-react';
import { loadAnnModel, AnnModel } from '../lib/annModel';
import { buildPlantState } from '../lib/plantState';
import { useVoice } from '../hooks/useVoice';
import { usePlantInput } from '../hooks/usePlantInput';
import { askAssistant } from '@backend/recommend.js';
import type { ChatTurn } from '@backend/recommend.js';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isError?: boolean;
  quickActions?: { label: string; action: () => void }[];
}

/**
 * `reports` and `onOpenReport` used to be declared here and passed in from App,
 * but nothing in this component ever read either one: the assistant's entire
 * context is buildPlantState(), which carries no report history. They were props
 * that looked like a feature from the call site and did nothing.
 *
 * They are not wired up instead of removed because a report is a snapshot of the
 * same figures the assistant already reads live, so it would add tokens to every
 * turn for no new information, and most of the list is seeded sample reports that
 * the model would then cite as if they were this plant's history.
 */
interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  /** Set when the wake word opened this, so the mic starts without a click. */
  autoStartListening?: boolean;
  onAutoStartConsumed?: () => void;
  wakeWordEnabled?: boolean;
  onToggleWakeWord?: () => void;
  wakeWordSupported?: boolean;
  wakeWordError?: string | null;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  autoStartListening = false,
  onAutoStartConsumed,
  wakeWordEnabled = false,
  onToggleWakeWord,
  wakeWordSupported = false,
  wakeWordError = null
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: "Ask me anything on this screen. I can see your throughput, what the model says you'll burn in electricity, steam and dryer fuel, your CO2e intensity, and the distillation scenarios. If it's not in there, I'll tell you straight instead of making something up.",
      timestamp: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [model, setModel] = useState<AnnModel | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The throughput the operator actually set, not a nominal constant.
  const { grainInputTpd, readings } = usePlantInput();

  // handleUserSend is declared below and closes over current state, so the voice
  // callback reaches it through a ref rather than forcing a reorder.
  const sendRef = useRef<(text?: string) => void>(() => {});
  const voice = useVoice({
    onFinalTranscript: (text) => sendRef.current(text)
  });

  const samplePrompts = [
    'Why is S2 recommended over S1?',
    'What is driving our CO2e intensity?',
    'How much steam would dropping reflux to 2.5 save?',
    'How reliable is the dryer fuel prediction?'
  ];

  useEffect(() => {
    loadAnnModel().then(setModel).catch(() => setModel(null));
  }, []);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleUserSend(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Keep the voice callback pointed at the current closure.
  useEffect(() => {
    sendRef.current = handleUserSend;
  });

  // Opened by the wake word: pick the microphone straight up so the operator can
  // keep talking without reaching for the mouse.
  useEffect(() => {
    if (isOpen && autoStartListening) {
      voice.startListening();
      onAutoStartConsumed?.();
    }
  }, [isOpen, autoStartListening]);

  // Closing the drawer releases the microphone and cuts off any reply mid-word.
  useEffect(() => {
    if (!isOpen) {
      voice.stopListening();
      voice.stopSpeaking();
    }
  }, [isOpen]);

  const handleUserSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Snapshot the transcript before appending, so the model sees prior turns
    // without the question we are about to ask.
    const history: ChatTurn[] = messages
      .slice(1)
      .map((m) => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    const reply = model
      ? await askAssistant(text, buildPlantState(model, grainInputTpd, { readings }), history)
      : {
          recommendations: null,
          provider: null,
          error: 'The consumption model has not loaded, so there are no plant figures to answer from.'
        };

    setProvider(reply.provider);
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: reply.recommendations ?? reply.error ?? 'No response received.',
        isError: !reply.recommendations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setIsTyping(false);

    // Read the answer out, but not the failures: a spoken stack of provider
    // errors is noise, and it is already on screen in red.
    if (reply.recommendations) voice.speak(reply.recommendations);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#061449]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-[#e0e3e6]">
          {/* Header */}
          <div className="p-4 md:p-5 bg-[#061449] text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0f6e8c] to-[#3d93ad] flex items-center justify-center text-white shadow-md">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  <span>E-Optimizer AI Assistant</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D6A4F] text-white uppercase">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-[#b9c3ff]">
                  Reads your live numbers • ETH-042
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#8793cd] hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Context Strip */}
          <div className="px-5 py-2.5 bg-[#f2f4f7] border-b border-[#e0e3e6] flex items-center justify-between text-xs text-[#45464f]">
            <div className="flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-[#0f6e8c]" />
              <span>Throughput: <strong>{grainInputTpd.toFixed(1)} t/day</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span>Model: <strong>{model ? 'loaded' : 'loading'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span>LLM: <strong>{provider ?? 'idle'}</strong></span>
            </div>

            {/* Voice state, and the only switch for the always-on wake word. */}
            <div className="flex items-center gap-2">
              {voice.isListening ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#BA1A1A]/10 text-[#BA1A1A] font-bold">
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                  <span>Listening</span>
                </span>
              ) : voice.isSpeaking ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0f6e8c]/10 text-[#0f6e8c] font-bold">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>Speaking</span>
                </span>
              ) : null}

              {wakeWordSupported && onToggleWakeWord && (
                <button
                  type="button"
                  onClick={onToggleWakeWord}
                  title={
                    wakeWordEnabled
                      ? 'Wake word on. The microphone stays open in the background.'
                      : 'Wake word off. Click the mic to talk instead.'
                  }
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                    wakeWordEnabled
                      ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                      : 'bg-[#eceef1] text-[#767680]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{wakeWordEnabled ? 'Wake word on' : 'Wake word off'}</span>
                </button>
              )}
            </div>
          </div>

          {(voice.error || wakeWordError || (!voice.isRecognitionSupported && isOpen)) && (
            <div className="px-5 py-2 bg-[#FFB703]/10 border-b border-[#FFB703]/30 text-[11px] text-[#8a6100] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {voice.error ??
                  wakeWordError ??
                  'Voice input is not supported in this browser. Firefox has no speech recognition, so type your question instead. Replies can still be read aloud.'}
              </span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar bg-[#f7f9fc]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-lg bg-[#0f6e8c] text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs relative group ${
                    msg.sender === 'user'
                      ? 'bg-[#061449] text-white rounded-tr-xs'
                      : msg.isError
                      ? 'bg-[#BA1A1A]/5 text-[#BA1A1A] border border-[#BA1A1A]/25 rounded-tl-xs'
                      : 'bg-white text-[#191c1e] border border-[#e0e3e6] rounded-tl-xs'
                  }`}
                >
                  {/* Formatted Text rendering */}
                  <div className="space-y-2 whitespace-pre-line font-normal">
                    {msg.isError && (
                      <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
                    )}
                    {msg.text}
                  </div>

                  <div
                    className={`mt-2 flex items-center justify-between text-[10px] ${
                      msg.sender === 'user' ? 'text-white/60' : 'text-[#767680]'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'ai' && (
                      <button
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-[#061449] cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#2D6A4F]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-[#0f6e8c] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-[#e0e3e6] rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0f6e8c] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#0f6e8c] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#0f6e8c] animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs text-[#767680] ml-2">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sample Prompts */}
          <div className="p-3 bg-white border-t border-[#e0e3e6]">
            <div className="text-[11px] font-bold text-[#767680] mb-2 flex items-center gap-1 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#0f6e8c]" />
              <span>Try asking:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUserSend(p)}
                  disabled={isTyping}
                  className="px-2.5 py-1.5 bg-[#f2f4f7] hover:bg-[#3d93ad]/10 hover:text-[#0f6e8c] text-[#45464f] rounded-lg text-xs font-medium transition-colors text-left flex items-center gap-1 cursor-pointer border border-[#e0e3e6]"
                >
                  <ChevronRight className="w-3 h-3 shrink-0 text-[#0f6e8c]" />
                  <span className="truncate max-w-[280px]">{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="p-4 bg-white border-t border-[#e0e3e6]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUserSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={voice.isListening ? voice.transcript : inputText}
                onChange={(e) => setInputText(e.target.value)}
                readOnly={voice.isListening}
                placeholder={
                  voice.isListening
                    ? 'Listening...'
                    : 'Ask about steam, CO2e, the scenarios, anything on screen...'
                }
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs text-[#061449] focus:outline-none focus:ring-2 transition-colors ${
                  voice.isListening
                    ? 'bg-[#BA1A1A]/5 border border-[#BA1A1A]/40 focus:ring-[#BA1A1A]/20'
                    : 'bg-[#f7f9fc] border border-[#c6c5d1] focus:border-[#0f6e8c] focus:ring-[#0f6e8c]/20'
                }`}
              />

              {/* Stop the reply mid-sentence. Only useful while it is talking. */}
              {voice.isSpeaking && (
                <button
                  type="button"
                  onClick={voice.stopSpeaking}
                  title="Stop speaking"
                  aria-label="Stop speaking"
                  className="p-2.5 bg-[#eceef1] hover:bg-[#c6c5d1] text-[#45464f] rounded-xl transition-colors cursor-pointer"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={voice.isListening ? voice.stopListening : voice.startListening}
                disabled={!voice.isRecognitionSupported || isTyping}
                title={
                  voice.isRecognitionSupported
                    ? voice.isListening
                      ? 'Stop listening'
                      : 'Ask by voice'
                    : 'Voice input is not supported in this browser'
                }
                aria-label={voice.isListening ? 'Stop listening' : 'Ask by voice'}
                aria-pressed={voice.isListening}
                className={`p-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  voice.isListening
                    ? 'bg-[#BA1A1A] hover:bg-[#93000a] text-white animate-pulse'
                    : 'bg-[#eceef1] hover:bg-[#c6c5d1] text-[#45464f]'
                }`}
              >
                {voice.isRecognitionSupported ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isTyping || voice.isListening}
                className="p-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:opacity-50 text-white rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
