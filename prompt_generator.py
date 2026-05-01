#!/usr/bin/env python3
"""
Prompt Generator — local replication of Anthropic's Console prompt tools.
Supports multiple LLM providers: Anthropic, OpenAI, Groq, Gemini, and any OpenAI-compatible API.

Modes:
  generate  — Turn a task description into a full prompt template
  improve   — Refine an existing prompt

Providers:
  anthropic  — Uses ANTHROPIC_API_KEY  (default model: claude-opus-4-7)
  openai     — Uses OPENAI_API_KEY     (default model: gpt-4o)
  groq       — Uses GROQ_API_KEY       (default model: llama-3.3-70b-versatile)
  gemini     — Uses GOOGLE_API_KEY     (default model: gemini-2.5-flash)
  custom     — Uses CUSTOM_API_KEY + --base-url (any OpenAI-compatible endpoint)
"""

import argparse
import os
import re
import sys
from abc import ABC, abstractmethod

# ---------------------------------------------------------------------------
# Meta-prompts (sourced from Anthropic's published metaprompt notebook)
# ---------------------------------------------------------------------------

CLARIFYING_QUESTIONS_GENERATE_PROMPT = """A user wants to build an AI prompt for the following task.

<task_description>
{task}
</task_description>

Your job is to write a better PROMPT — not to answer the task itself.
The clarifying questions you ask must help you understand how to CONSTRUCT
the prompt — not what the prompt's output should contain.

Then identify information gaps that would most significantly change how
the prompt is written. Ask only the gaps that, if unanswered, would lead to a fundamentally different prompt.  Output ONLY up to 3 questions prioritized as high to low and as a numbered list, one per line. Each question should offer 2–4 concrete answer options inline (e.g. "Fresher / Mid-level / Senior"). No preamble, no commentary."""

CLARIFYING_QUESTIONS_IMPROVE_PROMPT = """A user wants to improve an existing AI prompt.

<existing_prompt>
{prompt}
</existing_prompt>

Identify the information gaps that would most significantly change how the prompt is improved — things like intended audience, missing depth, desired output format, or tone. Ask only the gaps that, if unanswered, would lead to a fundamentally different improvement.

Output ONLY up to 3 questions as a numbered list, one per line. Each question should offer 2–4 concrete answer options inline (e.g. "More structured / More concise / Add examples"). No preamble, no commentary."""

CONTEXT_SECTION = """
Here is additional context provided by the user that should inform the prompt:

<user_context>
{qa_pairs}
</user_context>
"""

GENERATE_META_PROMPT = """Your task is to generate a prompt based on a user-provided task description.

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
Generate a complete, ready-to-use prompt template for this task. Output only the prompt itself — no preamble, explanation, or commentary. The prompt should be written in second person."""


IMPROVE_META_PROMPT = """Your task is to improve an existing prompt by making it clearer, more structured, and more effective.

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
Output only the improved prompt — no preamble, explanation, or commentary."""

FEEDBACK_SECTION = """
Here is feedback about what is currently wrong or could be better:

<feedback>
{feedback}
</feedback>
"""


# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------

PROVIDERS = {
    "anthropic": {
        "env_key": "ANTHROPIC_API_KEY",
        "default_model": "claude-opus-4-7",
        "label": "Anthropic",
    },
    "openai": {
        "env_key": "OPENAI_API_KEY",
        "default_model": "gpt-4o",
        "label": "OpenAI",
    },
    "groq": {
        "env_key": "GROQ_API_KEY",
        "default_model": "llama-3.3-70b-versatile",
        "base_url": "https://api.groq.com/openai/v1",
        "label": "Groq",
    },
    "gemini": {
        "env_key": "GOOGLE_API_KEY",
        "default_model": "gemini-2.5-flash",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "label": "Google Gemini",
    },
    "custom": {
        "env_key": "CUSTOM_API_KEY",
        "default_model": "",
        "label": "Custom (OpenAI-compatible)",
    },
}


class LLMProvider(ABC):
    @abstractmethod
    def stream(self, system: str, user: str, model: str, silent: bool = False) -> str:
        """Stream a response and return the full text."""


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key)

    def stream(self, system: str, user: str, model: str, silent: bool = False) -> str:
        full_text = ""
        with self.client.messages.stream(
            model=model,
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as s:
            for event in s:
                if event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        if not silent:
                            print(event.delta.text, end="", flush=True)
                        full_text += event.delta.text
        if not silent:
            print()
        return full_text


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, api_key: str, base_url=None):
        from openai import OpenAI
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = OpenAI(**kwargs)

    def stream(self, system: str, user: str, model: str, silent: bool = False) -> str:
        full_text = ""
        s = self.client.chat.completions.create(
            model=model,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            stream=True,
        )
        for chunk in s:
            delta = chunk.choices[0].delta.content or ""
            if not silent:
                print(delta, end="", flush=True)
            full_text += delta
        if not silent:
            print()
        return full_text


def build_provider(provider_name: str, base_url=None):
    """Instantiate the right provider and return (provider, default_model)."""
    cfg = PROVIDERS[provider_name]
    api_key = os.environ.get(cfg["env_key"], "")

    if not api_key:
        print(f"\n[Error] {cfg['env_key']} is not set.")
        print(f"  export {cfg['env_key']}=\"your-key-here\"\n")
        sys.exit(1)

    if provider_name == "anthropic":
        return AnthropicProvider(api_key), cfg["default_model"]

    url = base_url or cfg.get("base_url")
    return OpenAICompatibleProvider(api_key, url), cfg["default_model"]


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

SYSTEM_GENERATE = "You are an expert prompt engineer. Your only output is the prompt — nothing else."
SYSTEM_IMPROVE  = "You are an expert prompt engineer. Your only output is the improved prompt — nothing else."
SYSTEM_CLARIFY  = "You are an expert prompt engineer. Your only output is the numbered list of questions — nothing else."


def run_generate(provider: LLMProvider, model: str, task: str, context: str = "", silent: bool = False) -> str:
    context_section = CONTEXT_SECTION.format(qa_pairs=context) if context else ""
    user = GENERATE_META_PROMPT.format(task=task, context_section=context_section)
    return provider.stream(SYSTEM_GENERATE, user, model, silent=silent)


def run_improve(provider: LLMProvider, model: str, prompt: str, feedback: str = "", context: str = "", silent: bool = False) -> str:
    context_section = CONTEXT_SECTION.format(qa_pairs=context) if context else ""
    feedback_section = FEEDBACK_SECTION.format(feedback=feedback) if feedback else "\n"
    user = IMPROVE_META_PROMPT.format(prompt=prompt, context_section=context_section, feedback_section=feedback_section)
    return provider.stream(SYSTEM_IMPROVE, user, model, silent=silent)


def get_clarifying_questions(provider: LLMProvider, model: str, task_or_prompt: str, mode: str) -> list[str]:
    """Ask the LLM to generate clarifying questions. Returns a list of question strings."""
    if mode == "generate":
        user = CLARIFYING_QUESTIONS_GENERATE_PROMPT.format(task=task_or_prompt)
    else:
        user = CLARIFYING_QUESTIONS_IMPROVE_PROMPT.format(prompt=task_or_prompt)
    raw = provider.stream(SYSTEM_CLARIFY, user, model, silent=True)
    questions = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        # Strip leading "1.", "2.", "1)", etc.
        cleaned = re.sub(r"^\d+[\.\)]\s*", "", line)
        if cleaned:
            questions.append(cleaned)
    return questions[:10]


def ask_clarifying_questions(questions: list[str]) -> str:
    """Present questions to the user interactively. Returns formatted Q&A context string."""
    if not questions:
        return ""
    print("\n" + "─" * 60)
    print("Clarifying Questions  (press Enter to skip any)")
    print("─" * 60 + "\n")
    qa_pairs = []
    for i, question in enumerate(questions, 1):
        print(f"Q{i}: {question}")
        try:
            answer = input("    Your answer: ").strip()
        except EOFError:
            answer = ""
        if answer:
            qa_pairs.append(f"Q: {question}\nA: {answer}")
        print()
    return "\n\n".join(qa_pairs)


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def read_multiline(prompt_text: str) -> str:
    print(prompt_text)
    print("(Press Enter twice when done)\n")
    lines = []
    while True:
        line = input()
        if line == "" and lines and lines[-1] == "":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def pick_provider_interactively() -> str:
    names = list(PROVIDERS.keys())
    print("Select a provider:")
    for i, name in enumerate(names, 1):
        cfg = PROVIDERS[name]
        default = f"  (default model: {cfg['default_model']})" if cfg["default_model"] else ""
        print(f"  {i}. {cfg['label']}{default}")
    print()
    while True:
        raw = input(f"Provider [1-{len(names)}]: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(names):
            return names[int(raw) - 1]
        if raw in names:
            return raw
        print(f"  Please enter a number between 1 and {len(names)}.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Prompt Generator — supports Anthropic, OpenAI, Groq, Gemini, and more",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Providers & required env vars:
  anthropic   ANTHROPIC_API_KEY   (default: claude-opus-4-7)
  openai      OPENAI_API_KEY      (default: gpt-4o)
  groq        GROQ_API_KEY        (default: llama-3.3-70b-versatile)
  gemini      GOOGLE_API_KEY      (default: gemini-2.5-pro-preview-03-25)
  custom      CUSTOM_API_KEY      (requires --base-url)

Examples:
  python3 prompt_generator.py generate --provider anthropic
  python3 prompt_generator.py generate --provider openai --task "Classify support tickets"
  python3 prompt_generator.py generate --provider groq --model mixtral-8x7b-32768
  python3 prompt_generator.py improve  --provider openai --prompt "Summarize {{text}}" --feedback "Too verbose"
  python3 prompt_generator.py generate --provider custom --base-url http://localhost:11434/v1 --model llama3
        """,
    )
    parser.add_argument("mode", choices=["generate", "improve"], nargs="?",
                        help="'generate' a new prompt or 'improve' an existing one")
    parser.add_argument("--provider", choices=list(PROVIDERS.keys()),
                        help="LLM provider to use")
    parser.add_argument("--model", help="Override the default model for the chosen provider")
    parser.add_argument("--base-url", dest="base_url",
                        help="Base URL for custom OpenAI-compatible endpoints (e.g. Ollama)")
    parser.add_argument("--task", help="Task description (generate mode)")
    parser.add_argument("--prompt", help="Existing prompt to improve (improve mode)")
    parser.add_argument("--feedback", default="", help="Feedback on the prompt (improve mode)")
    args = parser.parse_args()

    # --- Banner ---
    print("\n╔═══════════════════════════════════════╗")
    print("║        AI Prompt Generator            ║")
    print("╚═══════════════════════════════════════╝\n")

    # --- Infer mode from flags ---
    if not args.mode:
        if args.task:
            args.mode = "generate"
        elif args.prompt:
            args.mode = "improve"

    # --- Interactive mode selection ---
    if not args.mode:
        print("What would you like to do?")
        print("  1. Generate a new prompt from a task description")
        print("  2. Improve an existing prompt\n")
        choice = input("Choose (1 or 2): ").strip()
        args.mode = "generate" if choice == "1" else "improve"

    # --- Provider selection ---
    provider_name = args.provider or pick_provider_interactively()
    provider, default_model = build_provider(provider_name, args.base_url)
    model = args.model or default_model

    if not model:
        model = input("\nEnter model name: ").strip()
        if not model:
            print("No model specified. Exiting.")
            sys.exit(1)

    cfg = PROVIDERS[provider_name]
    print(f"Provider : {cfg['label']}")
    print(f"Model    : {model}\n")

    # --- Run ---
    if args.mode == "generate":
        task = args.task or read_multiline("Describe the task you want the AI to perform:")
        if not task:
            print("No task provided. Exiting.")
            sys.exit(1)

        context = ""
        if not args.task:  # interactive mode only
            print("\nGenerating clarifying questions...")
            questions = get_clarifying_questions(provider, model, task, mode="generate")
            context = ask_clarifying_questions(questions)

        print("\n" + "─" * 60)
        print("Generated Prompt:")
        print("─" * 60 + "\n")
        run_generate(provider, model, task, context)

    else:  # improve
        existing = args.prompt or read_multiline("Paste your existing prompt:")
        if not existing:
            print("No prompt provided. Exiting.")
            sys.exit(1)

        context = ""
        if not args.prompt:  # interactive mode only
            print("\nGenerating clarifying questions...")
            questions = get_clarifying_questions(provider, model, existing, mode="improve")
            context = ask_clarifying_questions(questions)

        feedback = args.feedback
        if not feedback and not args.prompt:
            print("Optional: describe what's wrong or what to improve.")
            print("(Press Enter to skip)\n")
            try:
                feedback = input("Feedback: ").strip()
            except EOFError:
                feedback = ""

        print("\n" + "─" * 60)
        print("Improved Prompt:")
        print("─" * 60 + "\n")
        run_improve(provider, model, existing, feedback, context)


if __name__ == "__main__":
    main()
