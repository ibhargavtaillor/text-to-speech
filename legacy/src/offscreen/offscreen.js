// speechSynthesis fallback host. Driven by the service worker via runtime
// messages; reports boundary/end/error events back so highlighting still works.
//
// We re-declare the message constants inline — this is a classic script and the
// strings must match shared/messages.js (type: 'OFFSCREEN').
const TYPE = 'OFFSCREEN';

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function reportToWorker(event, extra = {}) {
  chrome.runtime.sendMessage({ type: TYPE, event, ...extra }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== TYPE || !msg.cmd) return;

  switch (msg.cmd) {
    case 'speak': {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg.text);
      const { voiceName, lang, rate, pitch } = msg.opts || {};
      if (lang) u.lang = lang;
      if (rate) u.rate = rate;
      if (pitch != null) u.pitch = pitch;
      if (voiceName) {
        const v = voices.find((x) => x.name === voiceName);
        if (v) u.voice = v;
      }
      u.onboundary = (e) => reportToWorker('boundary', { charIndex: e.charIndex });
      u.onend = () => reportToWorker('end');
      u.onerror = (e) => reportToWorker('error', { message: e.error || 'synthesis error' });
      speechSynthesis.speak(u);
      break;
    }
    case 'pause':
      speechSynthesis.pause();
      break;
    case 'resume':
      speechSynthesis.resume();
      break;
    case 'stop':
      speechSynthesis.cancel();
      break;
  }
});
