from .tools.leitor_pdf import extrair_gastos_local
from .tools.ia_gemini import normalizar_nomes_nuvem

def orquestrar_pipeline_fatura(caminho_pdf: str, senha: str):
    # 1. Faz a leitura 100% offline
    df_gastos = extrair_gastos_local(caminho_pdf, senha)
    
    # 2. Isola apenas a coluna de nomes (Fronteira de Privacidade)
    nomes_originais = df_gastos['Descricao_Suja'].tolist()
    
    # 3. Manda só os nomes para o Gemini
    nomes_limpos = normalizar_nomes_nuvem(nomes_originais)
    
    # 4. Junta as peças na sua máquina
    df_gastos['Nome_Fantasia'] = nomes_limpos
    
    print("\n✅ Processamento Concluído! Eis os dados higienizados:")
    # Imprime no terminal para você validar antes de mandar pro Notion
    print(df_gastos[['Data', 'Nome_Fantasia', 'Valor']])
    
    # O próximo passo será enviar este df_gastos para o Notion!
    return df_gastos
