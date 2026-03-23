import os
import re
import pandas as pd
import pikepdf
import pdfplumber
import hashlib

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
    
   # 2. Tratamento da Data (De "DD/MM/YY" para Data do Pandas)
    df['Data'] = pd.to_datetime(df['Data'], dayfirst=True, errors='coerce')
    
    # ==========================================
    # CORREÇÃO MÁGICA DAS COMPRAS PARCELADAS
    # ==========================================
    mask_parcelas = df['Descricao_Suja'].str.lower().str.contains('parcela', na=False)
    
    if mask_parcelas.any():
        import calendar
        # Descobre o mês/ano principal da fatura analisando as compras à vista
        datas_normais = df.loc[~mask_parcelas, 'Data']
        
        if not datas_normais.empty:
            mes_fatura = int(datas_normais.dt.month.mode()[0])
            ano_fatura = int(datas_normais.dt.year.mode()[0])
            
            def atualizar_mes_parcela(data_antiga):
                if pd.isnull(data_antiga):
                    return data_antiga
                # Garante que não vai dar erro se a compra original foi dia 31 e o mês atual só tem 28 ou 30 dias
                ultimo_dia_mes = calendar.monthrange(ano_fatura, mes_fatura)[1]
                dia_seguro = min(data_antiga.day, ultimo_dia_mes)
                
                return data_antiga.replace(year=ano_fatura, month=mes_fatura, day=dia_seguro)
            
            # Aplica o "puxão temporal" apenas nas linhas parceladas
            df.loc[mask_parcelas, 'Data'] = df.loc[mask_parcelas, 'Data'].apply(atualizar_mes_parcela)
    # ==========================================

    # 3. Formatação Final para o Notion
    df['Data'] = df['Data'].dt.strftime('%Y-%m-%d')

    def gerar_hash_compra(row):
        # Concatenamos os dados puros originais para criar uma assinatura única
        texto_base = f"{row['Data']}{row['Descricao_Suja']}{row['Valor']}"
        # Geramos um MD5 hexadecimal (rápido e suficientemente seguro para evitar colisões aqui)
        return hashlib.md5(texto_base.encode('utf-8')).hexdigest()

    df['ID_Transacao'] = df.apply(gerar_hash_compra, axis=1)

    print(f"✅ Extração finalizada: {len(df)} transações válidas encontradas.")

    return df    
