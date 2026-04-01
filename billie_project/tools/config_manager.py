import os
from dotenv import load_dotenv, set_key

# 1. Blindagem de Caminho (Preparando para o .exe)
# Como este arquivo está dentro da pasta 'tools', pegamos a pasta atual e voltamos um nível (..) para achar a raiz.
PASTA_ATUAL = os.path.dirname(os.path.abspath(__file__))
PASTA_RAIZ = os.path.dirname(PASTA_ATUAL)
CAMINHO_ENV = os.path.join(PASTA_RAIZ, ".env")

def inicializar_ambiente():
    """Garante que o arquivo .env existe e carrega as variáveis para a memória."""
    if not os.path.exists(CAMINHO_ENV):
        # Se o usuário acabou de instalar o app, cria um .env vazio silenciosamente
        open(CAMINHO_ENV, 'a').close()
    
    load_dotenv(CAMINHO_ENV)

def obter_configuracao(chave: str) -> str:
    """Busca uma chave específica. Retorna uma string vazia se não existir."""
    inicializar_ambiente()
    return os.getenv(chave, "")

def salvar_configuracao(chave: str, valor: str):
    """
    Salva ou atualiza uma chave no arquivo .env físico e na memória.
    Se a chave já existir, ela será substituída com segurança.
    """
    # Garante que o arquivo existe antes de tentar escrever
    if not os.path.exists(CAMINHO_ENV):
        open(CAMINHO_ENV, 'a').close()
    
    # Grava no disco (o set_key não apaga os comentários ou outras chaves que já estão lá)
    set_key(CAMINHO_ENV, chave, valor)
    
    # Atualiza a memória RAM na mesma hora para o app não precisar ser reiniciado
    os.environ[chave] = valor
    
    print(f"⚙️ Configuração '{chave}' salva com sucesso!")

def validar_configuracoes_basicas() -> bool:
    """Verifica se o motor tem o mínimo necessário para rodar o pipeline."""
    inicializar_ambiente()
    token_notion = os.getenv("NOTION_TOKEN")
    db_notion = os.getenv("NOTION_DATABASE_ID")
    
    # Se um dos dois for None ou estiver vazio
    if not token_notion or not db_notion:
        return False
    return True
