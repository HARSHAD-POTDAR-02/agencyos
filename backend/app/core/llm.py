from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, TypeVar, get_origin, get_args

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
try:
    from langchain_nvidia_ai_endpoints import ChatNVIDIA
except ImportError:
    ChatNVIDIA = None
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

    # If it ends with an unclosed colon (e.g. '"key":' or '"key": '), complete with null
    repaired = re.sub(r':\s*$', ': null', repaired)
    # Strip any trailing comma
    repaired = re.sub(r',\s*$', '', repaired)

    stack = []
    in_str = False
    esc = False
    for char in repaired:
        if char == "\\" and not esc:
            esc = True
            continue
        if char == '"' and not esc:
            in_str = not in_str
        elif not in_str:
            if char in ("{", "["):
                stack.append("}" if char == "{" else "]")
            elif char in ("}", "]"):
                if stack and stack[-1] == char:
                    stack.pop()
        esc = False

    repaired += "".join(reversed(stack))
    # Remove trailing commas right before closing brackets/braces
    repaired = re.sub(r',\s*([}\]])', r'\1', repaired)
    return repaired


def extract_json_from_llm(raw_text: str) -> dict[str, Any] | list[Any]:
    """
    Resilient JSON extractor that parses JSON from LLM responses even if
    wrapped in markdown code blocks, conversational preambles, trailing commentary,
    or truncated.
    """
    text = re.sub(r"<think>[\s\S]*?</think>", "", raw_text, flags=re.IGNORECASE).strip()
    decoder = json.JSONDecoder(strict=False)

    # 1. Match code blocks ```json ... ``` or ``` ... ```
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if code_block_match:
        extracted = code_block_match.group(1).strip()
        try:
            return json.loads(extracted, strict=False)
        except json.JSONDecodeError as exc:
            if "Extra data" in exc.msg:
                try:
                    return json.loads(extracted[:exc.pos].strip(), strict=False)
                except Exception:
                    pass
            try:
                obj, _ = decoder.raw_decode(extracted)
                return obj
            except Exception:
                pass
            try:
                return json.loads(_repair_truncated_json(extracted), strict=False)
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

    if start_idx != -1:
        # First attempt: raw_decode directly from the opening token to ignore trailing text
        try:
            obj, _ = decoder.raw_decode(text[start_idx:])
            return obj
        except Exception:
            pass

        if end_idx > start_idx:
            candidate = text[start_idx:end_idx].strip()
            try:
                return json.loads(candidate, strict=False)
            except json.JSONDecodeError as exc:
                if "Extra data" in exc.msg:
                    try:
                        return json.loads(candidate[:exc.pos].strip(), strict=False)
                    except Exception:
                        pass
                cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
                try:
                    return json.loads(cleaned, strict=False)
                except json.JSONDecodeError:
                    try:
                        return json.loads(_repair_truncated_json(candidate), strict=False)
                    except json.JSONDecodeError:
                        pass

    # 3. Direct parse attempt with raw_decode, slice on Extra data, and repair
    try:
        obj, _ = decoder.raw_decode(text)
        return obj
    except Exception:
        pass

    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError as exc:
        if "Extra data" in exc.msg:
            try:
                return json.loads(text[:exc.pos].strip(), strict=False)
            except Exception:
                pass
        try:
            return json.loads(_repair_truncated_json(text), strict=False)
        except json.JSONDecodeError:
            pass

    try:
        import ast
        val = ast.literal_eval(text)
        if isinstance(val, (dict, list)):
            return val
    except Exception:
        pass

    return json.loads(_repair_truncated_json(text), strict=False)


def _is_transient_error(exc: Exception) -> bool:
    """Check if an exception is a transient network, timeout, or rate-limiting error."""
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return True
    exc_type_str = type(exc).__name__.lower()
    if "timeout" in exc_type_str:
        return True
    exc_str = str(exc).lower()
    if any(term in exc_str for term in ["rate limit", "429", "500", "502", "503", "504", "timeout", "timed out", "connection reset", "tpm", "rpm", "overloaded"]):
        return True
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in TRANSIENT_STATUS_CODES:
        return True
    return False


MODEL_CASCADE = [
    "minimaxai/minimax-m3.1-flash",
    "openai/gpt-oss-120b",
    "nvidia/nemotron-3.5-bolt-e4b",
]

CAMPAIGN_MODELS: dict[str, dict[str, Any]] = {
    "strategy": {
        "model": "minimaxai/minimax-m3.1-flash",
        "temperature": 0.55,
        "max_tokens": 5000,
    },
    "content_creation": {
        "model": "minimaxai/minimax-m3.1-flash",
        "temperature": 0.70,
        "max_tokens": 7000,
    },
    "creative_evaluation": {
        "model": "openai/gpt-oss-120b",
        "temperature": 0.15,
        "max_tokens": 3000,
    },
    "fallback": {
        "model": "openai/gpt-oss-120b",
        "temperature": 0.30,
        "max_tokens": 4096,
    },
}


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
) -> BaseChatModel:
    """
    Factory function returning a configured LLM chat model instance.
    Routes to NVIDIA NIM (ChatOpenAI) if model starts with 'nvidia/' or 'mistralai/',
    otherwise defaults to ChatGroq.
    """
    chosen_model = model or settings.GROQ_MODEL
    effective_max_tokens = max_tokens or settings.LLM_MAX_TOKENS
    effective_temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    effective_timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    # 1. NVIDIA NIM Router
    is_nvidia_model = any(
        chosen_model.startswith(prefix) 
        for prefix in ("nvidia/", "mistralai/", "minimaxai/", "meta/", "deepseek-ai/")
    )
    if is_nvidia_model:
        nvidia_key = api_key if (api_key and api_key.startswith("nvapi-")) else settings.NVIDIA_API_KEY
        token_limit = max(effective_max_tokens, 4096)
        
        # MiniMax models: Use ChatOpenAI directly with reasoning_effort="low" for clean low-latency streaming
        if chosen_model.startswith("minimaxai/"):
            return ChatOpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=nvidia_key,
                model=chosen_model,
                temperature=effective_temp,
                max_tokens=token_limit,
                timeout=max(effective_timeout, 120),
                extra_body={"reasoning_effort": "low"},
            )

        if ChatNVIDIA is not None:
            return ChatNVIDIA(
                model=chosen_model,
                api_key=nvidia_key,
                temperature=effective_temp,
                max_completion_tokens=token_limit,
                top_p=0.95,
                timeout=max(effective_timeout, 120),
            )
        kwargs: dict[str, Any] = {
            "base_url": settings.NVIDIA_BASE_URL,
            "api_key": nvidia_key,
            "model": chosen_model,
            "temperature": effective_temp,
            "max_tokens": token_limit,
            "timeout": timeout or 120,
        }
        if "nemotron" in chosen_model.lower():
            kwargs["reasoning_effort"] = "low"
        return ChatOpenAI(**kwargs)

    # 2. Groq Router
    selected_key = api_key if (api_key and not api_key.startswith("nvapi-")) else settings.GROQ_API_KEY
    if "qwen" in chosen_model.lower() and effective_max_tokens > 850:
        effective_max_tokens = 850

    return ChatGroq(
        groq_api_key=selected_key,
        model_name=chosen_model,
        temperature=effective_temp,
        max_tokens=effective_max_tokens,
        request_timeout=effective_timeout,
    )


def generate_clean_json_template(model_class: type[Any]) -> dict[str, Any]:
    """Generate a clean, compact example JSON template from a Pydantic model without $defs."""
    if not (isinstance(model_class, type) and issubclass(model_class, BaseModel)):
        return {}
    sample: dict[str, Any] = {}
    for name, field in model_class.model_fields.items():
        annotation = field.annotation
        origin = get_origin(annotation)
        args = get_args(annotation)

        if origin is not None and type(None) in args:
            non_none = [a for a in args if a is not type(None)]
            if non_none:
                annotation = non_none[0]
                origin = get_origin(annotation)
                args = get_args(annotation)

        if origin is list:
            item_type = args[0] if args else str
            if isinstance(item_type, type) and issubclass(item_type, BaseModel):
                sample[name] = [generate_clean_json_template(item_type)]
            elif hasattr(item_type, "__members__"):
                sample[name] = [list(item_type.__members__.keys())[0].lower()]
            else:
                sample[name] = [f"Example {name}"]
        elif isinstance(annotation, type) and issubclass(annotation, BaseModel):
            sample[name] = generate_clean_json_template(annotation)
        elif hasattr(annotation, "__members__"):
            sample[name] = list(annotation.__members__.keys())[0].lower()
        elif annotation is int:
            sample[name] = 0
        elif annotation is float:
            sample[name] = 0.0
        elif annotation is bool:
            sample[name] = True
        else:
            desc = field.description or name
            sample[name] = desc[:70] if len(desc) > 70 else desc
    return sample


async def invoke_structured_llm(
    prompt: str | list[BaseMessage],
    schema_class: type[T],
    temperature: float | None = None,
    model: str | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    max_retries: int = 3,
) -> T:
    """
    Invoke LLM with strict structured output, automated multi-key rotation,
    and multi-tier model failover cascade across NVIDIA NIM and Groq.
    
    1. Selects active key from the pool via round-robin (for Groq) or NVIDIA_API_KEY (for NVIDIA NIM).
    2. If a key hits 429 rate limit, rotates immediately to another key in the pool.
    3. If a model reaches quota limits (TPD/TPM/OTPM), fails over to next cascade model:
       nvidia/nemotron-3.5-super-vl-120b-a12b -> openai/gpt-oss-120b -> openai/gpt-oss-20b -> qwen/qwen3.8-27b.
    4. Primary path: llm.with_structured_output(schema_class, method="json_mode").
    5. Fallback path: raw invocation -> extract_json_from_llm -> schema_class.model_validate.
    """
    current_key = await key_pool.get_active_key()
    available_keys = key_pool.get_keys()
    current_model = model or settings.GROQ_MODEL

    clean_template = generate_clean_json_template(schema_class)
    if clean_template:
        schema_instruction = (
            f"\nYou MUST respond with a valid JSON object matching the following structure EXACTLY:\n"
            f"```json\n{json.dumps(clean_template, indent=2)}\n```\n"
            f"Output ONLY the valid JSON object, with no conversational preamble or markdown postscript."
        )
    else:
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

    # Dynamic timeout calculation:
    # Scale dynamically using settings.LLM_TIMEOUT_SECONDS and input prompt char volume.
    # Long synthesis prompts (e.g. multi-competitor dossiers) naturally require extended generation time.
    total_prompt_chars = sum(len(str(getattr(m, "content", ""))) for m in messages) if messages else 0
    prompt_scale = (total_prompt_chars / 500.0) * 5.0
    effective_timeout = max(float(timeout or settings.LLM_TIMEOUT_SECONDS), 90.0) + min(60.0, prompt_scale)

    last_error: Exception | None = None
    tried_keys: set[str] = set()

    for attempt in range(max_retries + 2):
        is_nvidia = any(
            current_model.startswith(prefix)
            for prefix in ("nvidia/", "mistralai/", "minimaxai/", "meta/", "deepseek-ai/")
        )
        if not is_nvidia and current_key:
            tried_keys.add(current_key)
        active_key = settings.NVIDIA_API_KEY if is_nvidia else current_key

        try:
            if is_nvidia:
                # NVIDIA NIM: invoke directly with bounded reasoning budget for fast structured generation
                if ChatNVIDIA is not None and not current_model.startswith("minimaxai/"):
                    fast_client = ChatNVIDIA(
                        model=current_model,
                        api_key=active_key,
                        temperature=temperature if temperature is not None else 0.2,
                        max_completion_tokens=max_tokens or 8192,
                        top_p=0.95,
                        timeout=effective_timeout,
                        reasoning_budget=1024,
                    )
                else:
                    fast_client = get_llm(
                        temperature=temperature,
                        model=current_model,
                        max_tokens=max_tokens,
                        timeout=int(effective_timeout),
                        api_key=active_key,
                    )
                raw_response = await asyncio.wait_for(fast_client.ainvoke(messages), timeout=effective_timeout)
                raw_content = raw_response.content if hasattr(raw_response, "content") else str(raw_response)
                extracted_data = extract_json_from_llm(raw_content)
                return schema_class.model_validate(extracted_data)
            else:
                llm = get_llm(
                    temperature=temperature,
                    model=current_model,
                    max_tokens=max_tokens,
                    timeout=int(effective_timeout),
                    api_key=active_key,
                )
                structured_llm = llm.with_structured_output(schema_class, method="json_mode")
                groq_call_timeout = max(effective_timeout * 0.7, 45.0)
                result = await asyncio.wait_for(structured_llm.ainvoke(messages), timeout=groq_call_timeout)
                if isinstance(result, schema_class):
                    return result
                if isinstance(result, dict):
                    return schema_class.model_validate(result)
                raise ValueError(f"Unexpected output type from structured LLM: {type(result)}")

        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # 1. Payload Too Large (413): Fail over to next model immediately without key rotation
            is_payload_too_large = "413" in err_str or "request too large" in err_str
            if is_payload_too_large:
                next_model = _get_next_cascade_model(current_model)
                if next_model:
                    logger.warning(
                        f"Payload too large (413) on '{current_model}'. "
                        f"Failing over to cascade model: '{next_model}' (no key rotation)."
                    )
                    current_model = next_model
                    tried_keys.clear()
                    current_key = await key_pool.get_active_key()
                    continue

            # 2. Rate Limit & Quota (429 / TPM / TPD / OTPM): Rotate through unused pool keys FIRST
            is_quota_or_rate_limit = (
                "429" in err_str 
                or "rate limit" in err_str
                or "tpd" in err_str 
                or "tokens per day" in err_str 
                or "otpm" in err_str 
                or "output tokens per minute" in err_str
                or "tpm" in err_str
                or "tokens per minute" in err_str
            )
            if is_quota_or_rate_limit:
                if not is_nvidia:
                    all_groq_keys = key_pool.get_keys()
                    untried_keys = [k for k in all_groq_keys if k not in tried_keys]
                    if untried_keys:
                        new_key = untried_keys[0]
                        tried_keys.add(new_key)
                        logger.warning(
                            f"Rate limit / TPM on Groq key (...{current_key[-6:] if current_key else 'None'}). "
                            f"Switching to untried key (...{new_key[-6:]}) before model cascade."
                        )
                        current_key = new_key
                        continue

                # All keys exhausted or NVIDIA NIM rate limit: cascade to next model
                next_model = _get_next_cascade_model(current_model)
                if next_model:
                    logger.warning(
                        f"All keys exhausted under rate limit for '{current_model}'. "
                        f"Failing over to cascade model: '{next_model}'"
                    )
                    current_model = next_model
                    tried_keys.clear()
                    current_key = await key_pool.get_active_key()
                    continue

            retry_match = re.search(r"try again in ([\d\.]+)s", err_str)
            if retry_match and attempt < max_retries:
                wait_secs = min(float(retry_match.group(1)) + 1.0, 30.0)
                logger.warning(f"Rate limit window: waiting {wait_secs:.1f}s before retry...")
                await asyncio.sleep(wait_secs)
                continue

            if _is_transient_error(e) and attempt < max_retries:
                transient_cascade = _get_next_cascade_model(current_model)
                if is_nvidia and transient_cascade:
                    logger.warning(
                        f"Transient error on NVIDIA NIM '{current_model}' ({e}). Cascading to '{transient_cascade}'."
                    )
                    current_model = transient_cascade
                    current_key = await key_pool.get_active_key()
                    continue

                backoff = (2 ** attempt) * 1.5
                logger.warning(
                    f"Transient LLM error on '{current_model}' (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                    f"Retrying in {backoff}s..."
                )
                await asyncio.sleep(backoff)
                continue

            # Fallback path for non-NVIDIA models if structured output failed
            if not is_nvidia:
                logger.info(f"Structured output primary path failed ({e}). Attempting fallback JSON extraction...")
                try:
                    fallback_timeout = max(effective_timeout * 0.5, 40.0)
                    raw_response = await asyncio.wait_for(llm.ainvoke(messages), timeout=fallback_timeout)
                    raw_content = raw_response.content if hasattr(raw_response, "content") else str(raw_response)
                    extracted_data = extract_json_from_llm(raw_content)
                    return schema_class.model_validate(extracted_data)
                except Exception as fallback_err:
                    logger.error(f"Fallback JSON extraction failed: {fallback_err}")
                    last_error = fallback_err
                    fallback_cascade = _get_next_cascade_model(current_model)
                    if fallback_cascade:
                        logger.warning(f"Cascading to '{fallback_cascade}' after fallback failure.")
                        current_model = fallback_cascade
                        current_key = await key_pool.get_active_key()
                        continue

            if attempt >= max_retries:
                raise last_error

    if last_error:
        raise last_error
    raise RuntimeError("Failed to invoke structured LLM after retries.")
