/**
 * Test 3: ws + proxy (http://127.0.0.1:7897)
 */
import WebSocket from 'ws';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const WSS_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0`,
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
};

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

function generateSecMsGec() {
  let ticks = Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  return crypto.createHash('sha256').update(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase();
}

function connectId() { return crypto.randomUUID().replace(/-/g, ''); }
function dateToString() { return new Date().toISOString().replace(/[-:.]/g, '').slice(0, -1); }
function mkssml(voice, text) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${text}</prosody></voice></speak>`;
}

async function testWithProxy() {
  console.log('=== Test: ws + headers + proxy (127.0.0.1:7897) ===');
  const secMsGec = generateSecMsGec();
  const connId = connectId();
  const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;
  const agent = new HttpsProxyAgent('http://127.0.0.1:7897');

  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: WSS_HEADERS, agent });
    let audioSize = 0;
    const timeout = setTimeout(() => { console.log('  ❌ TIMEOUT'); ws.close(); resolve(false); }, 15000);

    ws.on('open', () => {
      console.log('  ✓ Connected via proxy');
      ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = mkssml('zh-CN-XiaoxiaoNeural', '你好世界，这是代理测试');
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) { audioSize += data.length; }
      else {
        const msg = data.toString();
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          console.log(`  ✓ Audio: ${audioSize} bytes`);
          ws.close();
          resolve(true);
        }
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); console.log(`  ❌ Error: ${err.message}`); resolve(false); });
    ws.on('close', (code) => { clearTimeout(timeout); if (!audioSize) { console.log(`  ❌ Closed: ${code}`); resolve(false); } });
  });
}

async function testNoHeadersWithProxy() {
  console.log('\n=== Test: ws NO headers + proxy ===');
  const secMsGec = generateSecMsGec();
  const connId = connectId();
  const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;
  const agent = new HttpsProxyAgent('http://127.0.0.1:7897');

  return new Promise((resolve) => {
    const ws = new WebSocket(url, { agent }); // NO headers
    let audioSize = 0;
    const timeout = setTimeout(() => { console.log('  ❌ TIMEOUT'); ws.close(); resolve(false); }, 15000);

    ws.on('open', () => {
      console.log('  ✓ Connected via proxy (no headers)');
      ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = mkssml('zh-CN-XiaoxiaoNeural', '你好世界');
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) { audioSize += data.length; }
      else {
        const msg = data.toString();
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          console.log(`  ✓ Audio: ${audioSize} bytes`);
          ws.close();
          resolve(true);
        }
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); console.log(`  ❌ Error: ${err.message}`); resolve(false); });
    ws.on('close', (code) => { clearTimeout(timeout); if (!audioSize) { console.log(`  ❌ Closed: ${code}`); resolve(false); } });
  });
}

const r1 = await testWithProxy();
const r2 = await testNoHeadersWithProxy();

console.log('\n=== Results ===');
console.log(`Proxy + headers:  ${r1 ? '✅' : '❌'}`);
console.log(`Proxy, no headers: ${r2 ? '✅' : '❌'}`);
if (r1 && !r2) console.log('→ 需要代理 + 自定义头');
if (r1 && r2) console.log('→ 只需要代理（头不重要）');
if (!r1 && !r2) console.log('→ 代理也不行，需要进一步排查');
