import json
import pandas as pd
from google import genai
from google.genai import types

def normalizar_nomes_nuvem(df: pd.DataFrame, log_callback) -> pd.DataFrame:
    """Recebe o DataFrame, limpa os nomes únicos no Gemini e devolve o DF atualizado."""
    log_callback("☁️ Gemini: Traduzindo nomes na nuvem (Gemini 2.5 Flash)...")
    
    # 1. Extrai apenas nomes únicos. Se você foi na mesma padaria 10 vezes, 
    # o Gemini só gasta token lendo o nome dela 1 vez.
    nomes_unicos = df['Descricao_Suja'].unique().tolist()
    
    client = genai.Client()
    
    # 2. O Prompt Blindado (Pede um Dicionário em vez de Array)
    prompt = f"""
    Aja como um normalizador de dados de faturas.
    Receba esta lista de descrições brutas e devolva um objeto JSON (Dicionário) 
    onde a chave é o nome original EXATO e o valor é o nome fantasia popular equivalente.
    Exemplo: {{"UBER * PENDING": "Uber", "IFD*MM COMERCIO": "iFood"}}
    Se não reconhecer a loja, devolva o nome original limpo e capitalizado.
    
    Lista: {json.dumps(nomes_unicos, ensure_ascii=False)}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1 # Temperatura baixa para evitar alucinações
            )
        )
        
        # 3. Transforma a resposta num dicionário Python
        dicionario_nomes = json.loads(response.text)
        
        # 4. A Mágica do Pandas: Substitui os nomes usando o dicionário.
        df['Nome_Fantasia'] = df['Descricao_Suja'].map(dicionario_nomes).fillna(df['Descricao_Suja'])
        
        log_callback(f"✨ {len(dicionario_nomes)} lojas higienizadas com sucesso!")
        
    except Exception as e:
        log_callback(f"❌ Erro na comunicação com o Gemini: {e}")
        # Em caso de falha (sem internet, timeout), criamos a coluna com os nomes sujos para não quebrar o Notion
        df['Descricao_Limpa'] = df['Descricao_Suja']
        
    return df
