import json
import os
import structlog
from cryptography.fernet import Fernet
from app.config import get_settings

logger = structlog.get_logger()

def get_fernet_instance() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        try:
            key = get_settings().encryption_key
        except Exception:
            key = None
    if not key:
        logger.warning("ENCRYPTION_KEY not set in environment, generating transient key.")
        key = Fernet.generate_key().decode()
    return Fernet(key.encode('utf-8') if isinstance(key, str) else key)

def encrypt_text(plain_text: str) -> str:
    """Encrypt a plain text string into a Fernet base64 string."""
    if not plain_text:
        return ""
    f = get_fernet_instance()
    return f.encrypt(plain_text.encode('utf-8')).decode('utf-8')

def decrypt_text(cipher_text: str) -> str:
    """Decrypt a Fernet base64 string into plain text."""
    if not cipher_text:
        return ""
    try:
        f = get_fernet_instance()
        return f.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception as e:
        logger.error("Failed to decrypt text", error=str(e))
        return "[DATOS CIFRADOS / CLAVE INVÁLIDA]"

def encrypt_json(data: dict) -> str:
    """Serialize dict to JSON string and encrypt into Fernet base64 string."""
    if not data:
        return ""
    json_str = json.dumps(data)
    return encrypt_text(json_str)

def decrypt_json(cipher_text: str) -> dict:
    """Decrypt Fernet base64 string and parse JSON into dict."""
    if not cipher_text:
        return {}
    decrypted_str = decrypt_text(cipher_text)
    if decrypted_str.startswith("[DATOS"):
        return {"raw": decrypted_str}
    try:
        return json.loads(decrypted_str)
    except Exception:
        return {"raw": decrypted_str}
