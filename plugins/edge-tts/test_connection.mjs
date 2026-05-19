/**
 * Edge TTS 连通性测试脚本
 * 测试两种连接方式：
 * 1. ws 库 + 自定义头（Python CLI 同等方式）
 * 2. 原生 WebSocket（浏览器/Obsidian 方式）
 * 
 * 用法: node test_connection.mjs
 */

import WebSocket from 'ws';
import crypto from 'crypto';

// === Constants (from edge-tts-universal) ===
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const WSS_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
};

// === DRM Token Generation ===
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

async function generateSecMsGec() {
  let ticks = Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  const hash = crypto.createHash('sha256').update(strToHash).digest('hex').toUpperCase();
  return hash;
}

function connectId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function dateToString() {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, -1);
}

function mkssml(voice, text) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${text}</prosody></voice></speak>`;
}

// === Test 1: ws library with headers (like Python CLI) ===
async function testWithWsHeaders() {
  console.log('\n=== Test 1: ws + headers ===');
  const secMsGec = await generateSecMsGec();
  const connId = connectId();
  const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: WSS_HEADERS });
    let audioSize = 0;
    let gotTurnStart = false;
    const timeout = setTimeout(() => {
      console.log('  ❌ TIMEOUT (10s)');
      ws.close();
      resolve(false);
    }, 10000);

    ws.on('open', () => {
      console.log('  ✓ WebSocket connected');
      // Send speech config
      ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      // Send SSML
      const ssml = mkssml('zh-CN-XiaoxiaoNeural', '你好世界');
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        audioSize += data.length;
      } else {
        const msg = data.toString();
        if (msg.includes('Path:turn.start')) gotTurnStart = true;
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          console.log(`  ✓ Audio received: ${audioSize} bytes`);
          console.log(`  ✓ turn.start: ${gotTurnStart}`);
          ws.close();
          resolve(true);
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`  ❌ Error: ${err.message}`);
      resolve(false);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (audioSize === 0) {
        console.log(`  ❌ Closed without audio. Code: ${code}, Reason: ${reason?.toString()}`);
        resolve(false);
      }
    });
  });
}

// === Test 2: ws library WITHOUT headers (simulates browser WebSocket) ===
async function testWithoutHeaders() {
  console.log('\n=== Test 2: ws WITHOUT headers (browser simulation) ===');
  const secMsGec = await generateSecMsGec();
  const connId = connectId();
  const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

  return new Promise((resolve) => {
    // No headers - this is what browser WebSocket does
    const ws = new WebSocket(url);
    let audioSize = 0;
    const timeout = setTimeout(() => {
      console.log('  ❌ TIMEOUT (10s)');
      ws.close();
      resolve(false);
    }, 10000);

    ws.on('open', () => {
      console.log('  ✓ WebSocket connected');
      ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = mkssml('zh-CN-XiaoxiaoNeural', '你好世界');
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        audioSize += data.length;
      } else {
        const msg = data.toString();
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          console.log(`  ✓ Audio received: ${audioSize} bytes`);
          ws.close();
          resolve(true);
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`  ❌ Error: ${err.message}`);
      resolve(false);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (audioSize === 0) {
        console.log(`  ❌ Closed without audio. Code: ${code}, Reason: ${reason?.toString()}`);
        resolve(false);
      }
    });
  });
}

// === Run Tests ===
console.log('Edge TTS Connection Test');
console.log('========================');

const test1 = await testWithWsHeaders();
const test2 = await testWithoutHeaders();

console.log('\n=== Summary ===');
console.log(`Test 1 (ws + headers):     ${test1 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (ws, no headers):   ${test2 ? '✅ PASS' : '❌ FAIL'}`);

if (test1 && !test2) {
  console.log('\n结论: 服务需要自定义HTTP头，原生WebSocket（无头）不行。');
  console.log('修复方案: 插件需要使用 ws 库或其他能设置header的方式。');
} else if (test1 && test2) {
  console.log('\n结论: 两种方式都能连通，问题可能在其他环节（音频解码/播放）。');
} else if (!test1 && !test2) {
  console.log('\n结论: 两种方式都失败，可能是网络/代理问题。');
}
