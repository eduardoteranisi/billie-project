import os
from dotenv import load_dotenv
import requests
import pandas as pd
from datetime import datetime

load_dotenv()

def obter_hashes_existentes(database_id: str, headers: dict) -> set:
    url = f"https://api.notion.com/v1/databases/{database_id}/query"
    hashes = set()
    has_more = True
    next_cursor = None
    
    print("🔍 Notion: A verificar transações já existentes para evitar duplicados...")
    
    while has_more:
        payload = {}
        if next_cursor:
            payload["start_cursor"] = next_cursor
            
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            print("❌ Erro ao consultar o Notion:", response.text)
            break
            
        data = response.json()
        
        for page in data.get("results", []):
            prop = page.get("properties", {}).get("__id_transacao", {})
            rich_text = prop.get("rich_text", [])
            if rich_text:
                hashes.add(rich_text[0].get("plain_text"))
                
        has_more = data.get("has_more", False)
        next_cursor = data.get("next_cursor")
        
    return hashes

def enviar_para_notion(df_gastos: pd.DataFrame):
    token = os.getenv("NOTION_TOKEN")
    database_id = os.getenv("NOTION_DATABASE_ID")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    # 1. Obter o "cadastro" do que já está na nuvem
    hashes_no_notion = obter_hashes_existentes(database_id, headers)
    
    print("📝 Notion: A iniciar sincronização...")
    inseridos = 0
    ignorados = 0
    
    url = "https://api.notion.com/v1/pages"
    
    for index, row in df_gastos.iterrows():
        id_transacao = str(row['ID_Transacao'])
        nome_loja = str(row['Nome_Fantasia']).strip()
        valor_float = float(row['Valor'])
        data_formatada = row['Data']
        
        if id_transacao in hashes_no_notion:
            print(f"  ⏭️ Ignorado (Duplicado): {nome_loja} - R$ {valor_float}")
            ignorados += 1
            continue
            
        payload = {
            "parent": {"database_id": database_id},
            "properties": {
                "Expense": {
                    "title": [{"text": {"content": nome_loja}}]
                },
                "Amount": {
                    "number": valor_float
                },
                "Date": {
                    "date": {"start": data_formatada}
                },
                "__id_transacao": {
                    "rich_text": [{"text": {"content": id_transacao}}]
                }
            }
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            print(f"  ✅ Salvo: {nome_loja} - R$ {valor_float}")
            inseridos += 1

        else:
            print(f"  ❌ Erro ao salvar {nome_loja}: {response.text}")
