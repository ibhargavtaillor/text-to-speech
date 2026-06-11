// Popup = stateless remote control. It holds NO playback state: it asks the
// worker for a snapshot on open and listens for pushed updates. This keeps the
// controls correct even though the popup is destroyed every time it closes.
import { MSG } from '../shared/messages.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let tabId = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;

  await populateVoices();
  bindControls();

  const state = await send({ type: MSG.GET_STATE });
  applyPrefsToUI(state?.prefs);
  render(state);
}

function bindControls() {
  $('play').onclick = onPlay;
  $('pause').onclick = async () => render(await send({ type: MSG.PAUSE }));
  $('stop').onclick = async () => render(await send({ type: MSG.STOP }));
  $('next').onclick = async () => render(await send({ type: MSG.NEXT }));
  $('prev').onclick = async () => render(await send({ type: MSG.PREV }));
  $('pick').onclick = async () => {
    // Arm hover-to-select on the page, then close the popup so the user can
    // interact with the page directly. Selection lives in the content script,
    // independent of the popup's lifecycle.
    await send({ type: MSG.ENTER_PICK, tabId });
    window.close();
  };
  $('rescan').onclick = async () => {
    const r = await send({ type: MSG.RESCAN });
    if (typeof r?.added === 'number') flashTitle(r.added ? `+${r.added} new sections` : 'No new content');
    render(r);
  };

  $('voice').onchange = (e) => send({ type: MSG.SET_PREFS, prefs: { voiceName: e.target.value } });
  $('rate').oninput = (e) => {
    $('rateOut').textContent = `${(+e.target.value).toFixed(1)}×`;
    send({ type: MSG.SET_PREFS, prefs: { rate: +e.target.value } });
  };
  $('pitch').oninput = (e) => {
    $('pitchOut').textContent = (+e.target.value).toFixed(1);
    send({ type: MSG.SET_PREFS, prefs: { pitch: +e.target.value } });
  };
}

async function onPlay() {
  const state = await send({ type: MSG.GET_STATE });
  // First play for this tab (or a different tab is loaded) → extract fresh.
  const needsExtract = state?.status === 'idle' || state?.tabId !== tabId;
  const res = needsExtract
    ? await send({ type: MSG.START_FROM_POPUP, tabId })
    : await send({ type: MSG.PLAY });

  if (res?.error === 'NO_CONTENT') {
    showError('Could not find readable content on this page.');
  } else {
    clearError();
  }
  render(res);
}

// Live pushes from the worker (advance, stop, prefs echo, rescan).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === MSG.STATE) render(msg.state);
});

function render(state) {
  if (!state) return;
  const playing = state.status === 'playing';
  $('play').hidden = playing;
  $('pause').hidden = !playing;

  $('status').textContent =
    { idle: 'Ready', playing: 'Playing', paused: 'Paused' }[state.status] || 'Ready';
  $('section').textContent = state.total ? `Section ${state.section} / ${state.total}` : '—';

  if (state.title) {
    $('title').textContent = state.title;
    $('title').title = state.title;
  }
}

function applyPrefsToUI(prefs) {
  if (!prefs) return;
  if (prefs.rate != null) { $('rate').value = prefs.rate; $('rateOut').textContent = `${(+prefs.rate).toFixed(1)}×`; }
  if (prefs.pitch != null) { $('pitch').value = prefs.pitch; $('pitchOut').textContent = (+prefs.pitch).toFixed(1); }
  if (prefs.voiceName) $('voice').value = prefs.voiceName;
}

async function populateVoices() {
  const voices = await new Promise((r) => chrome.tts.getVoices(r));
  const sel = $('voice');
  if (!voices || voices.length === 0) {
    sel.innerHTML = '<option value="">System default</option>';
    return;
  }
  sel.innerHTML = voices
    .sort((a, b) => (a.lang || '').localeCompare(b.lang || ''))
    .map((v) => `<option value="${escapeHtml(v.voiceName)}">${escapeHtml(v.voiceName)} · ${escapeHtml(v.lang || '')}</option>`)
    .join('');
}

function flashTitle(text) {
  const el = $('title');
  const prev = el.textContent;
  el.textContent = text;
  setTimeout(() => (el.textContent = prev), 1500);
}

function showError(text) { const e = $('error'); e.textContent = text; e.hidden = false; }
function clearError() { $('error').hidden = true; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
