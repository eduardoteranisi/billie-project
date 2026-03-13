from .tools.pdf_reader import extrair_gastos_local
from .tools.trade_name_searcher import normalizar_nomes_nuvem
from .tools.notion_api import enviar_para_notion

def orquestrar_pipeline_fatura(caminho_pdf: str, senha: str):
    # 1. Faz a leitura 100% offline
    df_gastos = extrair_gastos_local(caminho_pdf, senha)
    
    # 2. Exporta para CSV (Usando ponto e vírgula para não bugar com os centavos em PT-BR)
    #nome_arquivo_csv = "debug_extracao_fatura.csv"
    #df_gastos.to_csv(nome_arquivo_csv, sep=';', index=False, encoding='utf-8-sig')
    
    #print(f"\n✅ Extração concluída! O arquivo '{nome_arquivo_csv}' foi salvo na raiz do projeto.")
    #print("Abra o arquivo no Excel, Numbers ou LibreOffice para conferir as linhas.")
    
    # 2. Isola apenas a coluna de nomes (Fronteira de Privacidade)
    #nomes_originais = df_gastos['Descricao_Suja'].tolist()
    
    # 3. Manda só os nomes para o Gemini
    #nomes_limpos = normalizar_nomes_nuvem(nomes_originais)
    
    # 4. Junta as peças na sua máquina
    #df_gastos['Nome_Fantasia'] = nomes_limpos
    
    print("\n✅ Processamento Concluído! Eis os dados higienizados:")
    # Imprime no terminal para você validar antes de mandar pro Notion
    #print(df_gastos[['Data', 'Nome_Fantasia', 'Valor']])
    
    # O próximo passo será enviar este df_gastos para o Notion!
    # 5. Envia para o Notion! <-- Nova etapa
    enviar_para_notion(df_gastos)
    
    return df_gastos
