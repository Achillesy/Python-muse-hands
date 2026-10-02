// muse-hands 扩展 service worker
// M1：点图标 → ping 本地 host → pong 回来徽标变 ✓（通桥验收）。
// M2：内容脚本经长连接 Port 递来 exec → 转 Native Messaging 给 host →
//     host 的 result / progress 沿原路回内容脚本。图标徽标即状态：
//     … 执行中、✓ 就绪/完成、✕ 断开。
// M4 预备：pong 里的 hostname 缓存进 chrome.storage.local，
//          供内容脚本读取，做 §6.7 hostname 路由。

const HOST = "com.muse.hands";
const HOSTNAME_KEY = "mh_local_hostname";
let nativePort = null;
const pending = new Map(); // exec id -> 页面 Port

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

function ensureNativePort() {
  if (nativePort) return nativePort;
  nativePort = chrome.runtime.connectNative(HOST);
  nativePort.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "pong") {
      setBadge("✓", "#2e7d32");
      // M4 预备：缓存本机 hostname，供 §6.7 路由用
      if (msg.hostname) {
        try {
          const obj = {};
          obj[HOSTNAME_KEY] = msg.hostname;
          chrome.storage.local.set(obj);
        } catch (e) {}
      }
      return;
    }
    if (msg.type === "result" || msg.type === "error" || msg.type === "progress") {
      const page = pending.get(msg.id);
      if (msg.type !== "progress" && page) pending.delete(msg.id);
      if (page) {
        try {
          page.postMessage(msg);
        } catch (e) {
          /* 页面已关，丢掉即可 */
        }
      }
      if (msg.type === "result") setBadge("✓", "#2e7d32");
      if (msg.type === "error") setBadge("✕", "#c62828");
    }
  });
  nativePort.onDisconnect.addListener(() => {
    console.log("[muse-hands] native port disconnected:", chrome.runtime.lastError);
    nativePort = null;
    setBadge("✕", "#c62828");
    for (const [id, page] of pending) {
      try {
        page.postMessage({ type: "error", id, error: "本地 host 连接已断开" });
      } catch (e) {}
    }
    pending.clear();
  });
  return nativePort;
}

chrome.action.onClicked.addListener(() => {
  setBadge("…", "#616161");
  try {
    ensureNativePort().postMessage({ type: "ping", id: "m1-" + Date.now() });
  } catch (e) {
    console.error("[muse-hands] connectNative failed:", e);
    setBadge("✕", "#c62828");
  }
});

chrome.runtime.onConnect.addListener((pagePort) => {
  if (pagePort.name !== "muse-hands") return;
  pagePort.onMessage.addListener((msg) => {
    if (msg && msg.type === "exec" && msg.id && msg.cmd) {
      try {
        pending.set(msg.id, pagePort);
        setBadge("…", "#616161");
        ensureNativePort().postMessage({
          type: "exec",
          id: msg.id,
          cmd: msg.cmd,
          shell: msg.shell || undefined,
          timeout: msg.timeout || undefined,
        });
      } catch (e) {
        pending.delete(msg.id);
        try {
          pagePort.postMessage({
            type: "error",
            id: msg.id,
            error: "发往本地 host 失败：" + e.message,
          });
        } catch (err) {}
        setBadge("✕", "#c62828");
      }
    }
  });
  pagePort.onDisconnect.addListener(() => {
    for (const [id, p] of pending) if (p === pagePort) pending.delete(id);
  });
});