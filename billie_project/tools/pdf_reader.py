import os
import re
import pandas as pd
import pikepdf
import pdfplumber

def extrair_gastos_local(caminho_pdf: str, senha: str) -> pd.DataFrame:
    print("🔒 Desbloqueando PDF...")
    temp_path = "fatura_temporaria.pdf"
    
    with pikepdf.open(caminho_pdf, password=senha) as pdf:
        pdf.save(temp_path)
    
    print("📄 Lendo texto puro e aplicando Regex (pdfplumber)...")
    linhas_extraidas = []
    
    # REGEX ATUALIZADO (A Mágica do Dólar vs Real):
    # 1. ^\s*(\d{2}/\d{2}(?:/\d{2,4})?) -> Captura a Data
    # 2. \s+(.*?)\s+                    -> Captura a Descrição (qualquer texto no meio)
    # 3. (-?\d{1,3}(?:\.\d{3})*,\d{2})  -> Captura o PRIMEIRO valor (Reais)
    # 4. (?:\s+-?\d{1,3}(?:\.\d{3})*,\d{2})? -> Ignora o SEGUNDO valor se ele existir (Dólar)
    padrao_compra = re.compile(r"^\s*(\d{2}/\d{2}(?:/\d{2,4})?)\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+-?\d{1,3}(?:\.\d{3})*,\d{2})?\s*$")
    
    with pdfplumber.open(temp_path) as pdf:
        for page in pdf.pages:
            texto = page.extract_text()
            if not texto:
                continue
            
            for linha in texto.split('\n'):
                match = padrao_compra.match(linha)
                
                if match:
                    data, descricao, valor = match.groups()
                    
                    # FILTROS DE HIGIENE APRIMORADOS:
                    descricao_lower = descricao.lower()                    
                    # Se for valor negativo, ou contiver palavras-chave de estorno/pagamento, joga fora.
                    if valor.startswith("-") or descricao_lower.startswith("pagamento") or "r$" in descricao_lower:
                        continue

                    linhas_extraidas.append({
                        "Data": data,
                        "Descricao_Suja": descricao.strip(),
                        "Valor": valor
                    })
    
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    if not linhas_extraidas:
        raise ValueError("Nenhuma transação encontrada. O formato do PDF pode ser diferente do esperado.")
        
    df = pd.DataFrame(linhas_extraidas)
    
    # ==========================================
    # TRATAMENTO DE TIPOS PARA O NOTION
    # ==========================================
    
    # 1. Tratamento do Valor (De String "1.234,56" para Float 1234.56)
    # Primeiro tira o ponto de milhar, depois troca a vírgula decimal por ponto
    df['Valor'] = df['Valor'].str.replace('.', '', regex=False)
    df['Valor'] = df['Valor'].str.replace(',', '.', regex=False)
    # Converte a coluna inteira para float (número real)
    df['Valor'] = df['Valor'].astype(float)
    
    # 2. Tratamento da Data (De "DD/MM/YY" para "YYYY-MM-DD")
    # O Pandas entende datas BR se passarmos dayfirst=True
    df['Data'] = pd.to_datetime(df['Data'], dayfirst=True, errors='coerce')
    # O Notion precisa receber uma string formatada nesse padrão exato:
    df['Data'] = df['Data'].dt.strftime('%Y-%m-%d')
    print(f"✅ Extração finalizada: {len(df)} transações válidas encontradas.")
    
    return df
