import streamlit as st
import os
from dotenv import load_dotenv
from billie_project.agent import orquestrar_pipeline_fatura

load_dotenv()

st.set_page_config(page_title="Billie-BI Agent", page_icon="🧾", layout="centered")

st.title("🧾 Billie: Processador de Faturas")
st.markdown("Faz o upload da tua fatura em PDF. O processamento é seguro e os dados sensíveis não são enviados para a nuvem.")

arquivo_pdf = st.file_uploader("Seleciona a fatura do cartão", type=["pdf"])

senha_padrao = os.getenv("FATURA_SENHA", "")
senha_input = st.text_input("Senha do PDF (se aplicável)", value=senha_padrao, type="password")

if st.button("🚀 Processar e Enviar para o Notion"):
    if arquivo_pdf is None:
        st.warning("⚠️ Por favor, faz o upload de um ficheiro PDF primeiro.")
    else:
        temp_path = f"temp_{arquivo_pdf.name}"
        
        with open(temp_path, "wb") as f:
            f.write(arquivo_pdf.getbuffer())
            
        try:
            with st.spinner('A extrair dados, a higienizar com IA e a sincronizar com o Notion...'):
                
                df_resultado = orquestrar_pipeline_fatura(temp_path, senha_input)
                
            st.success("✅ Processamento concluído com sucesso!")
            
            st.subheader("📊 Resumo das Transações")
            st.dataframe(df_resultado[['Data', 'Nome_Fantasia', 'Valor']], use_container_width=True)
            
            total_gasto = df_resultado['Valor'].sum()
            st.metric(label="Total Processado", value=f"R$ {total_gasto:.2f}")

        except Exception as e:
            st.error(f"❌ Ocorreu um erro durante o processamento: {e}")
            
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
