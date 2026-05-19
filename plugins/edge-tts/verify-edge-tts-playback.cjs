const fs = require('fs');
const path = require('path');

async function verifyPackageAudio(proxy) {
  const { Communicate } = require('edge-tts-universal');
  const options = { voice: 'zh-CN-XiaoxiaoNeural' };
  if (proxy) options.proxy = proxy;
  const communicate = new Communicate('你好，这是 Obsidian Edge TTS 插件的真实播放链路验证。', options);
  const chunks = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(Buffer.from(chunk.data));
    }
  }
  const audio = Buffer.concat(chunks);
  if (audio.length < 10000) {
    throw new Error(`Generated audio is too small: ${audio.length} bytes`);
  }
  const output = path.join(process.env.TEMP || process.cwd(), proxy ? 'edge-tts-verify-proxy.mp3' : 'edge-tts-verify-direct.mp3');
  fs.writeFileSync(output, audio);
  return { bytes: audio.length, output };
}

function verifyBundle() {
  const bundlePath = path.join(process.cwd(), 'main.js');
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const playbackSource = fs.readFileSync(path.join(process.cwd(), 'src', 'modules', 'audio-playback.ts'), 'utf8');
  const checks = {
    hasEdgeHeaders: bundle.includes('chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'),
    hasProxyAgent: bundle.includes('https-proxy-agent'),
    hasBrowserBuildMarker: bundle.includes('Universal build - proxy and environment detection removed'),
    usesReliableFallback: playbackSource.includes('const useMSE = false'),
    hasStreamErrorHandler: playbackSource.includes("readable.on('error'"),
  };
  if (!checks.hasEdgeHeaders || !checks.hasProxyAgent || checks.hasBrowserBuildMarker || !checks.usesReliableFallback || !checks.hasStreamErrorHandler) {
    throw new Error(`Bundle verification failed: ${JSON.stringify(checks)}`);
  }
  return checks;
}

(async () => {
  const bundle = verifyBundle();
  const direct = await verifyPackageAudio();
  const proxyUrl = process.argv[2];
  const proxy = proxyUrl ? await verifyPackageAudio(proxyUrl) : null;
  console.log(JSON.stringify({ ok: true, bundle, direct, proxy }, null, 2));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
