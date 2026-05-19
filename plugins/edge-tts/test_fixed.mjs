/**
 * Test: 使用 Python edge-tts 7.2.8 相同的参数
 */
import WebSocket from 'ws';
import crypto from 'crypto';

// === 使用 Python edge-tts 7.2.8 的常量 ===
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';  // Python 7.2.8 版本
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const WSS_HEADERS = {
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`,
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

async function test(label, headers) {
  console.log(`\n=== ${label} ===`);
  const secMsGec = generateSecMsGec();
  const connId = connectId();
  const url = `${WSS_URL}&ConnectionId=${connId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let audioSize = 0;
    const timeout = setTimeout(() => { console.log('  ❌ TIMEOUT'); ws.close(); resolve(false); }, 15000);

    ws.on('open', () => {
      console.log('  ✓ Connected');
      ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = mkssml('zh-CN-XiaoxiaoNeural', '你好世界这是一个测试');
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) { audioSize += data.length; }
      else if (data.toString().includes('Path:turn.end')) {
        clearTimeout(timeout);
        console.log(`  ✓ Audio: ${audioSize} bytes`);
        ws.close(); resolve(true);
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); console.log(`  ❌ Error: ${err.message}`); resolve(false); });
    ws.on('close', (code) => { clearTimeout(timeout); if (!audioSize) { console.log(`  ❌ Closed: ${code}`); resolve(false); } });
  });
}

// Test 1: Full Python-equivalent headers (with Cookie/MUID)
const r1 = await test('Full headers + MUID cookie', WSS_HEADERS);

// Test 2: Without MUID cookie
const { Cookie, ...headersNoCookie } = WSS_HEADERS;
const r2 = await test('Headers without Cookie', headersNoCookie);

// Test 3: No headers at all (browser simulation)
const r3 = await test('No headers (browser WebSocket)', {});

console.log('\n=== Summary ===');
console.log(`Full headers + MUID: ${r1 ? '✅' : '❌'}`);
console.log(`Headers no Cookie:   ${r2 ? '✅' : '❌'}`);
console.log(`No headers:          ${r3 ? '✅' : '❌'}`);
