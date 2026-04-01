import requests
import webbrowser
import threading

# --- CONFIGURAÇÕES DO APP ---
# Esta é a versão ATUAL do código. Você vai mudar isso aqui sempre que for lançar um .exe novo.
VERSAO_ATUAL = "v1.0.0" 

# Substitua pelo seu usuário e nome do repositório no GitHub
GITHUB_REPO = "seu-usuario/nome-do-repositorio" 

def buscar_atualizacoes(callback_ui):
    """
    Vai até o GitHub verificar se existe uma 'Release' mais nova.
    Roda em background (Thread) para não congelar o CustomTkinter.
    """
    def tarefa_em_background():
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
            
            # Timeout curto de 3 segundos para não ficar pendurado se o usuário estiver sem Wi-Fi
            resposta = requests.get(url, timeout=3)
            
            if resposta.status_code == 200:
                dados = resposta.json()
                versao_nuvem = dados.get("tag_name") # Ex: "v1.1.0"
                url_download = dados.get("html_url") # Link da página da Release
                
                # Compara as versões de forma simples (se for diferente, assume que é nova)
                if versao_nuvem and versao_nuvem != VERSAO_ATUAL:
                    # Envia a boa notícia de volta para a interface gráfica
                    callback_ui(True, versao_nuvem, url_download)
                else:
                    callback_ui(False, VERSAO_ATUAL, None)
            else:
                callback_ui(False, VERSAO_ATUAL, None)
                
        except Exception as e:
            # Se não tiver internet ou o GitHub cair, morre em silêncio
            print(f"📡 Aviso: Não foi possível verificar atualizações. Erro: {e}")
            callback_ui(False, VERSAO_ATUAL, None)

    # Inicia a busca invisível
    thread = threading.Thread(target=tarefa_em_background, daemon=True)
    thread.start()

def abrir_link_atualizacao(url):
    """Abre o navegador padrão na página da nova Release."""
    webbrowser.open(url)
