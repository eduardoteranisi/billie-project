import os
import pikepdf
from .pdf_reader import extrair_xp_rico, extrair_nubank, extrair_santander

def processar_fatura(caminho_pdf: str, senha: str, banco_selecionado: str, ano: int):
    print(f"Iniciando roteamento manual para o banco: {banco_selecionado}")
    temp_path = "fatura_temporaria.pdf"
    
    # 1. Desbloqueia a senha (Etapa comum a todos)
    try:
        with pikepdf.open(caminho_pdf, password=senha) as pdf:
            pdf.save(temp_path)
    except Exception as e:
        raise ValueError(f"Erro ao desbloquear o PDF. A senha está correta? Detalhes: {e}")

    # 2. Roteamento Direto (Baseado na escolha do usuário na interface)
    try:
        # Padronizamos para minúsculas para evitar erros de digitação no código
        banco = banco_selecionado.lower().strip()
        
        if banco == "nubank":
            return extrair_nubank(temp_path, ano)
            
        elif banco == "xp / rico" or banco == "xp":
            return extrair_xp_rico(temp_path)
        elif banco == "santander":
            return extrair_santander(temp_path, ano)
        else:
            raise NotImplementedError(f"O extrator para o banco '{banco_selecionado}' ainda não foi implementado.")
            
    finally:
        # FAXINA SEGURA
        if os.path.exists(temp_path):
            os.remove(temp_path)
