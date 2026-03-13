import os
from dotenv import load_dotenv
from billie_project.agent import orquestrar_pipeline_fatura

# Carrega as variáveis do .env para a memória
load_dotenv()

if __name__ == "__main__":
    caminho_pdf = "fatura_rico.pdf" # Coloque um PDF de teste na raiz
    senha = os.getenv("FATURA_SENHA")
    
    print("🚀 Iniciando Billie-BI: Processamento de Fatura...")
    orquestrar_pipeline_fatura(caminho_pdf, senha)
