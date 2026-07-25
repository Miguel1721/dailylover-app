import httpx
import structlog
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

async def generate_gemini_summary(prompt: str, api_key: str) -> str:
    """
    Llama a la API de Google Gemini (2.5 Flash) usando httpx.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 800
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                try:
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return text.strip()
                except (KeyError, IndexError) as parse_err:
                    logger.error("gemini_parse_error", error=str(parse_err), response=data)
                    return f"Error al procesar respuesta de Gemini: {str(parse_err)}"
            else:
                logger.error("gemini_api_error", status_code=res.status_code, body=res.text)
                return f"Error de API Gemini (Código {res.status_code}): {res.text[:100]}"
        except Exception as e:
            logger.error("gemini_api_exception", error=str(e))
            return f"Excepción al conectar con Gemini: {str(e)}"
