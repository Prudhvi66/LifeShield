import asyncio
import ssl

from openai import AsyncOpenAI, DefaultAsyncHttpx2Client
from app.config import get_settings

async def main():
    settings = get_settings()

    print("API key loaded:", bool(settings.openai_api_key))
    print("Model:", settings.openai_model)

    ssl_context = ssl.create_default_context()

    http_client = DefaultAsyncHttpx2Client(
        verify=ssl_context,
        timeout=30.0,
    )

    async with AsyncOpenAI(
        api_key=settings.openai_api_key,
        http_client=http_client,
    ) as client:
        response = await client.responses.create(
            model=settings.openai_model,
            input="Say hello to LifeShield in one short sentence."
        )

        print("SUCCESS")
        print("OpenAI response:")
        print(response.output_text)

if __name__ == "__main__":
    asyncio.run(main())
