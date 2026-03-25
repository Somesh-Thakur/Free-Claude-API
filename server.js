require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const EventEmitter = require('events');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = process.env.CORS_ORIGINS || '*';

// Relay Engine event bus
const relayEmitter = new EventEmitter();
// To prevent memory leak warnings on many concurrent requests
relayEmitter.setMaxListeners(0); 

// Global state to track connected relay clients (the browser UI tabs)
let connectedRelayClients = 0;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS.split(',').map(o => o.trim())
}));

app.use(express.json({ limit: '5mb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).send({ error: 'Invalid JSON format' });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Phase 2: Browser Relay Connectivity ─────────────────────────────────────

// The Frontend connects to this endpoint using EventSource to receive commands
app.get('/api/relay/subscribe', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish stream immediately

  connectedRelayClients++;
  console.log(`[Relay] Browser client connected. Active workers: ${connectedRelayClients}`);

  // Send an initial ping
  res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

  // Listen for new tasks arriving from Python scripts
  const onNewTask = (taskData) => {
    res.write(`data: ${JSON.stringify(taskData)}\n\n`);
  };

  relayEmitter.on('dispatch_task', onNewTask);

  // Keep-alive heartbeat to prevent timeouts
  const heartbeat = setInterval(() => {
    res.write(`:\n\n`); // SSE comment
  }, 15000);

  req.on('close', () => {
    connectedRelayClients--;
    console.log(`[Relay] Browser client disconnected. Active workers: ${connectedRelayClients}`);
    clearInterval(heartbeat);
    relayEmitter.off('dispatch_task', onNewTask);
  });
});

// The Frontend POSTs streaming chunks back to the server to fulfill a task
app.post('/api/relay/chunk', (req, res) => {
  const { taskId, text, isDone, error } = req.body;
  if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

  // Route the chunk directly to the HTTP response waiting for this taskId
  relayEmitter.emit(`chunk_${taskId}`, { text, isDone, error });
  
  res.status(200).json({ success: true });
});


// ─── Phase 3: External API Bridge (For Python / external apps) ───────────────

app.post('/api/v1/chat/completions', async (req, res) => {
  if (connectedRelayClients === 0) {
    return res.status(503).json({
      error: {
        message: "No browser relay workers are currently connected. Please open the Chat UI in a browser tab to process backend API requests.",
        type: "relay_offline_error"
      }
    });
  }

  const { model = 'anthropic/claude-sonnet-4-6', messages, stream = false } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: { message: "Invalid 'messages' format." } });
  }

  const taskId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  const taskData = {
    type: 'execute_chat',
    taskId,
    model,
    messages,
    stream: true // We always force the frontend to stream so we can route it flawlessly
  };

  // Give the waiting clients a timeout
  let isResolved = false;

  // Dispatch the task to the frontend browser!
  relayEmitter.emit('dispatch_task', taskData);

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const chunkListener = ({ text, isDone, error }) => {
      if (isResolved) return;
      
      if (error) {
        res.write(`data: ${JSON.stringify({ error: { message: error } })}\n\n`);
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        return res.end();
      }

      if (isDone) {
        res.write(`data: [DONE]\n\n`);
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        return res.end();
      }

      if (text) {
        const chunkSpec = {
          id: `chatcmpl-${taskId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ delta: { content: text }, index: 0, finish_reason: null }]
        };
        res.write(`data: ${JSON.stringify(chunkSpec)}\n\n`);
      }
    };

    relayEmitter.on(`chunk_${taskId}`, chunkListener);

    // Timeout if frontend disconnects or crashes during task
    setTimeout(() => {
      if (!isResolved) {
        res.write(`data: ${JSON.stringify({ error: { message: "Relay worker timeout." } })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        res.end();
      }
    }, 60000 * 5); // 5 min timeout for giant outputs

    req.on('close', () => {
      isResolved = true;
      relayEmitter.off(`chunk_${taskId}`, chunkListener);
    });

  } else {
    // Non-streaming requested by python, but we stream aggressively internally.
    let fullText = "";
    
    const chunkListener = ({ text, isDone, error }) => {
      if (isResolved) return;

      if (error) {
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        return res.status(500).json({ error: { message: error } });
      }

      if (text) {
        fullText += text;
      }

      if (isDone) {
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        res.json({
          id: `chatcmpl-${taskId}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ message: { role: 'assistant', content: fullText }, index: 0, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
      }
    };

    relayEmitter.on(`chunk_${taskId}`, chunkListener);

    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        relayEmitter.off(`chunk_${taskId}`, chunkListener);
        res.status(504).json({ error: { message: "Relay worker timeout." } });
      }
    }, 60000 * 5);
  }
});


// ─── Catch-all → SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Advanced Relay Server running at http://localhost:${PORT}`);
  console.log(`🔌 OpenAI API:       POST http://localhost:${PORT}/api/v1/chat/completions`);
  console.log(`💡 Keep the Chat UI open in a browser tab to activate the free API engine!\n`);
});

module.exports = app;
