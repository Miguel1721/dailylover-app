import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/app/service_account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)
service = build('sheets', 'v4', credentials=creds)
meta = service.spreadsheets().get(spreadsheetId='113GBaGwDltILH4pMqbyvuK17rhCIxPFW0Cv4sLtBX5A').execute()
tabs = [s['properties']['title'] for s in meta['sheets'] if 'MATCHES' in s['properties']['title']]
print('Tabs encontradas:', len(tabs), tabs)
