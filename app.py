import sys
import os

pasta_raiz = os.path.dirname(os.path.abspath(__file__))
if pasta_raiz not in sys.path:
    sys.path.insert(0, pasta_raiz)

import customtkinter as ctk
from tkinter import filedialog
from datetime import datetime
import threading
from billie_project import agent

# Configuração visual base
ctk.set_appearance_mode("dark")  # Modo escuro elegante
ctk.set_default_color_theme("blue")  # Tema de cores dos botões

class BillieApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Configurações da Janela
        self.title("Processador de Faturas")
        self.geometry("600x550")
        self.resizable(False, False)

        # --- TÍTULO ---
        self.label_titulo = ctk.CTkLabel(self, text="Billie", font=ctk.CTkFont(size=28, weight="bold"))
        self.label_titulo.pack(pady=(20, 5))
        
        self.label_subtitulo = ctk.CTkLabel(self, text="Extração local e segura para o Notion", text_color="gray")
        self.label_subtitulo.pack(pady=(0, 20))

        # --- FRAME DE ARQUIVO ---
        self.frame_arquivo = ctk.CTkFrame(self)
        self.frame_arquivo.pack(pady=10, padx=20, fill="x")

        self.caminho_arquivo = ctk.StringVar()
        
        self.entry_arquivo = ctk.CTkEntry(self.frame_arquivo, textvariable=self.caminho_arquivo, state="readonly", width=400)
        self.entry_arquivo.pack(side="left", padx=(10, 10), pady=15)

        self.btn_procurar = ctk.CTkButton(self.frame_arquivo, text="Procurar PDF", command=self.selecionar_arquivo, width=120)
        self.btn_procurar.pack(side="right", padx=(0, 10), pady=15)

        # --- FRAME DE CONFIGURAÇÕES (Senha, Banco, Ano) ---
        self.frame_config = ctk.CTkFrame(self)
        self.frame_config.pack(pady=10, padx=20, fill="x")

        # Senha
        self.label_senha = ctk.CTkLabel(self.frame_config, text="Senha do PDF:")
        self.label_senha.grid(row=0, column=0, padx=10, pady=(15, 5), sticky="w")
        self.entry_senha = ctk.CTkEntry(self.frame_config, show="*", width=150)
        self.entry_senha.grid(row=1, column=0, padx=10, pady=(0, 15), sticky="w")

        # Banco
        self.label_banco = ctk.CTkLabel(self.frame_config, text="Selecione o Banco:")
        self.label_banco.grid(row=0, column=1, padx=10, pady=(15, 5), sticky="w")
        self.combo_banco = ctk.CTkComboBox(self.frame_config, values=["Nubank", "XP / Rico", "Santander"], width=150)
        self.combo_banco.grid(row=1, column=1, padx=10, pady=(0, 15), sticky="w")

        # Ano da Fatura
        self.label_ano = ctk.CTkLabel(self.frame_config, text="Ano da Fatura:")
        self.label_ano.grid(row=0, column=2, padx=10, pady=(15, 5), sticky="w")
        anos_disponiveis = ["Automático (Recomendado)"] + [str(ano) for ano in range(datetime.now().year, 2020, -1)]
        self.combo_ano = ctk.CTkComboBox(self.frame_config, values=anos_disponiveis, width=190)
        self.combo_ano.grid(row=1, column=2, padx=10, pady=(0, 15), sticky="w")

        # --- BOTÃO PROCESSAR ---
        self.btn_processar = ctk.CTkButton(self, text="Processar Fatura", font=ctk.CTkFont(size=16, weight="bold"), height=40, command=self.iniciar_processamento)
        self.btn_processar.pack(pady=20)

        # --- CAIXA DE LOGS / STATUS ---
        self.caixa_logs = ctk.CTkTextbox(self, width=560, height=120, state="disabled")
        self.caixa_logs.pack(padx=20, pady=(0, 20))
        self.escrever_log("Pronto para iniciar. Selecione o arquivo PDF.")

    def selecionar_arquivo(self):
        caminho = filedialog.askopenfilename(filetypes=[("Arquivos PDF", "*.pdf")])
        if caminho:
            self.caminho_arquivo.set(caminho)
            self.escrever_log(f"Arquivo selecionado: {caminho.split('/')[-1]}")

    def escrever_log(self, mensagem):
        """Adiciona uma mensagem na caixa preta de logs da interface"""
        self.caixa_logs.configure(state="normal")
        self.caixa_logs.insert("end", f"> {mensagem}\n")
        self.caixa_logs.see("end")  # Rola para o final automaticamente
        self.caixa_logs.configure(state="disabled")

    def iniciar_processamento(self):
        arquivo = self.caminho_arquivo.get()
        senha = self.entry_senha.get()
        banco = self.combo_banco.get()
        ano = self.combo_ano.get()

        if not arquivo:
            self.escrever_log("⚠️ Erro: Nenhum arquivo selecionado.")
            return

        # Trava o botão para o usuário não clicar duas vezes
        self.btn_processar.configure(state="disabled", text="Processando...")
        
        # Cria a função que vai rodar em paralelo
        def tarefa_em_background():
            # Chama o agente passando a função escrever_log como canal de comunicação
            sucesso = agent.orquestrar_pipeline(arquivo, senha, banco, ano, self.escrever_log)
            
            # O CustomTkinter exige que atualizações visuais sejam feitas na Thread principal.
            # O .after(0, ...) garante que o botão volte ao normal com segurança.
            self.after(0, self.finalizar_processamento, sucesso)

        # Inicia a Thread paralela (daemon=True garante que ela morre se fechar o app)
        threading.Thread(target=tarefa_em_background, daemon=True).start()

    def finalizar_processamento(self, sucesso):
        """Reativa a interface após o processamento terminar (com sucesso ou erro)"""
        if sucesso:
            self.btn_processar.configure(state="normal", text="Processar Outra Fatura")
        else:
            self.btn_processar.configure(state="normal", text="Tentar Novamente")

# Inicializa a aplicação
if __name__ == "__main__":
    app = BillieApp()
    app.mainloop()
