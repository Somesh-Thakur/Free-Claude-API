# 🚀 Free Claude 3.5 Sonnet UI & Universal API Hub

An advanced, responsive, and 100% free AI Chat Interface built with Puter.js and Node.js. 

This project doesn't just duplicate the stunning capabilities and UI of Claude; it establishes a **Headless Browser Relay Architecture** that lets you consume the world's most powerful AI models via your own programmable REST API without needing paid tokens, API Keys, or dealing with CAPTCHAs!

## ✨ Features
1. **Multi-Model Support:** Dynamically switch across multiple top-tier AI models, including:
   - Claude 3.7 Sonnet (Thinking)
   - Claude 3.5 Sonnet (Fast Coding)
   - OpenAI GPT-4o
   - Google Gemini 2.5 Pro
   - DeepSeek R1 (Open-Source Reasoner)
2. **Beautiful Claude-like UI:** Responsive design with full Markdown, syntax-highlighting, tables, and KaTeX math rendering.
3. **Headless API Relay Bypass:** Host your own OpenAI-compatible `/v1/chat/completions` API endpoint that pipelines securely through your open Chrome tab, effortlessly bypassing Cloudflare bot-protections to deliver free AI requests straight to your terminal.

---

## 💻 Installation & Setup

1. **Clone & Install**
   ```bash
   git clone <your-repo-link>
   cd <repo-folder>
   npm install
   ```

2. **Start the Engine**
   ```bash
   node server.js
   ```

3. **Open the Front-End**
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser. 
   *(Crucial: You must keep this browser tab open for the automated API Engine to work!)*

---

## 🔌 API Documentation (The Relay Engine)

You can call your locally-hosted API using standard OpenAI format! **Because of the Relay Engine Architecture, your backend server pushes the request to your open Chrome tab, computes it via Puter's browser SDK, and streams the answer back to you.**

### POST `/api/v1/chat/completions`

**Example Python Execution:**
```python
import requests
import json

response = requests.post(
    "http://localhost:3000/api/v1/chat/completions",
    json={
        "model": "anthropic/claude-sonnet-4-6",
        "messages": [
            {"role": "user", "content": "Explain quantum computing in 2 sentences."}
        ],
        "stream": False 
    }
)

print(response.json()['choices'][0]['message']['content'])
```

### Supported API Models:
- `anthropic/claude-sonnet-4-6` (Claude 3.5)
- `anthropic/claude-3.7-sonnet:thinking` (Claude 3.7 Math/Logic)
- `openai/gpt-4o`
- `google/gemini-2.5-pro`
- `deepseek/deepseek-r1`

## Open Source Contributions
Contributions, issues, and feature requests are welcome!
