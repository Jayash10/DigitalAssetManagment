"""
DAM Studio - GPT-2 Fine-tuned Chatbot Inference Server
Loads the trained_llm_model.pkl and serves chat completions via HTTP.
Node.js backend forwards requests to this server at http://localhost:5001
"""

import pickle
import sys
import json
import os
import torch
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from transformers import GPT2LMHeadModel, GPT2Tokenizer, GPT2Config

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'trained_llm_model.pkl')
PORT = 5001

print("=" * 60)
print("  DAM Studio - GPT-2 Chatbot Inference Server")
print(f"  Model: {MODEL_PATH}")
print(f"  Port:  {PORT}")
print("=" * 60)

# ── Load Model ────────────────────────────────────────────────
print("\n🔄 Loading fine-tuned model from pkl file... (~625 MB)")

with open(MODEL_PATH, 'rb') as f:
    checkpoint = pickle.load(f)

config    = checkpoint['config']
tokenizer = checkpoint['tokenizer']
state_dict = checkpoint['model_state_dict']

model = GPT2LMHeadModel(config)
model.load_state_dict(state_dict)
model.eval()

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(DEVICE)

tokenizer.pad_token = tokenizer.eos_token

print(f"✅ Model loaded on {DEVICE.upper()}!")
print(f"   Vocab size:   {config.vocab_size}")
print(f"   Max length:   {config.n_positions if hasattr(config, 'n_positions') else config.max_position_embeddings}")
print(f"   Parameters:   {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
print(f"\n🚀 Inference server starting on http://localhost:{PORT}\n")


def generate_response(user_message: str, max_new_tokens: int = 80) -> str:
    """Generate a chatbot response from the fine-tuned GPT-2 model."""
    # Format prompt the way the model was fine-tuned
    prompt = f"Human: {user_message.strip()}\nAssistant:"
    
    inputs = tokenizer(prompt, return_tensors='pt', truncation=True, max_length=512).to(DEVICE)
    
    with torch.no_grad():
        output_ids = model.generate(
            inputs['input_ids'],
            attention_mask=inputs['attention_mask'],
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=0.5,
            top_p=0.85,
            top_k=40,
            repetition_penalty=1.5,
            no_repeat_ngram_size=4,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    # Decode only newly generated tokens
    new_tokens = output_ids[0][inputs['input_ids'].shape[1]:]
    raw_response = tokenizer.decode(new_tokens, skip_special_tokens=True)

    # Stop at next conversational turn marker
    for stop in ['Human:', '\nHuman', 'User:', '\nUser', '<|endoftext|>', '\n\n\n']:
        if stop in raw_response:
            raw_response = raw_response.split(stop)[0]

    # Keep only the first 2 sentences to avoid rambling
    sentences = re.split(r'(?<=[.!?])\s+', raw_response.strip())
    trimmed = ' '.join(sentences[:2]).strip()

    return trimmed if len(trimmed) > 10 else raw_response.strip()


# ── HTTP Handler ──────────────────────────────────────────────
class ChatHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet server logs — only errors
        if '400' in str(args) or '500' in str(args):
            super().log_message(format, *args)

    def send_json(self, status: int, data: dict):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok', 'model': 'GPT-2 Fine-tuned', 'device': DEVICE})
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/chat':
            self.send_json(404, {'error': 'Endpoint not found. Use POST /chat'})
            return

        try:
            length  = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(length))
            message = payload.get('message', '').strip()

            if not message:
                self.send_json(400, {'error': 'message field is required'})
                return

            print(f"💬 User: {message}")
            response = generate_response(message)
            print(f"🤖 Bot:  {response}\n")

            self.send_json(200, {
                'success': True,
                'response': response,
                'model': 'GPT-2 Fine-tuned (DAM Studio)'
            })

        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Invalid JSON body'})
        except Exception as e:
            print(f"❌ Generation error: {e}")
            self.send_json(500, {'error': str(e)})


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), ChatHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹  Server stopped.")
        server.server_close()
