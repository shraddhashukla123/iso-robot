from typing import Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class LLMService:
    """
    Unified LLM service — swap provider by changing LLM_PROVIDER in .env.
    Supports: anthropic | openai
    """

    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.temperature = settings.LLM_TEMPERATURE
        self._client = None

    def _get_client(self):
        if self._client:
            return self._client

        if self.provider == "anthropic":
            import anthropic
            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        elif self.provider == "openai":
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

        return self._client

    async def complete(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        client = self._get_client()
        max_tok = max_tokens or self.max_tokens
        temp = temperature if temperature is not None else self.temperature

        try:
            if self.provider == "anthropic":
                response = client.messages.create(
                    model=self.model,
                    max_tokens=max_tok,
                    system=system_prompt or "You are a helpful AI assistant.",
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.content[0].text

            elif self.provider == "openai":
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                response = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tok,
                    temperature=temp,
                )
                return response.choices[0].message.content

        except Exception as e:
            logger.error(f"LLM call failed [{self.provider}]: {e}")
            raise

    async def complete_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> dict:
        import json
        system = (system_prompt or "") + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        raw = await self.complete(prompt, system_prompt=system)
        try:
            clean = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(clean)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed: {e} | raw: {raw[:200]}")
            raise ValueError(f"LLM returned invalid JSON: {e}")


llm_service = LLMService()
