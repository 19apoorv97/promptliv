import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Provider config (mirrors prompt_generator.py PROVIDERS dict)
// ---------------------------------------------------------------------------

export const PROVIDERS: Record<string, { env_key: string; default_model: string; label: string; base_url?: string }> = {
  anthropic: { env_key: "ANTHROPIC_API_KEY", default_model: "claude-opus-4-7", label: "Anthropic" },
  openai:    { env_key: "OPENAI_API_KEY",    default_model: "gpt-4o",           label: "OpenAI" },
  groq:      { env_key: "GROQ_API_KEY",      default_model: "llama-3.3-70b-versatile", label: "Groq",           base_url: "https://api.groq.com/openai/v1" },
  gemini:    { env_key: "GOOGLE_API_KEY",    default_model: "gemini-2.5-flash", label: "Google Gemini",   base_url: "https://generativelanguage.googleapis.com/v1beta/openai/" },
  custom:    { env_key: "CUSTOM_API_KEY",    default_model: "",                 label: "Custom (OpenAI-compatible)" },
};

// ---------------------------------------------------------------------------
// Meta-prompts (copied from prompt_generator.py)
// ---------------------------------------------------------------------------

const CLARIFYING_QUESTIONS_GENERATE_PROMPT = `A user wants to build an AI prompt for the following task.

<task_description>
{task}
</task_description>

Your job is to write a better PROMPT — not to answer the task itself.
The clarifying questions you ask must help you understand how to CONSTRUCT
the prompt — not what the prompt's output should contain.

Then identify information gaps that would most significantly change how
the prompt is written. Ask only the gaps that, if unanswered, would lead to a fundamentally different prompt.  Output ONLY up to 3 questions prioritized as high to low and as a numbered list, one per line. Each question should offer 2–4 concrete answer options inline (e.g. "Fresher / Mid-level / Senior"). No preamble, no commentary.`;

const CLARIFYING_QUESTIONS_IMPROVE_PROMPT = `A user wants to improve an existing AI prompt.

<existing_prompt>
{prompt}
</existing_prompt>

Identify the information gaps that would most significantly change how the prompt is improved — things like intended audience, missing depth, desired output format, or tone. Ask only the gaps that, if unanswered, would lead to a fundamentally different improvement.

Output ONLY up to 3 questions as a numbered list, one per line. Each question should offer 2–4 concrete answer options inline (e.g. "More structured / More concise / Add examples"). No preamble, no commentary.`;

const CONTEXT_SECTION = `
Here is additional context provided by the user that should inform the prompt:

<user_context>
{qa_pairs}
</user_context>
`;

const GENERATE_META_PROMPT = `Your task is to generate a prompt based on a user-provided task description.

The prompt you create should be a high-quality template that instructs an LLM to perform the task well. Follow these guidelines:

<guidelines>
1. Use clear and precise language.
2. Structure the prompt with XML tags to separate components (context, instructions, examples, output format).
3. Include {{double_brace}} placeholders for any dynamic content that will vary between uses.
4. Add a detailed description of the desired output format.
5. If helpful, include a step-by-step reasoning section to guide the model through complex tasks.
6. Anticipate edge cases and add instructions for handling them.
7. Keep instructions positive ("do X") rather than negative ("don't do Y") where possible.
8. If the task involves classification, extraction, or analysis, instruct the model to show its reasoning before giving the final answer.
9. For tasks that benefit from examples, include 1-3 illustrative examples in the prompt.
10. End the prompt with a clear call to action.
</guidelines>

Here is the task description provided by the user:

<task_description>
{task}
</task_description>
{context_section}
Generate a complete, ready-to-use prompt template for this task. Output only the prompt itself — no preamble, explanation, or commentary. The prompt should be written in second person.`;

const IMPROVE_META_PROMPT = `Your task is to improve an existing prompt by making it clearer, more structured, and more effective.

Follow these improvement steps:

<steps>
1. **Identify issues**: Find ambiguities, missing instructions, or structural weaknesses.
2. **Add structure**: Use XML tags to organize sections (context, task, format, examples).
3. **Add chain-of-thought**: Insert reasoning instructions if the task is complex.
4. **Improve examples**: If examples exist, enhance them to show step-by-step reasoning.
5. **Clarify output format**: Make the expected output format explicit and unambiguous.
6. **Handle edge cases**: Add instructions for likely edge cases or failure modes.
</steps>

Here is the existing prompt to improve:

<existing_prompt>
{prompt}
</existing_prompt>
{context_section}{feedback_section}
Output only the improved prompt — no preamble, explanation, or commentary.`;

const FEEDBACK_SECTION = `
Here is feedback about what is currently wrong or could be better:

<feedback>
{feedback}
</feedback>
`;

const SYSTEM_GENERATE = "You are an expert prompt engineer. Your only output is the prompt — nothing else.";
const SYSTEM_IMPROVE  = "You are an expert prompt engineer. Your only output is the improved prompt — nothing else.";
const SYSTEM_CLARIFY  = "You are an expert prompt engineer. Your only output is the numbered list of questions — nothing else.";

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

interface ResolvedProvider {
  type: "anthropic" | "openai";
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export function resolveProvider(body: Record<string, unknown>): ResolvedProvider {
  const byokKey = body.byok_key as string | null;
  const byokProvider = body.byok_provider as string | null;
  const providerKey = (byokKey ? byokProvider : null) ?? (body.provider as string) ?? "groq";
  let model = (body.model as string) ?? "";
  const baseUrl = body.base_url as string | undefined;

  const cfg = PROVIDERS[providerKey];
  if (!cfg) throw new Error(`Unknown provider: ${providerKey}`);
  if (!model) model = cfg.default_model;
  if (!model) throw new Error("No model specified and provider has no default model.");

  const apiKey = byokKey ?? process.env[cfg.env_key] ?? "";
  if (!apiKey) throw new Error(`API key not configured. Set ${cfg.env_key} in environment.`);

  return {
    type: providerKey === "anthropic" ? "anthropic" : "openai",
    apiKey,
    baseUrl: baseUrl ?? cfg.base_url,
    model,
  };
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callLLM(p: ResolvedProvider, system: string, user: string): Promise<string> {
  if (p.type === "anthropic") {
    const client = new Anthropic({ apiKey: p.apiKey });
    const res = await client.messages.create({
      model: p.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    return res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
  } else {
    const client = new OpenAI({ apiKey: p.apiKey, ...(p.baseUrl ? { baseURL: p.baseUrl } : {}) });
    const res = await client.chat.completions.create({
      model: p.model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0].message.content ?? "";
  }
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function getClarifyingQuestions(
  p: ResolvedProvider, taskOrPrompt: string, mode: string
): Promise<string[]> {
  const user = mode === "generate"
    ? CLARIFYING_QUESTIONS_GENERATE_PROMPT.replace("{task}", taskOrPrompt)
    : CLARIFYING_QUESTIONS_IMPROVE_PROMPT.replace("{prompt}", taskOrPrompt);
  const raw = await callLLM(p, SYSTEM_CLARIFY, user);
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+[\.\)]\s*/, ""))
    .filter(Boolean)
    .slice(0, 10);
}

export async function runGenerate(
  p: ResolvedProvider, task: string, context = ""
): Promise<string> {
  const contextSection = context ? CONTEXT_SECTION.replace("{qa_pairs}", context) : "";
  const user = GENERATE_META_PROMPT
    .replace("{task}", task)
    .replace("{context_section}", contextSection);
  return callLLM(p, SYSTEM_GENERATE, user);
}

export async function runImprove(
  p: ResolvedProvider, prompt: string, feedback = "", context = ""
): Promise<string> {
  const contextSection = context ? CONTEXT_SECTION.replace("{qa_pairs}", context) : "";
  const feedbackSection = feedback ? FEEDBACK_SECTION.replace("{feedback}", feedback) : "\n";
  const user = IMPROVE_META_PROMPT
    .replace("{prompt}", prompt)
    .replace("{context_section}", contextSection)
    .replace("{feedback_section}", feedbackSection);
  return callLLM(p, SYSTEM_IMPROVE, user);
}
