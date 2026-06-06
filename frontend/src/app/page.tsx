"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Mode = "generate" | "improve";
type Step = "input" | "clarifying" | "result";

interface ProviderConfig {
  label: string;
  env_key: string;
  default_model: string;
  base_url?: string;
}

interface Providers {
  [key: string]: ProviderConfig;
}

const BYOK_PROVIDERS = [
  {
    id: "groq",
    label: "Groq (Free tier available)",
    keyPrefix: "gsk_",
    defaultModel: "llama-3.3-70b-versatile",
    signupUrl: "https://console.groq.com/keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyPrefix: "sk-ant-",
    defaultModel: "claude-opus-4-7",
    signupUrl: "https://console.anthropic.com/",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyPrefix: "sk-",
    defaultModel: "gpt-4o",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyPrefix: "AIza",
    defaultModel: "gemini-2.0-flash",
    signupUrl: "https://aistudio.google.com/apikey",
  },
];

const USE_CASES = [
  {
    icon: "💬",
    title: "ChatGPT Prompt Generator",
    description:
      "Generate structured prompts for GPT-4o and GPT-4 Turbo. Get context-rich instructions that unlock ChatGPT's full potential on any task.",
  },
  {
    icon: "🤖",
    title: "Claude Prompt Generator",
    description:
      "Build XML-structured prompts tailored for Anthropic's Claude. Prompt engineering techniques matched to Claude's reasoning and instruction-following style.",
  },
  {
    icon: "🖼️",
    title: "Image Prompt Generator",
    description:
      "Create detailed visual prompts for DALL·E, Midjourney, Stable Diffusion, and Adobe Firefly. Describe style, lighting, mood, and composition.",
  },
  {
    icon: "🎬",
    title: "Video Prompt Generator",
    description:
      "Craft cinematic scene descriptions for Sora, Runway, Pika, and Kling AI. Specify camera movement, pacing, and visual tone.",
  },
  {
    icon: "📝",
    title: "Text Prompt Generator",
    description:
      "Generate prompts for writing, summarizing, analyzing, and classifying text. Works seamlessly across all major AI models.",
  },
  {
    icon: "🎲",
    title: "Random Prompt Generator",
    description:
      "Not sure where to start? Explore a random prompt for any topic or task — ideal for brainstorming, creativity, and experimentation.",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Describe your task",
    description:
      "Write what you want the AI to do in plain English. No technical prompt engineering knowledge required.",
  },
  {
    title: "Answer a few questions",
    description:
      "Promptliv asks targeted clarifying questions to shape the tone, format, and context of your prompt.",
  },
  {
    title: "Get your optimized prompt",
    description:
      "Copy your prompt and paste it into ChatGPT, Claude, Gemini, or any other AI model — instantly.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What is a prompt generator?",
    a: "A prompt generator is a tool that uses prompt engineering techniques to craft precise, structured instructions for AI models. You describe your goal in plain English and the tool builds an optimized prompt ready to use with any AI.",
  },
  {
    q: "Is Promptliv free to use?",
    a: "Yes. Promptliv offers 5 free prompt generations with no login required. For unlimited use, connect your own API key from Groq (free tier available), Anthropic, OpenAI, or Google Gemini.",
  },
  {
    q: "Can I use it as a ChatGPT prompt generator?",
    a: "Absolutely. Promptliv generates structured prompts optimized for ChatGPT (GPT-4o), Claude, Gemini, Groq, and any OpenAI-compatible endpoint. Switch providers anytime.",
  },
  {
    q: "Does it work as an image prompt generator?",
    a: "Yes. Describe your image concept and Promptliv crafts a detailed visual prompt optimized for DALL·E, Midjourney, Stable Diffusion, and Adobe Firefly.",
  },
  {
    q: "Can I generate video prompts?",
    a: "Yes. Use Promptliv as a video prompt generator to create scene descriptions and cinematic prompts for Sora, Runway, Pika, and Kling AI.",
  },
  {
    q: "What is prompt engineering?",
    a: "Prompt engineering is the practice of designing and refining inputs to get the best possible outputs from AI models. Promptliv automates this using Anthropic's published metaprompt framework, asking clarifying questions to build a high-quality prompt for your task.",
  },
];

const FREE_LIMIT = 5;
const LS_COUNT = "promptliv-usage-count";
const LS_KEY = "promptliv-byok-key";
const LS_PROVIDER = "promptliv-byok-provider";

const STEPS: Step[] = ["input", "clarifying", "result"];
const STEP_LABELS = ["Input", "Questions", "Result"];

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    el.style.transition = `opacity 0.65s ease-out ${delay}ms, transform 0.65s ease-out ${delay}ms`;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("generate");
  const [step, setStep] = useState<Step>("input");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("");
  const [task, setTask] = useState("");
  const [prompt, setPrompt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [providers, setProviders] = useState<Providers>({});
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // BYOK + free tier state
  const [usageCount, setUsageCount] = useState(0);
  const [byokKey, setByokKey] = useState("");
  const [byokProvider, setByokProvider] = useState("groq");
  const [showByokModal, setShowByokModal] = useState(false);
  const [showByokSettings, setShowByokSettings] = useState(false);
  const [byokInput, setByokInput] = useState("");
  const [byokProviderInput, setByokProviderInput] = useState("groq");
  const [byokVerifying, setByokVerifying] = useState(false);
  const [byokVerified, setByokVerified] = useState(false);
  const [byokShowKey, setByokShowKey] = useState(false);
  const [byokError, setByokError] = useState("");
  const [showNudge, setShowNudge] = useState(false);

  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // Init from localStorage
  useEffect(() => {
    const count = parseInt(localStorage.getItem(LS_COUNT) || "0", 10);
    const key = localStorage.getItem(LS_KEY) || "";
    const prov = localStorage.getItem(LS_PROVIDER) || "groq";
    setUsageCount(count);
    setByokKey(key);
    setByokProvider(prov);
    if (key) {
      setByokInput(key);
      setByokProviderInput(prov);
      setByokVerified(true);
    }
    if (count >= FREE_LIMIT && !key) {
      setShowNudge(true);
    }
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    if (!showByokSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setShowByokSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showByokSettings]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data: Providers) => {
        setProviders(data);
        if (data["groq"]) setModel(data["groq"].default_model);
      })
      .catch(() => setError("Failed to connect to backend. Is the server running?"));
  }, []);

  const handleProviderChange = (key: string) => {
    setProvider(key);
    if (providers[key]) setModel(providers[key].default_model);
  };

  const resetToInput = useCallback(() => {
    setStep("input");
    setResult("");
    setError("");
    setQuestions([]);
    setAnswers({});
  }, []);

  const incrementUsage = useCallback(() => {
    setUsageCount((prev) => {
      const newCount = prev + 1;
      localStorage.setItem(LS_COUNT, String(newCount));
      if (newCount >= FREE_LIMIT) setShowNudge(true);
      return newCount;
    });
  }, []);

  const handleConnectByok = async () => {
    setByokError("");
    setByokVerifying(true);
    const provConfig = BYOK_PROVIDERS.find((p) => p.id === byokProviderInput);
    const testModel = provConfig?.defaultModel || "llama-3.3-70b-versatile";
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: byokProviderInput,
          model: testModel,
          task_or_prompt: "test",
          mode: "generate",
          byok_key: byokInput,
          byok_provider: byokProviderInput,
        }),
      });
      if (res.ok) {
        setByokKey(byokInput);
        setByokProvider(byokProviderInput);
        setByokVerified(true);
        localStorage.setItem(LS_KEY, byokInput);
        localStorage.setItem(LS_PROVIDER, byokProviderInput);
        setShowByokModal(false);
        setShowByokSettings(false);
        setShowNudge(false);
      } else {
        const data = await res.json();
        setByokError(data.detail || "Key verification failed. Check your key and provider.");
      }
    } catch {
      setByokError("Network error. Is the backend running?");
    } finally {
      setByokVerifying(false);
    }
  };

  const handleDisconnectByok = () => {
    setByokKey("");
    setByokProvider("groq");
    setByokInput("");
    setByokProviderInput("groq");
    setByokVerified(false);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_PROVIDER);
    if (usageCount >= FREE_LIMIT) setShowNudge(true);
  };

  // Core generation API call, shared by handleSubmit and the zero-questions fast-path
  const executeGenerate = useCallback(
    async (contextStr: string) => {
      if (!byokKey && usageCount >= FREE_LIMIT) {
        setShowByokModal(true);
        return;
      }
      setError("");
      setLoading(true);
      const endpoint = mode === "generate" ? "/api/generate" : "/api/improve";
      const body =
        mode === "generate"
          ? { provider, model, task, context: contextStr, base_url: baseUrl || undefined, byok_key: byokKey || null, byok_provider: byokKey ? byokProvider : null }
          : { provider, model, prompt, feedback, context: contextStr, base_url: baseUrl || undefined, byok_key: byokKey || null, byok_provider: byokKey ? byokProvider : null };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) setShowByokModal(true);
          else setError(data.detail || "An error occurred.");
        } else {
          setResult(data.result);
          setStep("result");
          if (!byokKey) incrementUsage();
        }
      } catch {
        setError("Network error. Is the backend running on port 8000?");
      } finally {
        setLoading(false);
      }
    },
    [byokKey, usageCount, mode, provider, model, task, prompt, feedback, baseUrl, byokProvider, incrementUsage]
  );

  const handleGetQuestions = useCallback(async () => {
    setError("");
    setLoading(true);
    const taskOrPrompt = mode === "generate" ? task : prompt;
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          task_or_prompt: taskOrPrompt,
          mode,
          feedback: mode === "improve" ? feedback : undefined,
          base_url: baseUrl || undefined,
          byok_key: byokKey || null,
          byok_provider: byokKey ? byokProvider : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setShowByokModal(true);
        else setError(data.detail || "An error occurred.");
        setLoading(false);
      } else {
        const qs: string[] = data.questions || [];
        setQuestions(qs);
        setAnswers({});
        if (qs.length === 0) {
          // No clarifications needed — jump straight to generate
          await executeGenerate("");
        } else {
          setStep("clarifying");
          setLoading(false);
        }
      }
    } catch {
      setError("Network error. Is the backend running on port 8000?");
      setLoading(false);
    }
  }, [mode, task, prompt, feedback, provider, model, baseUrl, byokKey, byokProvider, executeGenerate]);

  const handleSubmit = useCallback(async () => {
    const pairs: string[] = [];
    questions.forEach((q, i) => {
      const a = answers[i]?.trim();
      if (a) pairs.push(`Q: ${q}\nA: ${a}`);
    });
    await executeGenerate(pairs.join("\n\n"));
  }, [executeGenerate, questions, answers]);

  const handleImproveResult = useCallback(() => {
    setMode("improve");
    setPrompt(result);
    resetToInput();
  }, [result, resetToInput]);

  // Keyboard shortcut: Cmd/Ctrl + Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (step === "input" && canSubmitInput) handleGetQuestions();
        else if (step === "clarifying" && !loading) handleSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loading, handleGetQuestions, handleSubmit]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSubmitInput =
    !loading && (mode === "generate" ? task.trim().length > 0 : prompt.trim().length > 0);

  const connectedProviderLabel = BYOK_PROVIDERS.find((p) => p.id === byokProvider)?.label || byokProvider;

  // XML tag highlighting for result display
  const getHighlightedResult = (text: string) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped.replace(
      /&lt;\/?[a-zA-Z][^&]*?&gt;/g,
      '<span class="text-indigo-400">$&</span>'
    );
  };

  const resultWords = result.trim() ? result.trim().split(/\s+/).length : 0;
  const resultChars = result.length;

  // ---------------------------------------------------------------------------
  // BYOK key input form (reused in both settings panel and modal)
  // ---------------------------------------------------------------------------
  const ByokKeyForm = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Provider</label>
        <select
          value={byokProviderInput}
          onChange={(e) => { setByokProviderInput(e.target.value); setByokError(""); }}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        >
          {BYOK_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">API Key</label>
        <div className="relative">
          <input
            type={byokShowKey ? "text" : "password"}
            value={byokInput}
            onChange={(e) => { setByokInput(e.target.value); setByokError(""); }}
            placeholder={`${BYOK_PROVIDERS.find((p) => p.id === byokProviderInput)?.keyPrefix}...`}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 pr-14"
          />
          <button
            type="button"
            onClick={() => setByokShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs px-1"
          >
            {byokShowKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {byokError && <p className="text-xs text-red-400">{byokError}</p>}
      <button
        onClick={handleConnectByok}
        disabled={byokVerifying || !byokInput.trim()}
        className="w-full py-2.5 px-3 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {byokVerifying && (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {byokVerifying ? "Verifying…" : "Verify & Connect"}
      </button>
    </div>
  );

  return (
    <>
      {/* BYOK Modal */}
      {showByokModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">You&apos;ve used your 5 free generations</h2>
            <p className="text-gray-400 text-sm mb-5">
              Add your own API key to keep going — it&apos;s free for most providers.
            </p>

            <div className="space-y-2 mb-5">
              {BYOK_PROVIDERS.map((p) => (
                <a
                  key={p.id}
                  href={p.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <span>{p.label}</span>
                  <span className="text-xs text-gray-500">Get API key →</span>
                </a>
              ))}
            </div>

            <ByokKeyForm />

            <button
              onClick={() => setShowByokModal(false)}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        <section className="min-h-screen snap-start bg-gradient-to-b from-gray-950 via-gray-950 to-gray-900">
        <main className="max-w-2xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <svg className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  AI Prompt Generator
                </h1>
              </div>
              <p className="text-gray-500 text-sm">
                Free prompt generator powered by prompt engineering. Works with ChatGPT, Claude, Gemini &amp; Groq.
              </p>
            </div>

            {/* API Key button + settings panel */}
            <div className="relative shrink-0" ref={settingsPanelRef}>
              <button
                onClick={() => { setShowByokSettings((v) => !v); setByokError(""); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  byokVerified && byokKey
                    ? "bg-green-900/30 border-green-700 text-green-300"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600"
                }`}
              >
                {byokVerified && byokKey ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                    {connectedProviderLabel}
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                    API Key
                  </>
                )}
              </button>

              {showByokSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-40 p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">API Key Settings</h3>
                  {byokVerified && byokKey ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                        <span className="text-green-300 text-sm">Connected: {connectedProviderLabel}</span>
                      </div>
                      <button
                        onClick={handleDisconnectByok}
                        className="w-full py-2 px-3 text-sm text-red-400 border border-red-800 rounded-lg hover:bg-red-900/30 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <ByokKeyForm />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Nudge banner */}
          {showNudge && !byokKey && (
            <div className="mb-6 flex items-center justify-between bg-amber-900/20 border border-amber-700/60 rounded-xl px-4 py-3 text-sm text-amber-300">
              <span>
                You&apos;ve used your {FREE_LIMIT} free generations. Add your key to continue.
              </span>
              <button
                onClick={() => setShowByokModal(true)}
                className="ml-4 shrink-0 text-xs bg-amber-700/50 hover:bg-amber-700 px-3 py-1.5 rounded-lg text-amber-200 transition-colors"
              >
                Add Key
              </button>
            </div>
          )}

          {/* Main card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/50 p-8">
            {/* Step Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center">
                {STEPS.map((s, idx) => {
                  const stepIdx = STEPS.indexOf(step);
                  const isActive = s === step;
                  const isCompleted = idx < stepIdx;
                  return (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all ${
                          isCompleted
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                            : isActive
                            ? "bg-indigo-600 border-2 border-indigo-400 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-gray-800 border border-gray-700 text-gray-500"
                        }`}
                      >
                        {isCompleted ? (
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className={`flex-1 h-px mx-2 ${idx < stepIdx ? "bg-indigo-600" : "bg-gray-800"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs mt-2.5">
                {STEP_LABELS.map((label, idx) => {
                  const stepIdx = STEPS.indexOf(step);
                  const isActive = idx === stepIdx;
                  const isCompleted = idx < stepIdx;
                  return (
                    <span key={label} className={isActive ? "text-indigo-400 font-medium" : isCompleted ? "text-gray-400" : "text-gray-600"}>
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Mode tabs — only show on input step */}
            {step === "input" && (
              <div className="flex bg-gray-800 p-1 rounded-lg mb-6">
                {(["generate", "improve"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setResult(""); setError(""); }}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                      mode === m
                        ? "bg-gray-700 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {m === "generate" ? "Generate" : "Improve"}
                  </button>
                ))}
              </div>
            )}

            {/* ── STEP: INPUT ── */}
            {step === "input" && (
              <>
                {/* Provider + Model */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Provider</label>
                    {Object.keys(providers).length === 0 ? (
                      <div className="animate-pulse bg-gray-800/60 border border-gray-700 rounded-lg h-9" />
                    ) : (
                      <select
                        value={provider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      >
                        {Object.entries(providers).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Model</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Model name"
                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                  </div>
                </div>

                {/* Base URL for custom */}
                {provider === "custom" && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Base URL</label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                  </div>
                )}

                {/* Input area */}
                {mode === "generate" ? (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Task description</label>
                    <textarea
                      value={task}
                      onChange={(e) => setTask(e.target.value)}
                      rows={5}
                      placeholder="Describe the task you want the AI to perform…"
                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                    />
                    <p className="text-xs text-gray-600 text-right mt-1">{task.length} chars</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Existing prompt</label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={6}
                        placeholder="Paste your existing prompt here…"
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                      />
                      <p className="text-xs text-gray-600 text-right mt-1">{prompt.length} chars</p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                        Feedback <span className="text-gray-600 normal-case font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={3}
                        placeholder="What should be improved? e.g. Too verbose, needs examples…"
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={handleGetQuestions}
                  disabled={!canSubmitInput}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                  {loading ? "Getting questions…" : "Continue"}
                  {!loading && <span className="opacity-50 text-xs ml-1">⌘↵</span>}
                </button>
              </>
            )}

            {/* ── STEP: CLARIFYING QUESTIONS ── */}
            {step === "clarifying" && (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                      Before we proceed
                    </h2>
                    <span className="text-xs text-gray-500">All optional — skip to generate directly</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Your answers will shape the prompt. Click an option or type a custom answer.
                  </p>
                  <div className="space-y-5">
                    {questions.map((q, i) => {
                      const qmarkIdx = q.indexOf("?");
                      const questionText = qmarkIdx !== -1 ? q.slice(0, qmarkIdx + 1).trim() : q;
                      const afterQ = qmarkIdx !== -1 ? q.slice(qmarkIdx + 1).trim() : "";
                      const options = afterQ
                        ? afterQ.split(/\s*\/\s*/).map((o) => o.trim()).filter(Boolean)
                        : [];
                      const selected = answers[i] ?? "";

                      return (
                        <div key={i} className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-5">
                          <p className="text-sm text-gray-200 mb-3">
                            <span className="text-indigo-400 font-medium mr-1">Q{i + 1}.</span>
                            {questionText}
                          </p>
                          {options.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {options.map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [i]: prev[i] === opt ? "" : opt,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                    selected === opt
                                      ? "bg-indigo-600 border-indigo-500 text-white"
                                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-indigo-500 hover:text-white"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                          <input
                            type="text"
                            value={selected}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                            placeholder={options.length > 0 ? "Or type a custom answer…" : "Your answer (optional)…"}
                            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetToInput}
                    className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-2 flex-grow py-2.5 px-4 rounded-xl font-semibold text-sm transition-all disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    )}
                    {loading ? "Generating…" : mode === "generate" ? "Generate Prompt" : "Improve Prompt"}
                    {!loading && <span className="opacity-50 text-xs ml-1">⌘↵</span>}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP: RESULT ── */}
            {step === "result" && result && (
              <div>
                <div className="rounded-xl overflow-hidden border border-gray-700/60">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Generated Prompt · {resultWords}w · {resultChars}c
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 transition-colors"
                      >
                        {copied ? (
                          <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        )}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={handleImproveResult}
                        className="text-xs px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 transition-colors"
                      >
                        Improve
                      </button>
                      <button
                        onClick={resetToInput}
                        className="text-xs px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 transition-colors"
                      >
                        Start over
                      </button>
                    </div>
                  </div>
                  <pre
                    className="bg-gray-950 px-5 py-5 text-sm text-gray-200 whitespace-pre-wrap overflow-auto max-h-[65vh] font-mono leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: getHighlightedResult(result) }}
                  />
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mt-4 flex items-start gap-3 bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
                <span className="flex-1">{error}</span>
                <button onClick={() => setError("")} className="text-red-400 hover:text-red-200 shrink-0">
                  ✕
                </button>
              </div>
            )}
          </div>
        </main>
        </section>

        {/* ── SEO CONTENT SECTIONS ── */}
        <section className="min-h-screen snap-start bg-gray-950 border-t border-gray-800/60">
          <div className="max-w-4xl mx-auto px-4 py-16 space-y-20">

            {/* What is a Prompt Generator */}
            <ScrollReveal>
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  What is an AI Prompt Generator?
                </h2>
                <p className="text-gray-400 leading-relaxed max-w-2xl">
                  A <strong className="text-gray-200">prompt generator</strong> is a tool that uses{" "}
                  <strong className="text-gray-200">prompt engineering</strong> techniques to craft
                  precise, structured instructions for AI models. Instead of guessing what to type,
                  describe your goal in plain English — Promptliv asks a few clarifying questions and
                  builds an optimized prompt ready to paste into any AI.
                </p>
              </section>
            </ScrollReveal>

            {/* Use Cases */}
            <section>
              <ScrollReveal>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Prompt Generator for Every Use Case
                </h2>
                <p className="text-gray-500 text-sm mb-8">One tool. Every AI. Every format.</p>
              </ScrollReveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {USE_CASES.map((uc, i) => (
                  <ScrollReveal key={uc.title} delay={i * 80}>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/40 transition-colors h-full">
                      <div className="text-2xl mb-3">{uc.icon}</div>
                      <h3 className="text-sm font-semibold text-white mb-1.5">{uc.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{uc.description}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </section>

            {/* How It Works */}
            <section>
              <ScrollReveal>
                <h2 className="text-2xl font-bold text-white mb-8">How It Works</h2>
              </ScrollReveal>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step, i) => (
                  <ScrollReveal key={i} delay={i * 100}>
                    <div className="flex gap-4">
                      <div className="shrink-0 h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        {i + 1}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <section>
              <ScrollReveal>
                <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
              </ScrollReveal>
              <div className="space-y-4">
                {FAQ_ITEMS.map((item, i) => (
                  <ScrollReveal key={item.q} delay={i * 60}>
                    <div className="border border-gray-800 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-2">{item.q}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </section>

          </div>
        </section>

      </div>
    </>
  );
}
