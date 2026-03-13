import os
import requests
import pandas as pd
from datetime import datetime

def enviar_para_notion(df_gastos: pd.DataFrame):
    """Itera sobre o DataFrame e faz um POST para cada gasto no Notion."""
    
    token = os.getenv("NOTION_TOKEN")
    database_id = os.getenv("NOTION_DATABASE_ID")
    
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    print("📝 Notion: Iniciando a gravação dos dados...")
    
    for index, row in df_gastos.iterrows():
        # Trata os dados de cada linha
        nome_loja = str(row['Descricao_Suja']).strip()
        data = row['Data']
        
        # Garante que o valor é um float (remove "R$", converte vírgula para ponto se precisar)
        try:
            valor_str = str(row['Valor']).replace('R$', '').replace(',', '.').strip()
            valor_float = float(valor_str)
        except ValueError:
            valor_float = 0.0

        # Monta o JSON exato que o Notion exige
        payload = {
            "parent": {"database_id": database_id},
            "properties": {
                "Expense": { # Nome da coluna
                    "title": [
                        {"text": {"content": nome_loja}}
                    ]
                },
                "Amount": { # Nome da coluna (Tipo: Number)
                    "number": valor_float
                },
                "Date": { # Nome da coluna (Tipo: Date)
                    "date": {"start": data}
                }
            }
        }

        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            print(f"  ✅ Salvo: {nome_loja} - R$ {valor_float}")
        else:
            print(f"  ❌ Erro ao salvar {nome_loja}: {response.text}")

    print("🎉 Sincronização com o Notion concluída!")
