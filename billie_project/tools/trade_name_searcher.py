import os
import json
from google import genai
from google.genai import types

def normalizar_nomes_nuvem(lista_nomes_sujos: list) -> list:
    print("☁️ Gemini: Traduzindo nomes na nuvem (Gemini 2.5 Flash)...")
    
    # 1. O novo SDK usa o objeto Client.
    # Ele lê a variável GEMINI_API_KEY do seu arquivo .env automaticamente!
    client = genai.Client()
    
    prompt = f"""
    Aja como um normalizador de dados de faturas.
    Receba esta lista de descrições brutas e devolva um array JSON com os nomes fantasia populares equivalentes.
    Mantenha a ordem exata. Se não reconhecer a loja, devolva o nome original.
    
    Lista: {json.dumps(lista_nomes_sujos)}
    """
    
    # 2. A chamada agora é feita via client.models
    # 3. As configurações (como forçar o JSON) vão dentro do objeto GenerateContentConfig
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)
