#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os
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

res_orig = service.spreadsheets().values().get(spreadsheetId=ORIGINAL_SPREADSHEET_ID, range="'MATCHES MAPE D'!A1:K10").execute()
res_copy = service.spreadsheets().values().get(spreadsheetId=COPY_SPREADSHEET_ID, range="'MATCHES MAPE D'!A1:K10").execute()

print("=== ORIGINAL MATCHES MAPE D ===")
for r in res_orig.get("values", []):
    print(r)

print("\n=== COPIA MATCHES MAPE D ===")
for r in res_copy.get("values", []):
    print(r)
