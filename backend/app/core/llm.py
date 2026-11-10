from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, TypeVar

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# HTTP error codes considered transient and retryable
TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


class GroqKeyPool:
    """
    Manages automated key rotation and instant failover across configured Groq API keys.
    Provides 2x (or Nx) throughput and prevents 429 rate limit stalls.
    """
    def __init__(self):
        self._index = 0
        self._lock = asyncio.Lock()

    def get_keys(self) -> list[str]:
        keys = settings.groq_api_keys
        return [k for k in keys if k.strip()]

    async def get_active_key(self) -> str:
        keys = self.get_keys()
        if not keys:
            return ""
        async with self._lock:
            key = keys[self._index % len(keys)]
            self._index = (self._index + 1) % len(keys)
            return key

    async def rotate_on_rate_limit(self, failed_key: str) -> str:
        keys = self.get_keys()
        if len(keys) <= 1:
            return failed_key
        async with self._lock:
            for k in keys:
                if k != failed_key:
                    logger.warning(
                        f"429 Rate limit detected on Groq key (...{failed_key[-6:]}). "
                        f"Instantly rotating to key pool member (...{k[-6:]})"
                    )
                    return k
            return failed_key


key_pool = GroqKeyPool()


def _repair_truncated_json(raw: str) -> str:
    """Repair truncated JSON strings caused by token cutoff."""
    text = raw.strip()
    in_string = False
    escape = False
    for char in text:
        if char == "\\" and not escape:
            escape = True
            continue
        if char == '"' and not escape:
            in_string = not in_string
        escape = False

    repaired = text
    if in_string:
        repaired += '"'

    open_braces = repaired.count("{") - repaired.count("}")
    open_brackets = repaired.count("[") - repaired.count("]")

    repaired += "]" * max(0, open_brackets)
    repaired += "}" * max(0, open_braces)
    return repaired


def extract_json_from_llm(raw_text: str) -> dict[str, Any] | list[Any]:
    """
    Resilient JSON extractor that parses JSON from LLM responses even if
    wrapped in markdown code blocks, conversational preambles, or truncated.
    """
    text = raw_text.strip()

    # 1. Match code blocks ```json ... ``` or ``` ... ```
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if code_block_match:
        extracted = code_block_match.group(1).strip()
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            try:
                return json.loads(_repair_truncated_json(extracted))
            except json.JSONDecodeError:
                pass  # Fall through to brace matching

    # 2. Match the outermost JSON object { ... } or array [ ... ]
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    first_bracket = text.find("[")
    last_bracket = text.rfind("]")

    start_idx = -1
    end_idx = -1

    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        start_idx = first_brace
        end_idx = last_brace + 1 if last_brace != -1 else len(text)
    elif first_bracket != -1:
        start_idx = first_bracket
        end_idx = last_bracket + 1 if last_bracket != -1 else len(text)

    if start_idx != -1 and end_idx > start_idx:
        candidate = text[start_idx:end_idx].strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                try:
                    return json.loads(_repair_truncated_json(candidate))
                except json.JSONDecodeError:
                    pass

    # 3. Direct parse attempt with repair
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_repair_truncated_json(text))


def _is_transient_error(exc: Exception) -> bool:
    """Check if an exception is a transient network or rate-limiting error."""
    exc_str = str(exc).lower()
    if any(term in exc_str for term in ["rate limit", "429", "503", "timeout", "timed out", "connection reset", "tpm", "rpm"]):
        return True
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in TRANSIENT_STATUS_CODES:
        return True
    return False


MODEL_CASCADE = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]


def _get_next_cascade_model(current_model: str) -> str | None:
    """Return the next model in the failover cascade, or None if exhausted."""
    try:
        idx = MODEL_CASCADE.index(current_model)
        if idx + 1 < len(MODEL_CASCADE):
            return MODEL_CASCADE[idx + 1]
    except ValueError:
        return MODEL_CASCADE[1] if len(MODEL_CASCADE) > 1 else None
    return None


def get_llm(
    temperature: float | None = None,
    model: str | None = None,
    max_tokens: int | None = None,
    timeout: int | None = None,
    api_key: str | None = None,
) -> ChatGroq:
    """
    Factory function returning a configured ChatGroq instance.
    Defaults to settings.GROQ_MODEL (openai/gpt-oss-120b).
    """
    selected_key = api_key or settings.GROQ_API_KEY
    chosen_model = model or settings.GROQ_MODEL
    effective_max_tokens = max_tokens or settings.LLM_MAX_TOKENS

    # Models with tight OTPM (like qwen3.8-27b with 1000 token limit) must be clamped
    if "qwen" in chosen_model.lower() and effective_max_tokens > 850:
        effective_max_tokens = 850

    return ChatGroq(
        groq_api_key=selected_key,
        model_name=chosen_model,
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_tokens=effective_max_tokens,
        request_timeout=timeout or settings.LLM_TIMEOUT_SECONDS,
    )


async def invoke_structured_llm(
    prompt: str | list[BaseMessage],
    schema_class: type[T],
    temperature: float | None = None,
    model: str | None = None,
    max_tokens: int | None = None,
    max_retries: int = 3,
) -> T:
    """
    Invoke Groq LLM with strict structured output, automated multi-key rotation,
    and multi-tier model failover cascade.
    
    1. Selects active key from the pool via round-robin.
    2. If a key hits 429 rate limit, rotates immediately to another key in the pool.
    3. If a model reaches quota limits (TPD/TPM/OTPM), fails over to next cascade model:
       openai/gpt-oss-120b -> openai/gpt-oss-20b -> qwen/qwen3.8-27b.
    4. Primary path: llm.with_structured_output(schema_class, method="json_mode").
    5. Fallback path: raw invocation -> extract_json_from_llm -> schema_class.model_validate.
    """
    current_key = await key_pool.get_active_key()
    available_keys = key_pool.get_keys()
    current_model = model or settings.GROQ_MODEL

    schema_instruction = (
        f"\nYou MUST respond with a valid JSON object strictly conforming to the following JSON schema:\n"
        f"```json\n{json.dumps(schema_class.model_json_schema(), indent=2)}\n```\n"
        f"Output ONLY the valid JSON object, with no conversational preamble or markdown postscript."
    )

    if isinstance(prompt, str):
        full_prompt = prompt + "\n" + schema_instruction
        messages: list[BaseMessage] = [HumanMessage(content=full_prompt)]
    else:
        messages = list(prompt)
        if messages and isinstance(messages[-1], HumanMessage):
            last_msg = messages[-1]
            messages[-1] = HumanMessage(content=str(last_msg.content) + "\n" + schema_instruction)
        else:
            messages.append(HumanMessage(content=schema_instruction))

    last_error: Exception | None = None
    for attempt in range(max_retries + 2):
        llm = get_llm(temperature=temperature, model=current_model, max_tokens=max_tokens, api_key=current_key)
        structured_llm = llm.with_structured_output(schema_class, method="json_mode")

        try:
            result = await structured_llm.ainvoke(messages)
            if isinstance(result, schema_class):
                return result
            if isinstance(result, dict):
                return schema_class.model_validate(result)
            raise ValueError(f"Unexpected output type from structured LLM: {type(result)}")

        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # 1. Model-level Token Limit (TPD / TPM / OTPM / 413) failover
            is_quota_or_tpm = (
                "tpd" in err_str 
                or "tokens per day" in err_str 
                or "otpm" in err_str 
                or "output tokens per minute" in err_str
                or "tpm" in err_str
                or "tokens per minute" in err_str
                or "413" in err_str
                or "request too large" in err_str
            )
            next_model = _get_next_cascade_model(current_model)
            if is_quota_or_tpm and next_model:
                logger.warning(
                    f"Model '{current_model}' reached quota/TPM limit ({e}). "
                    f"Instantly failing over to cascade model: '{next_model}'"
                )
                current_model = next_model
                continue

            # 2. Key-level Rate Limit (RPM) failover
            is_rate_limit = "429" in err_str or "rate limit" in err_str
            if is_rate_limit:
                if next_model:
                    logger.warning(f"Rate limit hit on '{current_model}'. Failing over to cascade model: '{next_model}'")
                    current_model = next_model
                    continue
                if len(available_keys) > 1:
                    new_key = await key_pool.rotate_on_rate_limit(current_key)
                    if new_key != current_key:
                        logger.info(f"Switching from key ...{current_key[-6:]} to key ...{new_key[-6:]} due to rate limit.")
                        current_key = new_key
                        continue

            retry_match = re.search(r"try again in ([\d\.]+)s", err_str)
            if retry_match and attempt < max_retries:
                wait_secs = min(float(retry_match.group(1)) + 1.0, 30.0)
                logger.warning(f"Groq rate limit window: waiting {wait_secs:.1f}s before retry...")
                await asyncio.sleep(wait_secs)
                continue

            if _is_transient_error(e) and attempt < max_retries:
                backoff = (2 ** attempt) * 1.5
                logger.warning(
                    f"Transient Groq error on key ...{current_key[-6:]} (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                    f"Retrying in {backoff}s..."
                )
                await asyncio.sleep(backoff)
                continue

            logger.info(f"Structured output primary path failed ({e}). Attempting fallback JSON extraction...")
            try:
                raw_response = await llm.ainvoke(messages)
                raw_content = raw_response.content if hasattr(raw_response, "content") else str(raw_response)
                extracted_data = extract_json_from_llm(raw_content)
                return schema_class.model_validate(extracted_data)
            except Exception as fallback_err:
                logger.error(f"Fallback JSON extraction failed: {fallback_err}")
                last_error = fallback_err
                if attempt >= max_retries:
                    raise last_error

    if last_error:
        raise last_error
    raise RuntimeError("Failed to invoke structured LLM after retries.")
