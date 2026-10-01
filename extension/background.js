// muse-hands 扩展 service worker
// M1 的活：点扩展图标 → 经 Native Messaging 敲一下本地 host →
// host 答 pong → 图标徽标变 ✓，即通桥。
// M2 起，内容脚本抓到的命令块会通过 runtime 消息递进来。

const HOST = "com.muse.hands";
let port = null;

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

function ensurePort() {
  if (port) return port;
  port = chrome.runtime.connectNative(HOST);
  port.onMessage.addListener((msg) => {
    console.log("[muse-hands] host ->", msg);
    if (msg && msg.type === "pong") setBadge("✓", "#2e7d32");
  });
  port.onDisconnect.addListener(() => {
    console.log("[muse-hands] native port disconnected:", chrome.runtime.lastError);
    port = null;
    setBadge("✕", "#c62828");
  });
  return port;
}

chrome.action.onClicked.addListener(() => {
  setBadge("…", "#616161");
  try {
    ensurePort().postMessage({ type: "ping", id: "m1-" + Date.now() });
  } catch (e) {
    console.error("[muse-hands] connectNative failed:", e);
    setBadge("✕", "#c62828");
  }
});

// 内容脚本（M2）将通过 runtime 消息发来 {type:"exec", id, cmd, shell}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "exec") {
    const p = ensurePort();
    const id = msg.id || "exec-" + Date.now();
    const handler = (res) => {
      if (res && res.type === "result" && res.id === id) {
        p.onMessage.removeListener(handler);
        sendResponse(res);
      }
    };
    p.onMessage.addListener(handler);
    p.postMessage({ type: "exec", id, cmd: msg.cmd, shell: msg.shell });
    return true; // 异步 sendResponse
  }
});
