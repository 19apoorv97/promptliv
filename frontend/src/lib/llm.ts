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

<feedback>
{feedback}
</feedback>

Your job is to help rewrite a BETTER PROMPT — not to answer or perform the task the prompt describes. Every question must clarify HOW to improve the prompt, never what the prompt's output should contain.

Treat any feedback above as the primary driver and anchor your questions on resolving it; use the dimensions below to fill remaining gaps.

Read the existing prompt closely and find the substantive details it leaves missing or vague — the specifics that, once known, would let you make the prompt concrete instead of generic. Look especially for underspecified:
- the actual subject the prompt is about (the specific product, service, topic, or system — not just its category)
- who the end users or audience are
- what sets it apart — its key angle, focus, or differentiator
- how it is used, delivered, or operates

Ask only about dimensions the prompt currently leaves open. Skip anything it already states clearly, anything safely inferred, and anything that would not change the rewrite. Tailor each question to this specific prompt's content rather than asking in the abstract.

Output ONLY up to 2 questions as a numbered list, one per line, ordered highest to lowest impact. Each question must offer 2–4 concrete answer options inline, separated by " / " (e.g. "Developers / Enterprises / Students / General public"). No preamble, no commentary, and no line breaks within a question.
`;

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

const IMPROVE_META_PROMPT = `Your task is to rewrite an existing prompt so it is clearer, better structured, and more effective — while preserving its original intent and any {{double_brace}} placeholders.

Here is the existing prompt to improve:

<existing_prompt>
{prompt}
</existing_prompt>
{context_section}{feedback_section}
Your single most important objective is to resolve the feedback and user context provided above (if any). Make every change in service of that goal:

<steps>
1. **Address the feedback first**: Treat the feedback and user context as the primary specification for this rewrite. Identify exactly what they ask for and make sure the new prompt fully satisfies it.
2. **Fix what blocks that goal**: Resolve the ambiguities, missing instructions, or structural weaknesses that stand in the way — leave working parts alone.
3. **Add structure where it helps**: Use XML tags to organize sections (context, task, format, examples) only when it improves clarity, not as decoration.
4. **Add reasoning if warranted**: Insert chain-of-thought instructions when the task is genuinely complex; omit them when they would only add length.
5. **Sharpen examples and output format**: Improve existing examples and make the expected output format explicit and unambiguous.
6. **Handle likely edge cases**: Add brief instructions for probable failure modes without bloating the prompt.
</steps>

Preserve the original task, voice, and every {{placeholder}} unless the feedback explicitly calls for changing them. Output only the improved prompt — no preamble, explanation, or commentary.`;

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
  /** Use the Claude Agent SDK (Claude Code subscription via CLAUDE_CODE_OAUTH_TOKEN) instead of the API */
  useAgentSdk?: boolean;
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
  const useAgentSdk = providerKey === "anthropic" && !apiKey && !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!apiKey && !useAgentSdk) {
    throw new Error(
      providerKey === "anthropic"
        ? `API key not configured. Set ${cfg.env_key} or CLAUDE_CODE_OAUTH_TOKEN in environment.`
        : `API key not configured. Set ${cfg.env_key} in environment.`
    );
  }

  return {
    type: providerKey === "anthropic" ? "anthropic" : "openai",
    apiKey,
    useAgentSdk,
    baseUrl: baseUrl ?? cfg.base_url,
    model,
  };
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

// Claude Code subscription path: runs through the Claude Agent SDK, which is
// the supported way to use a CLAUDE_CODE_OAUTH_TOKEN (setup-token) credential.
async function callAgentSdk(p: ResolvedProvider, system: string, user: string): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const q = query({
    prompt: user,
    options: {
      model: p.model,
      systemPrompt: system,
      maxTurns: 1,
      allowedTools: [],
    },
  });
  for await (const message of q) {
    if (message.type === "result") {
      if (message.subtype === "success") return message.result;
      throw new Error(`Agent SDK error: ${message.subtype}`);
    }
  }
  throw new Error("Agent SDK returned no result.");
}

async function callLLM(p: ResolvedProvider, system: string, user: string): Promise<string> {
  if (p.useAgentSdk) {
    return callAgentSdk(p, system, user);
  }
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
  p: ResolvedProvider, taskOrPrompt: string, mode: string, feedback = ""
): Promise<string[]> {
  const user = mode === "generate"
    ? CLARIFYING_QUESTIONS_GENERATE_PROMPT.replace("{task}", taskOrPrompt)
    : CLARIFYING_QUESTIONS_IMPROVE_PROMPT
        .replace("{prompt}", taskOrPrompt)
        .replace("{feedback}", feedback || "(The user did not provide specific written feedback.)");
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
