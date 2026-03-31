import os
import pikepdf
import pdfplumber
from dotenv import load_dotenv

load_dotenv()

def espionar_fatura(caminho_pdf, senha):
    print(f"🕵️ Abrindo '{caminho_pdf}' para espionar o texto puro...")
    temp_path = "fatura_temporaria_debug.pdf"
    
    try:
        # 1. Desbloqueia a senha
        with pikepdf.open(caminho_pdf, password=senha) as pdf:
            pdf.save(temp_path)
            
        # 2. Extrai e imprime o texto
        with pdfplumber.open(temp_path) as pdf:
            # Vamos ler apenas a primeira e a segunda página para não poluir muito o terminal
            for numero_pagina, pagina in enumerate(pdf.pages[2:4]):
                print(f"\n{'='*20} PÁGINA {numero_pagina + 1} {'='*20}\n")
                texto = pagina.extract_text()
                if texto:
                    print(texto)
                else:
                    print("[Página vazia ou sem texto selecionável]")
                
    except Exception as e:
        print(f"❌ Erro ao ler PDF: {e}")
    finally:
        # Apaga o arquivo temporário desbloqueado
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    caminho_pdf = "fatura.pdf"
    senha = os.getenv("PDF_PASSWORD")
    
    if not senha:
        print("⚠️ Senha não encontrada no .env!")
    else:
        espionar_fatura(caminho_pdf, senha)
