#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Cliente en Python para consultar el censo electoral en la Registraduría Nacional del Estado Civil.
Portal objetivo: https://consultacenso.registraduria.gov.co/
"""

import argparse
import json
import os
import re
import sys
import tempfile
from typing import Any, Dict, Optional
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

URL_PORTAL = "https://consultacenso.registraduria.gov.co/"


def consultar_censo(
    documento: str,
    eleccion_id: int = 0,
    timeout_ms: int = 30000,
    headless: bool = False
) -> Dict[str, Any]:
    """
    Consulta el censo electoral para un documento dado utilizando Playwright.
    
    Args:
        documento: Número de documento (sin puntos ni comas).
        eleccion_id: ID de la elección (0 = Lugar de votación actual).
        timeout_ms: Tiempo máximo de espera en milisegundos.
        headless: Si es False, se ejecuta en modo off-screen para evitar
                  detección por Cloudflare Turnstile.
    
    Returns:
        Diccionario con el resultado estructurado de la consulta.
    """
    # Validación previa del formato según reglas del portal oficial (2 a 12 dígitos)
    doc_limpio = re.sub(r"\D", "", str(documento).strip())
    if not doc_limpio or len(doc_limpio) < 2 or len(doc_limpio) > 12:
        return {
            "ok": False,
            "error": "El número de documento debe contener entre 2 y 12 dígitos numéricos."
        }

    temp_dir = tempfile.mkdtemp(prefix="censo_session_")
    
    # Configuración de argumentos de navegador
    launch_args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-infobars"
    ]
    
    # Si no es headless, colocamos la ventana fuera del área visible
    if not headless:
        launch_args.extend([
            "--window-size=1280,800",
            "--window-position=-3000,-3000"
        ])

    try:
        with sync_playwright() as p:
            browser_channel = "chrome" if os.name == "nt" else None
            try:
                context = p.chromium.launch_persistent_context(
                    temp_dir,
                    channel=browser_channel,
                    headless=headless,
                    args=launch_args
                )
            except Exception:
                context = p.chromium.launch_persistent_context(
                    temp_dir,
                    headless=headless,
                    args=launch_args
                )

            page = context.pages[0] if context.pages else context.new_page()
            
            # 1. Cargar portal
            page.goto(URL_PORTAL, wait_until="domcontentloaded", timeout=timeout_ms)
            
            # 2. Esperar input del documento
            page.wait_for_selector("#documento", state="visible", timeout=timeout_ms)
            page.fill("#documento", doc_limpio)
            
            # Selección de elección si aplica
            if eleccion_id != 0:
                try:
                    page.select_option("#eleccion", str(eleccion_id))
                except Exception:
                    pass

            # 3. Disparar consulta e interceptar respuesta de la API interna
            with page.expect_response(
                lambda r: "/back/api/consulta" in r.url,
                timeout=timeout_ms
            ) as response_info:
                page.click("#submitBtn")

            response = response_info.value
            raw_json = response.json()
            context.close()

            # 4. Estructurar la respuesta
            if not raw_json.get("ok", False):
                return {
                    "ok": False,
                    "error": raw_json.get("error", "Error devuelto por el servidor de la Registraduría.")
                }

            if raw_json.get("encontrado", False):
                data = raw_json.get("data", {})
                mapa = raw_json.get("mapa", {})
                return {
                    "ok": True,
                    "encontrado": True,
                    "documento": str(data.get("nuip", doc_limpio)),
                    "departamento": data.get("nom_depto", "").strip(),
                    "municipio": data.get("nom_mun", "").strip(),
                    "puesto": data.get("nom_puesto", "").strip(),
                    "direccion": data.get("direccion", "").strip(),
                    "mesa": str(data.get("mesa", "")).strip(),
                    "fecha_ingreso": data.get("fingreso", "").strip(),
                    "coddivipol": data.get("coddivipol", ""),
                    "coordenadas": {
                        "lat": mapa.get("lat"),
                        "lng": mapa.get("lng")
                    } if mapa else None,
                    "url_mapa": mapa.get("url") if mapa else None
                }
            elif raw_json.get("novedad", False):
                return {
                    "ok": True,
                    "encontrado": False,
                    "novedad": True,
                    "documento": doc_limpio,
                    "mensaje": raw_json.get("mensaje", ""),
                    "descripcion": raw_json.get("descripcion", "")
                }
            else:
                return {
                    "ok": True,
                    "encontrado": False,
                    "documento": doc_limpio,
                    "mensaje": raw_json.get("mensaje", "El documento no se encuentra en el censo electoral.")
                }

    except PlaywrightTimeoutError:
        return {
            "ok": False,
            "error": "Tiempo de espera agotado al conectar con el portal de la Registraduría."
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Error durante la consulta: {str(e)}"
        }


def main():
    parser = argparse.ArgumentParser(
        description="Consulta el puesto y mesa de votación en la Registraduría Nacional del Estado Civil."
    )
    parser.add_argument(
        "documento",
        type=str,
        help="Número de cédula o documento de identidad a consultar."
    )
    parser.add_argument(
        "--eleccion",
        type=int,
        default=0,
        help="ID de la elección (0 = Lugar de votación actual)."
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Tiempo de espera máximo en segundos (por defecto: 30)."
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Forzar modo headless estricto (puede ser bloqueado por Cloudflare)."
    )

    args = parser.parse_args()

    resultado = consultar_censo(
        documento=args.documento,
        eleccion_id=args.eleccion,
        timeout_ms=args.timeout * 1000,
        headless=args.headless
    )

    print(json.dumps(resultado, indent=2, ensure_ascii=False))

    if not resultado.get("ok", False):
        sys.exit(1)


if __name__ == "__main__":
    main()
