const fetch = require('node-fetch');

async function test() {
  console.log('Testing Node Relay API...');
  const start = Date.now();
  try {
    const res = await fetch('http://localhost:3000/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [{role: 'user', content: 'Say exactly: "Relay backend is active!"'}],
        stream: false
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    console.log(`Took ${(Date.now() - start)/1000}s`);

  } catch(err) {
    console.error('Error:', err);
  }
}

test();
