import os
import json
import google.generativeai as genai

def normalizar_nomes_nuvem(lista_nomes_sujos: list) -> list:
    print("☁️ Gemini: Traduzindo nomes na nuvem (Gemini 2.5 Flash)...")
    
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Aja como um normalizador de dados de faturas.
    Receba esta lista de descrições brutas e devolva um array JSON com os nomes fantasia populares equivalentes.
    Mantenha a ordem exata. Se não reconhecer a loja, devolva o nome original.
    
    Lista: {json.dumps(lista_nomes_sujos)}
    """
    
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    return json.loads(response.text)
