"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data: Providers) => {
        setProviders(data);
        const defaultProvider = "groq";
        if (data[defaultProvider]) {
          setModel(data[defaultProvider].default_model);
        }
      })
      .catch(() => setError("Failed to connect to backend. Is the server running?"));
  }, []);

  const handleProviderChange = (key: string) => {
    setProvider(key);
    if (providers[key]) {
      setModel(providers[key].default_model);
    }
  };

  const resetToInput = () => {
    setStep("input");
    setResult("");
    setError("");
    setQuestions([]);
    setAnswers({});
  };

  const handleGetQuestions = async () => {
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
          base_url: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "An error occurred.");
      } else {
        setQuestions(data.questions || []);
        setAnswers({});
        setStep("clarifying");
      }
    } catch {
      setError("Network error. Is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  const buildContext = (): string => {
    const pairs: string[] = [];
    questions.forEach((q, i) => {
      const a = answers[i]?.trim();
      if (a) {
        pairs.push(`Q: ${q}\nA: ${a}`);
      }
    });
    return pairs.join("\n\n");
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    const context = buildContext();
    const endpoint = mode === "generate" ? "/api/generate" : "/api/improve";
    const body =
      mode === "generate"
        ? { provider, model, task, context, base_url: baseUrl || undefined }
        : { provider, model, prompt, feedback, context, base_url: baseUrl || undefined };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "An error occurred.");
      } else {
        setResult(data.result);
        setStep("result");
      }
    } catch {
      setError("Network error. Is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSubmitInput =
    !loading && (mode === "generate" ? task.trim().length > 0 : prompt.trim().length > 0);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Prompt Generator</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Generate and improve AI prompts using your preferred LLM provider.
        </p>
      </div>

      {/* Mode tabs — only show on input step */}
      {step === "input" && (
        <div className="flex gap-2 mb-6">
          {(["generate", "improve"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(""); setError(""); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
              <label className="block text-xs text-gray-400 mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(providers).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model name"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Base URL for custom */}
          {provider === "custom" && (
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Input area */}
          {mode === "generate" ? (
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Task description</label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={5}
                placeholder="Describe the task you want the AI to perform…"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Existing prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  placeholder="Paste your existing prompt here…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  Feedback <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="What should be improved? e.g. Too verbose, needs examples…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </div>
            </>
          )}

          {/* Get clarifying questions button */}
          <button
            onClick={handleGetQuestions}
            disabled={!canSubmitInput}
            className="w-full py-2.5 px-4 rounded-md font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {loading ? "Getting questions…" : "Next: Answer Clarifying Questions"}
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
                // Split question text from inline options: "Question text? Option A / Option B / Option C"
                const qmarkIdx = q.indexOf("?");
                const questionText = qmarkIdx !== -1 ? q.slice(0, qmarkIdx + 1).trim() : q;
                const afterQ = qmarkIdx !== -1 ? q.slice(qmarkIdx + 1).trim() : "";
                const options = afterQ
                  ? afterQ.split(/\s*\/\s*/).map((o) => o.trim()).filter(Boolean)
                  : [];
                const selected = answers[i] ?? "";

                return (
                  <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-md p-4">
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
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                              selected === opt
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-gray-900 border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-white"
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
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetToInput}
              className="flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-2 flex-grow py-2.5 px-4 rounded-md font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {loading ? "Generating…" : mode === "generate" ? "Generate Prompt" : "Improve Prompt"}
            </button>
          </div>
        </>
      )}

      {/* ── STEP: RESULT ── */}
      {step === "result" && result && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Result
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={resetToInput}
                  className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Start over
                </button>
              </div>
            </div>
            <pre className="bg-gray-900 border border-gray-700 rounded-md p-4 text-sm text-gray-200 whitespace-pre-wrap overflow-auto max-h-[60vh]">
              {result}
            </pre>
          </div>
        </>
      )}

      {/* Error banner */}
      {error && (
        <div className="mt-4 flex items-start gap-3 bg-red-900/40 border border-red-700 rounded-md px-4 py-3 text-sm text-red-300">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-200 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
