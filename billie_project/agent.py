import sys
import os
from .tools import router
from .tools import notion_api
from .tools import trade_name_searcher

def orquestrar_pipeline(caminho_pdf, senha, banco, ano, log_callback):
    """
    Função principal que coordena o fluxo de dados.
    Recebe 'log_callback' para enviar mensagens em tempo real para a interface.
    """
    try:
        log_callback(f"Iniciando pipeline para o banco: {banco}")
        
        # 1. Fase de Extração
        log_callback("Desbloqueando e lendo o PDF...")
        # Lembre-se de garantir que o router e o pdf_reader aceitem o parâmetro 'ano'
        df = router.processar_fatura(caminho_pdf, senha, banco, ano)
        
        quantidade = len(df)
        log_callback(f"✅ Extração concluída: {quantidade} transações encontradas.")
        
        # 2. Fase de IA
        log_callback("🧠 Enviando para o Gemini higienizar os nomes...")
        df = trade_name_searcher.normalizar_nomes_nuvem(df, log_callback)
        
        # 3. Fase de Upload (Notion)
        log_callback("☁️ Enviando dados para o banco do Notion...")
        notion_api.enviar_para_notion(df)
        
        log_callback("🎉 Processo finalizado com sucesso!")
        return True
        
    except Exception as e:
        log_callback(f"❌ Erro crítico: {str(e)}")
        return False
