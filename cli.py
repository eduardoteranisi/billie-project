import os
from dotenv import load_dotenv
from billie_project.agent import orquestrar_pipeline_fatura

load_dotenv()

if __name__ == "__main__":
    caminho_pdf = "fatura_rico_marco_2026.pdf"
    senha = os.getenv("PDF_PASSWORD")

    orquestrar_pipeline_fatura(caminho_pdf, senha)
