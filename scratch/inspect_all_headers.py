#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

ORIGINAL_SPREADSHEET_ID = "113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A"
COPY_SPREADSHEET_ID = "1LRhB6eFG07LCo5QrPFKilt1Op7XMeO_RxU28MyO2BSY"
CREDS_PATH = "/etc/dailylover/google-sheets-credentials.json"

creds = service_account.Credentials.from_service_account_file(
    CREDS_PATH,
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

TABS = [
    "MATCHES JENN", "MATCHES SILVI", "MATCHES ANA ", "MATCHES STEFFY",
    "MATCHES ALEJA", "MATCHES SOFI", "MATCHES LAU", "MATCHES MAPE D", "MATCHES MANU "
]

print("=== ENCABEZADOS DE LAS 9 PESTAÑAS ===")
for tab in TABS:
    res = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SPREADSHEET_ID, range=f"'{tab}'!A1:Z1").execute()
    vals = res.get("values", [[]])[0]
    print(f"\nTab: '{tab}'")
    for idx, col in enumerate(vals):
        print(f"  Col {idx:2d} ({chr(65+idx)}): {col}")
