# 🐙 Billie - Smart Personal Finance Manager

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python Version](https://img.shields.io/badge/python-3.10%2B-blue)

**Billie** is an open-source desktop application designed to automate the extraction, cleaning, and categorization of bank statement PDFs, sending the structured data directly to a **Notion Database**. 

Built with a local-first approach, Billie uses **Google Gemini AI** to understand your expenses and a **Bring Your Own Key (BYOK)** architecture to ensure your data and API limits remain entirely under your control.

## 🛡️ Privacy First (Local & BYOK)

Financial data is highly sensitive, and Billie was built from day one to respect your privacy. Here is how we guarantee your data stays yours:

* **No Middlemen Servers:** Billie runs 100% locally on your machine. There are no proprietary backend servers intercepting, storing, or analyzing your bank statements.
* **Anonymized AI Processing:** When cleaning your data, **Google Gemini only receives the raw transaction descriptions** (e.g., "PGTO DLVRY*UBR"). Your account numbers, balances, and the actual purchase amounts are NEVER sent to the AI. They remain strictly on your local machine until pushed to your private Notion database.
* **Direct Connections Only:** When you process a PDF, the data travels directly from your computer to Google Gemini (for AI cleaning) and then straight into your personal Notion database.
* **Bring Your Own Key (BYOK):** Because you use your own API keys, your data is governed entirely by your own agreements with Google and Notion. The developer has zero access to your accounts, keys, or transactions.
* **Local Credentials:** Your API keys are encrypted and stored locally in a hidden `.env` file on your hard drive. They never leave your computer except to authenticate with the official APIs.
---

## ✨ Features

* **📄 Intelligent PDF Parsing:** Extracts messy transaction data from bank statements (currently optimized for Santander).
* **🧠 AI-Powered Cleaning:** Uses Google Gemini to translate cryptic bank descriptions (e.g., "PGTO DLVRY*UBR") into clean names ("Uber Eats") and automatically suggests the expense category.
* **📓 Seamless Notion Integration:** Pushes the processed transactions directly into your personal Notion database.
* **💻 Local Desktop GUI:** A clean, user-friendly interface built with CustomTkinter.
* **🔄 Smart Updater:** Built-in background checker that notifies you whenever a new release is available on GitHub.
* **🔒 Secure BYOK Model:** Your API keys are encrypted and saved locally on your machine in a hidden `.env` file. No cloud servers in the middle.

---

## 🚀 How to Use (For Regular Users)

You don't need to know how to code to use Billie!

1. Go to the **Releases** tab on this repository.
2. Download the latest `Billie-vX.X.zip` file.
3. Extract the folder and double-click the `Billie-BI.exe` file.
4. On your first run, click the **Gear Icon (⚙️)** in the top right corner to set up your APIs:
   * **Notion Token & Database ID:** To allow Billie to write to your Notion.
   * **Gemini API Key:** To power the AI categorization (Free tier available).
5. Save your keys, select your PDF, and hit process!

---

## 🛠️ How to Run (For Developers)

If you want to contribute or run the source code directly:

**1. Clone the repository:**
```bash
git clone [https://github.com/eduardoteranisi/billie-project.git](https://github.com/eduardoteranisi/billie-project.git)
cd billie-project
```

**2. Create and activate a virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**3. Install the dependencies:**
```bash
pip install -r requirements.txt
```

**4. Run the application:**
```bash
python app_ui.py
```

---

## 🤝 Contributing
Pull requests are welcome! If you want to add support for a new bank's PDF format or improve the AI prompting, feel free to open an issue or submit a PR.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

Developed with ☕ by [Eduardo Teranisi](https://github.com/eduardoteranisi).
