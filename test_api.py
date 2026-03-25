import requests
import json
import time

print("Testing API...")
start = time.time()
try:
    response = requests.post(
        "http://localhost:3000/api/v1/chat/completions",
        json={
            "model": "anthropic/claude-sonnet-4-6",
            "messages": [{"role": "user", "content": "Write a 5 sentence poem."}],
            "stream": False
        },
        timeout=30
    )
    print("Response Status:", response.status_code)
    try:
        data = response.json()
        print("Response Body:", json.dumps(data, indent=2))
        print("Time took:", round(time.time() - start, 2), "s")
    except Exception as e:
        print("Raw text:", response.text)
except requests.exceptions.RequestException as e:
    print("Request failed:", str(e))
