/**
 * Voice input and output for the assistant, on the browser's Web Speech API.
 *
 * No packages, no API keys, no network calls of our own: recognition and
 * synthesis are whatever the browser already ships. Chrome, Edge and Safari
 * support both. Firefox ships synthesis only, so `isRecognitionSupported` is
 * false there and the UI falls back to typing while replies can still be read
 * aloud.
 *
 * Recognition needs a secure context. It works on localhost and on HTTPS, and
 * silently fails on plain HTTP, which is worth knowing if this is ever served
 * from a bare IP on a plant network.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/* Minimal typings                                                             */
/*                                                                            */
/* The DOM lib does not carry SpeechRecognition across the TypeScript versions */
/* this project supports, and the API is still vendor-prefixed in most         */
/* browsers. These describe only the surface actually used here. Names end in  */
/* `Like` so they cannot collide with a future built-in global.                */
/* -------------------------------------------------------------------------- */

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function synthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Operator-facing text for the error codes the spec actually emits. */
function describeRecognitionError(code: string): string | null {
  switch (code) {
    // Someone opened the mic and said nothing. Not worth a red banner.
    case 'no-speech':
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser to use voice.';
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return 'Speech recognition needs a network connection and could not reach it.';
    default:
      return `Speech recognition stopped: ${code}.`;
  }
}

/* -------------------------------------------------------------------------- */
/* Microphone coordination                                                     */
/*                                                                            */
/* Only one recogniser can hold the microphone at a time. Starting a second    */
/* while the first runs throws InvalidStateError in Chrome, so the wake-word   */
/* loop yields to dictation and resumes once dictation ends.                   */
/* -------------------------------------------------------------------------- */

/**
 * Ownership rather than a bare boolean: a recogniser unmounting must not clear
 * the flag for whichever one currently holds the microphone.
 */
let micOwner: symbol | null = null;
const micListeners = new Set<(busy: boolean) => void>();

function micIsBusy(): boolean {
  return micOwner !== null;
}

function acquireMic(owner: symbol): void {
  if (micOwner === owner) return;
  micOwner = owner;
  micListeners.forEach((notify) => notify(true));
}

/** No-op unless this owner actually holds the microphone. */
function releaseMic(owner: symbol): void {
  if (micOwner !== owner) return;
  micOwner = null;
  micListeners.forEach((notify) => notify(false));
}

function subscribeToMic(listener: (busy: boolean) => void): () => void {
  micListeners.add(listener);
  return () => {
    micListeners.delete(listener);
  };
}

/* -------------------------------------------------------------------------- */
/* Speech synthesis                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rate units, expanded before the bare tokens below.
 *
 * These have to go first: left to a screen reader, "kg CO2e/kL" comes out as
 * "kilograms C O 2 equivalent slash kilolitres". Turning the slash into "per"
 * only works while both sides are still recognisable.
 */
const RATE_UNITS: Array<[RegExp, string]> = [
  [/\bkg\s*CO2e\s*\/\s*kL\b/gi, 'kilograms of C O 2 equivalent per kilolitre'],
  [/\bkg\s*CO2e\s*\/\s*kWh\b/gi, 'kilograms of C O 2 equivalent per kilowatt hour'],
  [/\bkg\s*CO2e\s*\/\s*GJ\b/gi, 'kilograms of C O 2 equivalent per gigajoule'],
  [/\bkg\s*CO2e\s*\/\s*MMBtu\b/gi, 'kilograms of C O 2 equivalent per million B T U'],
  [/\bkg\s*CO2e\s*\/\s*kg\b/gi, 'kilograms of C O 2 equivalent per kilogram'],
  [/\bkWh\s*\/\s*kL\b/gi, 'kilowatt hours per kilolitre'],
  [/\bkg\s*\/\s*kL\b/gi, 'kilograms per kilolitre'],
  [/\bkg\s*\/\s*day\b/gi, 'kilograms per day'],
  [/\bkg\s*\/\s*hr\b/gi, 'kilograms per hour'],
  [/\bt\s*\/\s*day\b/gi, 'tonnes per day'],
  [/\bt\s*\/\s*yr\b/gi, 'tonnes per year'],
  [/\bGJ\s*\/\s*day\b/gi, 'gigajoules per day'],
  [/\bkL\s*\/\s*day\b/gi, 'kilolitres per day'],
  [/\bMMBtu\s*\/\s*day\b/gi, 'million B T U per day'],
];

/**
 * Bare unit tokens, safe to expand on their own.
 *
 * Deliberately excludes a standalone "t" for tonnes: `\bt\b` also matches the
 * t in "don't", which would produce "dontonnes". Tonnes are only expanded as
 * part of a rate above.
 */
const UNIT_WORDS: Array<[RegExp, string]> = [
  [/\bCO2e\b/gi, 'C O 2 equivalent'],
  [/\bkWh\b/g, 'kilowatt hours'],
  [/\bMWh\b/g, 'megawatt hours'],
  [/\bMMBtu\b/gi, 'million B T U'],
  [/\bGJ\b/g, 'gigajoules'],
  [/\bkL\b/g, 'kilolitres'],
  [/\bR2\b/g, 'R squared'],
];

/**
 * Tidies a reply before it is spoken.
 *
 * Two problems: markdown punctuation gets read out as words, and this domain is
 * full of units a generic voice mangles. "kWh" comes out as "kwuh" and "CO2e"
 * as "co-two-ee", which is unusable on a plant floor. The expansions are
 * conservative and bounded by word edges.
 */
export function forSpeech(text: string): string {
  let spoken = text.replace(/[*_`#>]/g, '');

  for (const [pattern, replacement] of RATE_UNITS) {
    spoken = spoken.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of UNIT_WORDS) {
    spoken = spoken.replace(pattern, replacement);
  }

  return spoken.replace(/\s+/g, ' ').trim();
}

/* -------------------------------------------------------------------------- */
/* useVoice                                                                    */
/* -------------------------------------------------------------------------- */

export interface UseVoiceOptions {
  lang?: string;
  /** Fires once per dictation turn, with the final transcript. */
  onFinalTranscript?: (text: string) => void;
}

export interface UseVoice {
  isRecognitionSupported: boolean;
  isSynthesisSupported: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  /** Live interim text while the user is speaking. Empty when idle. */
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoice {
  const { lang = 'en-US', onFinalTranscript } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  // Held in a ref so a new callback identity each render does not tear down and
  // rebuild the recogniser mid-sentence.
  const onFinalRef = useRef<UseVoiceOptions['onFinalTranscript']>(undefined);
  onFinalRef.current = onFinalTranscript;

  const isRecognitionSupported = getRecognitionCtor() !== null;
  const isSynthesisSupported = synthesisAvailable();

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const owner = Symbol('dictation-recogniser');
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      acquireMic(owner);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTextRef.current = `${finalTextRef.current} ${chunk}`.trim();
        } else {
          interim += chunk;
        }
      }
      setTranscript(`${finalTextRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      const message = describeRecognitionError(event.error);
      if (message) setError(message);
    };

    recognition.onend = () => {
      setIsListening(false);
      releaseMic(owner);

      const finalText = finalTextRef.current.trim();
      finalTextRef.current = '';
      setTranscript('');
      if (finalText) onFinalRef.current?.(finalText);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped. Nothing to unwind.
      }
      recognitionRef.current = null;
      releaseMic(owner);
    };
  }, [lang]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    finalTextRef.current = '';
    setTranscript('');
    try {
      recognition.start();
    } catch {
      // start() throws InvalidStateError if it is already running, which is
      // harmless: the session the caller wanted is already open.
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Not running.
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!synthesisAvailable()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!synthesisAvailable()) return;
      const spoken = forSpeech(text);
      if (!spoken) return;

      // Cancel first: queuing onto an in-flight utterance makes replies overlap.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  // Leaving the page mid-sentence should not keep the voice running.
  useEffect(() => {
    return () => {
      if (synthesisAvailable()) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    isRecognitionSupported,
    isSynthesisSupported,
    isListening,
    isSpeaking,
    transcript,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}

/* -------------------------------------------------------------------------- */
/* useWakeWord                                                                 */
/* -------------------------------------------------------------------------- */

export interface UseWakeWordOptions {
  enabled: boolean;
  onDetected: () => void;
  /** Lowercase phrases that trigger. Matched against normalised speech. */
  phrases?: string[];
  lang?: string;
}

export interface UseWakeWord {
  isSupported: boolean;
  /** True while the background recogniser actually holds the microphone. */
  isActive: boolean;
  /** Set when the browser refused the microphone, so the UI can stop offering it. */
  error: string | null;
  /**
   * Clears a previous refusal and starts the loop again. Call this only from a
   * deliberate user action: retrying on its own re-prompts for the microphone
   * over and over.
   */
  retry: () => void;
}

const DEFAULT_WAKE_PHRASES = ['hey optimizer', 'hey optimiser'];

/** Lowercases and strips punctuation so "Hey, Optimizer!" still matches. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Background listener that opens the assistant when it hears the wake phrase.
 *
 * This holds the microphone open for as long as it is enabled, so the caller is
 * expected to give the operator a way to turn it off, and to disable it while
 * the assistant itself is dictating. Recognition sessions end on their own after
 * a stretch of silence, so the loop restarts itself.
 */
export function useWakeWord(options: UseWakeWordOptions): UseWakeWord {
  const { enabled, onDetected, phrases = DEFAULT_WAKE_PHRASES, lang = 'en-US' } = options;

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by retry() to force the effect to build a fresh recogniser.
  const [retryNonce, setRetryNonce] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  // Once the browser refuses the mic, retrying just spams the console.
  const blockedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  const isSupported = getRecognitionCtor() !== null;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !enabled || blockedRef.current) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let disposed = false;

    const clearRestart = () => {
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };

    const start = () => {
      if (disposed || blockedRef.current || micIsBusy() || !enabledRef.current) return;
      try {
        recognition.start();
      } catch {
        // Already running, or the browser is still tearing down the last
        // session. The onend handler reschedules either way.
      }
    };

    const scheduleRestart = () => {
      clearRestart();
      // A small gap: restarting synchronously inside onend spins the CPU when
      // the microphone is unavailable.
      restartTimerRef.current = window.setTimeout(start, 400);
    };

    recognition.onstart = () => {
      if (!disposed) setIsActive(true);
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const heard = normalise(event.results[i][0]?.transcript ?? '');
        if (!heard) continue;
        if (phrasesRef.current.some((phrase) => heard.includes(phrase))) {
          try {
            recognition.stop();
          } catch {
            // Stopping a stopped recogniser is not an error worth surfacing.
          }
          onDetectedRef.current();
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        blockedRef.current = true;
        setError(
          'Microphone access was blocked, so the wake word is off. Allow the ' +
            'microphone in your browser, then switch the wake word off and on ' +
            'again to retry.'
        );
        setIsActive(false);
      }
    };

    recognition.onend = () => {
      if (disposed) return;
      setIsActive(false);
      scheduleRestart();
    };

    // Dictation takes priority: pause here while it holds the microphone, and
    // pick the loop back up when it lets go.
    const unsubscribe = subscribeToMic((busy) => {
      if (busy) {
        clearRestart();
        try {
          recognition.stop();
        } catch {
          // Not running.
        }
      } else {
        scheduleRestart();
      }
    });

    start();

    return () => {
      disposed = true;
      unsubscribe();
      clearRestart();
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null;
      setIsActive(false);
    };
  }, [enabled, lang, retryNonce]);

  const retry = useCallback(() => {
    blockedRef.current = false;
    setError(null);
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  return { isSupported, isActive, error, retry };
}
