// muse-hands 内容脚本（M2：抓取 → 执行 → 填回）
//
// 从油猴探针 v0.1.2 平移并验证过的三件本事：
// 1) 哨兵认块：代码块第一行是 JSON 且 {"muse":"exec",...} 才认，
// 正文里引用这串字样的段落不会误触发；
// 2) 稳定判定：内容指纹 1 秒不变才算流式结束（探针实测值）；
// 3) 填回输入框：原生 value setter + input 事件，页面框架能感知。
//
// 与探针的区别：抓到块不再计数，而是递给本地 host 真执行；
// 结果只填回、不自动发送（2026-10-01 裁决①）；已执行的 id 写
// chrome.storage.local，刷新页面也不会重演历史命令。

(function () {
'use strict';

var STABLE_MS = 1000; // 内容多久不变算流式结束（探针实测值）
var MAX_RESULT = 8000; // M2 临时截断上限，定型在 M3
var STORE_KEY = 'mh_processed_ids';

var processed = {}; // id -> true（已执行过，跨刷新持久化）
var inFlight = {}; // id -> true（已发出、等结果）
var firstSeenAt = {};
var stableTimers = {};
var ready = false;
var pagePort = null;

// ---------- 哨兵解析 ----------
function parseBlock(text) {
var nl = text.indexOf('\n');
var first = nl === -1? text: text.slice(0, nl);
var head;
try { head = JSON.parse(first);} catch (e) { return null;}
if (!head || head.muse!== 'exec' ||!head.id) return null;
return {
id: String(head.id),
shell: head.shell || null,
timeout: head.timeout || null,
cmd: (nl === -1? '': text.slice(nl + 1)).trim()
};
}

function fingerprint(text) {
var h = 0;
for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0;}
return text.length + ':' + h;
}

// ---------- 去重（跨刷新持久化，防历史命令重演） ----------
function loadProcessed(done) {
try {
chrome.storage.local.get([STORE_KEY], function (res) {
var ids = (res && res[STORE_KEY]) || [];
ids.forEach(function (id) { processed[id] = true;});
ready = true;
if (done) done();
});
} catch (e) {
ready = true; // storage 不可用时退回仅本页去重
if (done) done();
}
}

function markProcessed(id) {
processed[id] = true;
try {
var obj = {};
obj[STORE_KEY] = Object.keys(processed).slice(-300);
chrome.storage.local.set(obj);
} catch (e) { /* 忽略：本页内去重仍然有效 */}
}

// ---------- 与 background 的长连接 ----------
function getPort() {
if (pagePort) return pagePort;
pagePort = chrome.runtime.connect({ name: 'muse-hands'});
pagePort.onMessage.addListener(function (msg) {
if (!msg) return;
if (msg.type === 'result') {
delete inFlight[msg.id];
fillComposer(formatResult(msg));
} else if (msg.type === 'error' && msg.id) {
delete inFlight[msg.id];
fillComposer('' + (msg.error || '未知错误'));
}
// progress 心跳帧只是保活长连接，不打扰页面
});
pagePort.onDisconnect.addListener(function () {
pagePort = null;
// 连接断开时结果下落不明，逐个写明，避免页面静默无回音
Object.keys(inFlight).forEach(function (id) {
fillComposer('与扩展后台的连接断开，结果未知。');
});
inFlight = {};
});
return pagePort;
}

function execBlock(block) {
if (!block.cmd) {
console.log('[muse-hands] 标记块 ' + block.id + ' 没有命令正文，跳过');
markProcessed(block.id);
return;
}
markProcessed(block.id); // 先落账再执行：刷新、重扫都不会重演
inFlight[block.id] = true;
console.log('[muse-hands] 执行 ' + block.id + '：', block.cmd.slice(0, 120));
try {
getPort().postMessage({
type: 'exec',
id: block.id,
cmd: block.cmd,
shell: block.shell,
timeout: block.timeout
});
} catch (e) {
delete inFlight[block.id];
fillComposer('发往扩展后台失败：' + e.message);
}
}

// ---------- 结果格式（M2 临时版，M3 定型） ----------
function clip(s, label) {
if (s == null) return '';
s = String(s);
if (s.length <= MAX_RESULT) return s;
return s.slice(0, MAX_RESULT) +
'\n';
}

function formatResult(res) {
var secs = ((res.duration_ms || 0) / 1000).toFixed(1);
var lines = [''];
if (res.error) lines.push('' + res.error);
if (res.stdout) lines.push(clip(res.stdout.replace(/\s+$/, ''), 'stdout'));
if (res.stderr) {
lines.push('');
lines.push(clip(res.stderr.replace(/\s+$/, ''), 'stderr'));
}
return lines.join('\n');
}

// ---------- 填回输入框（只填不发） ----------
function fillComposer(text) {
var ta = document.querySelector('textarea[data-hatch-composer]') ||
document.querySelector('textarea');
if (ta) {
var cur = ta.value || '';
var next = cur? cur.replace(/\s+$/, '') + '\n' + text: text;
var setter = Object.getOwnPropertyDescriptor(
window.HTMLTextAreaElement.prototype, 'value').set;
setter.call(ta, next);
ta.dispatchEvent(new Event('input', { bubbles: true}));
console.log('[muse-hands] 结果已填回输入框（未发送）');
return;
}
var ce = document.querySelector('[contenteditable="true"], div[role="textbox"]');
if (ce) {
ce.focus();
var ok = false;
try { ok = document.execCommand('insertText', false, text);} catch (e) { ok = false;}
if (!ok) {
ce.textContent = (ce.textContent || '') + text;
ce.dispatchEvent(new Event('input', { bubbles: true}));
}
console.log('[muse-hands] 结果已填回编辑框（未发送）');
return;
}
console.log('[muse-hands] 没找到输入框，结果只能进日志：', text.slice(0, 200));
}

// ---------- 扫描（与探针同策略） ----------
function scan() {
if (!ready) return;
var els = Array.prototype.slice.call(
document.querySelectorAll('pre code, code, [class*="code"]'));
var hits = els.filter(function (el) {
return parseBlock(el.innerText || el.textContent || '')!== null;
});
// 只留最里层元素，避免同一块被外层容器重复计入
hits = hits.filter(function (el) {
return!hits.some(function (other) {
return other!== el && el.contains(other);
});
});
hits.forEach(function (el) {
var text = el.innerText || el.textContent || '';
var block = parseBlock(text);
if (!block || processed[block.id] || inFlight[block.id]) return;
if (!firstSeenAt[block.id]) {
firstSeenAt[block.id] = Date.now();
console.log('[muse-hands] 标记块 ' + block.id + ' 出现了');
}
var fp = block.id + '|' + fingerprint(text);
clearTimeout(stableTimers[fp]);
stableTimers[fp] = setTimeout(function () {
if (processed[block.id] || inFlight[block.id]) return;
console.log('[muse-hands] 标记块 ' + block.id + ' 已稳定，开始执行');
execBlock(parseBlock(el.innerText || el.textContent || '') || block);
}, STABLE_MS);
});
}

var scanTimer = null;
new MutationObserver(function () {
clearTimeout(scanTimer);
scanTimer = setTimeout(scan, 300);
}).observe(document.documentElement, {
childList: true, subtree: true, characterData: true
});

loadProcessed(function () {
scan();
console.log('[muse-hands] 内容脚本已启动：抓到命令块将真执行，结果只填回不发送。');
});
})();
