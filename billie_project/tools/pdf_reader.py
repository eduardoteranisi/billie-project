import re
import pandas as pd
import pdfplumber
import hashlib
from datetime import datetime

# ==========================================
# FUNÇÕES AUXILIARES (Comuns a todos)
# ==========================================
def aplicar_tratamento_final(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica as correções de data, valor numérico e gera o Hash de Idempotência."""
    # 1. Tratamento do Valor
    df['Valor'] = df['Valor'].str.replace('.', '', regex=False)
    df['Valor'] = df['Valor'].str.replace(',', '.', regex=False)
    df['Valor'] = df['Valor'].astype(float)
    
    # 2. Tratamento da Data
    df['Data'] = pd.to_datetime(df['Data'], dayfirst=True, errors='coerce')
    
    # 3. Correção Mágica das Parcelas
    mask_parcelas = df['Descricao_Suja'].str.lower().str.contains(r'parcela|\d{1,2}\s*/\s*\d{1,2}', regex=True, na=False)

    if mask_parcelas.any():
        import calendar
        datas_normais = df.loc[~mask_parcelas, 'Data']
        if not datas_normais.empty:
            mes_fatura = int(datas_normais.dt.month.mode()[0])
            ano_fatura = int(datas_normais.dt.year.mode()[0])
            
            def atualizar_mes_parcela(data_antiga):
                if pd.isnull(data_antiga): return data_antiga
                ultimo_dia = calendar.monthrange(ano_fatura, mes_fatura)[1]
                dia_seguro = min(data_antiga.day, ultimo_dia)
                return data_antiga.replace(year=ano_fatura, month=mes_fatura, day=dia_seguro)
            
            df.loc[mask_parcelas, 'Data'] = df.loc[mask_parcelas, 'Data'].apply(atualizar_mes_parcela)

    # 4. Formatação e Hash
    df['Data'] = df['Data'].dt.strftime('%Y-%m-%d')
    df['ID_Transacao'] = df.apply(lambda r: hashlib.md5(f"{r['Data']}{r['Descricao_Suja']}{r['Valor']}".encode('utf-8')).hexdigest(), axis=1)
    
    return df

# ==========================================
# EXTRATORES ESPECÍFICOS POR BANCO
# ==========================================

def extrair_xp_rico(caminho_pdf_desbloqueado: str) -> pd.DataFrame:
    linhas_extraidas = []
    padrao_compra = re.compile(r"^\s*(\d{2}/\d{2}(?:/\d{2,4})?)\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+-?\d{1,3}(?:\.\d{3})*,\d{2})?\s*$")
    
    with pdfplumber.open(caminho_pdf_desbloqueado) as pdf:
        for page in pdf.pages:
            texto = page.extract_text()
            if not texto: continue
            for linha in texto.split('\n'):
                match = padrao_compra.match(linha)
                if match:
                    data, descricao, valor = match.groups()
                    descricao_lower = descricao.lower()                    
                    if valor.startswith("-") or descricao_lower.startswith("pagamento") or "r$" in descricao_lower:
                        continue
                    linhas_extraidas.append({"Data": data, "Descricao_Suja": descricao.strip(), "Valor": valor})
                    
    if not linhas_extraidas:
        raise ValueError("Nenhuma transação encontrada no formato XP.")
        
    df = pd.DataFrame(linhas_extraidas)
    return aplicar_tratamento_final(df)


def extrair_nubank(caminho_pdf_desbloqueado: str, ano_fornecido: int) -> pd.DataFrame:
    print("🟣 Lendo fatura formato Nubank...")
    linhas_extraidas = []
    
    # REGEX NUBANK:
    # 1. ^\s*(\d{1,2}\s+[A-Za-z]{3}) -> Captura o Dia e Mês (ex: "25 OUT")
    # 2. \s+(.*?)\s+                 -> Captura a Descrição
    # 3. R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}) -> Ignora o "R$" e captura só o número
    padrao_compra = re.compile(r"^\s*(\d{1,2}\s+[A-Za-z]{3})\s+(.*?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$")
    
    # Dicionário para traduzir o mês do Nubank para o Pandas
    meses_pt = {
        'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04',
        'MAI': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
        'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
    }
    
    # Pegamos o ano atual do sistema como base (o Pandas corrige a virada de ano depois se for parcela)
    ano_atual = str(datetime.now().year)
    
    with pdfplumber.open(caminho_pdf_desbloqueado) as pdf:
        for page in pdf.pages:
            texto = page.extract_text()
            if not texto: continue
            
            for linha in texto.split('\n'):
                match = padrao_compra.match(linha)
                if match:
                    data_str, descricao, valor = match.groups()
                    
                    # 1. Higiene básica
                    descricao_lower = descricao.lower()
                    if valor.startswith("-") or "pagamento" in descricao_lower or "saldo" in descricao_lower:
                        continue
                        
                    # 2. Limpeza dos números do cartão (Remove "•••• 8554" ou "••• 123")
                    descricao_limpa = re.sub(r"•+\s*\d*\s*", "", descricao).strip()
                    
                    # 3. Conversão da Data ("25 OUT" -> "25/10/2025")
                    partes_data = data_str.upper().split()
                    dia = partes_data[0].zfill(2)
                    mes_texto = partes_data[1]
                    mes_numero = int(meses_pt.get(mes_texto, '1'))
                    
                    # -----------------------------------------
                    # 🛡️ PROTEÇÃO DO VIAJANTE NO TEMPO
                    # -----------------------------------------
                    ano_compra = int(ano_fornecido) if ano_fornecido != "Automático (Recomendado)" else datetime.now().year
                    
                    # Se o mês da compra for maior que o mês atual 
                    # (Ex: Compra em Outubro(10), mas estamos em Março(3))
                    # Significa que a compra pertence ao ano passado.
                    if mes_numero > datetime.now().month:
                        ano_compra -= 1
                    
                    # Formata de volta para string ("25/10/2025")
                    data_formatada = f"{dia}/{mes_numero:02d}/{ano_compra}"
                    # -----------------------------------------                    
                    linhas_extraidas.append({
                        "Data": data_formatada,
                        "Descricao_Suja": descricao_limpa,
                        "Valor": valor
                    })
                    
    if not linhas_extraidas:
        raise ValueError("Nenhuma transação encontrada no formato Nubank.")
        
    df = pd.DataFrame(linhas_extraidas)
    
    # Manda para a nossa esteira de formatação e geração de Hash (Idempotência)
    return aplicar_tratamento_final(df)

def extrair_santander(caminho_pdf_desbloqueado: str, ano_fornecido: str) -> pd.DataFrame:
    print("🔴 Lendo fatura formato Santander (Modo Multi-Coluna)...")
    linhas_extraidas = []
    
    # REGEX MULTI-COLUNA:
    # Sem o '$' no final. Ele pega Data + Descrição + Valor e para.
    # Se houver outra compra na mesma linha (coluna 2), o finditer acha de novo!
    # O (.*?) é preguiçoso: ele vai engolir a parcela "12/12" tranquilamente, 
    # mas vai frear assim que bater no formato de dinheiro "R$ 117,78".
    padrao_compra = re.compile(r"(\d{2}/\d{2})\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)")
    
    palavras_lixo = [
        "pagamento", "saldo", "total", "fatura", "iof", "juros", 
        "multa", "encargo", "tarifa", "saque", "nacional", "internacional",
        "desconto", "estorno", "cancelamento", "credito", "crédito", 
        "anterior", "atualizacao", "taxa", "bx", "financiamento",
        "pagando", "exato", "valor", "parcelamento"
    ]
    
    agora = datetime.now()
    
    with pdfplumber.open(caminho_pdf_desbloqueado) as pdf:
        for page in pdf.pages:
            texto_bruto = page.extract_text()
            if not texto_bruto: continue
            
            # A CURA DA VÍRGULA (Junta os centavos quebrados de volta)
            texto_curado = re.sub(r",\s*\n\s*(\d{2})(?!\d)", r",\1", texto_bruto)
            
            # Lemos linha a linha (não cruza parágrafos de lixo)
            for linha in texto_curado.split('\n'):
                
                # finditer vai achar o IFD*MM e o UBER separadamente, mesmo na mesma linha!
                for match in padrao_compra.finditer(linha):
                    data_str, descricao, valor = match.groups()
                    
                    descricao_limpa = descricao.strip()
                    descricao_lower = descricao_limpa.lower()
                    
                    # O "Paredão": Filtra o lixo ou pagamentos da fatura
                    if valor.startswith("-") or any(p in descricao_lower for p in palavras_lixo):
                        continue
                    
                    dia, mes = data_str.split('/')
                    mes_numero = int(mes)
                    
                    ano_compra = agora.year
                    if ano_fornecido and str(ano_fornecido).isdigit():
                        ano_compra = int(ano_fornecido)
                    elif ano_fornecido == "Automático (Recomendado)" and mes_numero > agora.month:
                        ano_compra -= 1
                        
                    data_formatada = f"{dia}/{mes_numero:02d}/{ano_compra}"
                    
                    linhas_extraidas.append({
                        "Data": data_formatada,
                        "Descricao_Suja": descricao_limpa,
                        "Valor": valor
                    })
                    
    if not linhas_extraidas:
        raise ValueError("Nenhuma transação encontrada no formato Santander.")
        
    df = pd.DataFrame(linhas_extraidas)
    return aplicar_tratamento_final(df)
