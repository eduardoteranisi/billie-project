import os
import pandas as pd
import pikepdf
from docling.document_converter import DocumentConverter

def extrair_gastos_local(caminho_pdf: str, senha: str) -> pd.DataFrame:
    print("🔒 Desbloqueando PDF...")
    temp_path = "fatura_temporaria.pdf"
    
    with pikepdf.open(caminho_pdf, password=senha) as pdf:
        pdf.save(temp_path)
    
    print("🧠 Docling: Analisando tabela visualmente (Offline)...")
    converter = DocumentConverter()
    doc = converter.convert(temp_path)
    
    # Remove o PDF temporário por segurança
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    if not doc.document.tables:
        raise ValueError("Nenhuma tabela encontrada na fatura.")
        
    # Converte a tabela visual para um DataFrame Pandas
    df = doc.document.tables[0].export_to_dataframe()
    
    # Limpeza básica (Ajuste os nomes das colunas conforme o PDF da Rico)
    # Exemplo: assumindo que as colunas 0, 1 e 2 são Data, Descrição e Valor
    df.columns = ['Data', 'Descricao_Suja', 'Valor']
    
    # Remove linhas vazias ou cabeçalhos indesejados
    df = df.dropna(subset=['Valor'])
    
    return df
