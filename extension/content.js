// webai-hands 内容脚本（核心层，与站点无关）
//
// 架构：核心层 + 适配器层（每站点一份）。
// 适配器通过 window.__museHandsAdapters[hostname] 注册；
// 核心层按 location.hostname 选一个，调用它的：
//   findBlocks()  → 返回候选元素数组
//   fillResult()  → 填回输入框，返回 bool
//   clickSend()   → 点发送，返回 bool
// 新加一个 Web AI = 新加 adapters/xxx.js + 在 manifest 里注册，
// 核心层零改动。
//
// 规矩：抓到块递给本地 host 真执行；结果只填回、不自动发送
//（除非用户在扩展面板里亲手开了自动发送）；已执行的 id 写
// chrome.storage.local，刷新页面不重演历史命令。

(function () {
'use strict';

var STABLE_MS = 1000;
var MAX_RESULT = 6000;
var KEEP_HEAD = 2000;
var KEEP_TAIL = 3500;
var STORE_KEY = 'mh_processed_ids';
var AUTO_KEY = 'mh_auto_send';
var HOSTNAME_KEY = 'mh_local_hostname';

// ---------- 选适配器 ----------
var adapters = window.__museHandsAdapters || {};
var adapter = adapters[location.hostname] || null;
if (!adapter) {
  console.log('[webai-hands] 当前站点无适配器：' + location.hostname + '，内容脚本不启用');
  return;
}
console.log('[webai-hands] 适配器已选中：' + adapter.name + '（' + location.hostname + '）');

// ---------- 状态 ----------
var processed = {};
var inFlight = {};
var cmdById = {};
var firstSeenAt = {};
var stableTimers = {};
var ready = false;
var pagePort = null;
var localHostname = null;
var incompleteAt = {};
var incompleteWarned = {};

// ---------- 哨兵解析 ----------
function parseBlock(text) {
  var nl = text.indexOf('\n');
  var first = nl === -1 ? text : text.slice(0, nl);
  var head;
  try { head = JSON.parse(first); } catch (e) { return null; }
  if (!head || head.muse !== 'exec' || !head.id) return null;
  var cmdFromHead = (typeof head.cmd === 'string') ? head.cmd : null;
  var cmdFromBody = (nl === -1 ? '' : text.slice(nl + 1)).trim();
  return {
    id: String(head.id),
    host: head.host || null,
    shell: head.shell || null,
    timeout: head.timeout || null,
    cmd: cmdFromHead !== null ? cmdFromHead : cmdFromBody
  };
}

function fingerprint(text) {
  var h = 0;
  for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
  return text.length + ':' + h;
}

// ---------- 去重 ----------
function loadProcessed(done) {
  try {
    chrome.storage.local.get([STORE_KEY, HOSTNAME_KEY], function (res) {
      var ids = (res && res[STORE_KEY]) || [];
      ids.forEach(function (id) { processed[id] = true; });
      if (res && res[HOSTNAME_KEY]) {
        localHostname = res[HOSTNAME_KEY];
        console.log('[webai-hands] 本机 hostname（缓存）：' + localHostname);
      }
      ready = true;
      if (done) done();
    });
  } catch (e) {
    ready = true;
    if (done) done();
  }
}

function markProcessed(id) {
  processed[id] = true;
  try {
    var obj = {};
    obj[STORE_KEY] = Object.keys(processed).slice(-300);
    chrome.storage.local.set(obj);
  } catch (e) {}
}

// ---------- 与 background 的长连接 ----------
function getPort() {
  if (pagePort) return pagePort;
  pagePort = chrome.runtime.connect({ name: 'webai-hands' });
  pagePort.onMessage.addListener(function (msg) {
    if (!msg) return;
    if (msg.type === 'result') {
      delete inFlight[msg.id];
      var text = formatResult(msg);
      delete cmdById[msg.id];
      fillBack(text);
    } else if (msg.type === 'error' && msg.id) {
      delete inFlight[msg.id];
      delete cmdById[msg.id];
      fillBack('' + (msg.error || '未知错误'));
    }
    // progress 心跳帧只是保活长连接，不打扰页面
  });
  pagePort.onDisconnect.addListener(function () {
    pagePort = null;
    Object.keys(inFlight).forEach(function (id) {
      fillBack('与扩展后台的连接断开，结果未知。');
    });
    inFlight = {};
  });
  return pagePort;
}

// ---------- hostname 路由（DESIGN §6.7 预留） ----------
function hostMatches(want) {
  if (!localHostname) return true;  // 未拿到本机 hostname 时先放行
  return want.toLowerCase() === localHostname.toLowerCase();
}

// ---------- 执行 ----------
function execBlock(block) {
  // 关键：残缺块（DeepSeek 里 <code> 只有首行 JSON、cmd 为空）
  // 不标记 processed，等完整元素（<pre>）出现再执行。
  if (!block.cmd) {
    incompleteAt[block.id] = Date.now();
    if (!incompleteWarned[block.id]) {
      incompleteWarned[block.id] = true;
      console.log('[webai-hands] 块 ' + block.id + ' 尚无命令正文，等待完整元素');
    }
    return;
  }
  if (block.host && block.host !== '*' && !hostMatches(block.host)) {
    console.log('[webai-hands] 块 ' + block.id + ' 目标机器 ' + block.host +
                ' 与本机不符，静默忽略');
    markProcessed(block.id);
    return;
  }
  markProcessed(block.id);  // 先落账再执行
  inFlight[block.id] = true;
  cmdById[block.id] = block.cmd;
  console.log('[webai-hands] 执行 ' + block.id + '：', block.cmd.slice(0, 120));
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
    delete cmdById[block.id];
    fillBack('发往扩展后台失败：' + e.message);
  }
}

// ---------- 结果格式（M3 定型） ----------
function clip(s) {
  if (s == null) return '';
  s = String(s);
  if (s.length <= MAX_RESULT) return s;
  return s.slice(0, KEEP_HEAD) + '\n\n…（中略）…\n\n' + s.slice(s.length - KEEP_TAIL);
}

function formatDiag(res) {
  var lines = [];
  lines.push('webai-hands diag  id=' + res.id);
  lines.push('host: ' + (res.hostname || '?') + '  platform: ' + (res.platform || '?') + '  pid: ' + (res.pid || '?'));
  lines.push('history: ' + res.history_size + '/' + res.history_limit);
  if (res.recent && res.recent.length) {
    lines.push('recent:');
    res.recent.forEach(function (r) {
      var t = r.ts ? new Date(r.ts * 1000).toTimeString().slice(0, 8) : '--:--:--';
      lines.push('  ' + (r.id || '?') + '  ' + (r.ok ? 'ok' : 'fail') + '  ' + t);
    });
  }
  if (res.log_tail) {
    lines.push('log_tail:');
    lines.push(res.log_tail.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}


function formatResult(res) {
  if (res.history_size !== undefined && res.log_tail !== undefined) {
    return formatDiag(res);
  }
  var secs = ((res.duration_ms || 0) / 1000).toFixed(1);
  var lines = [];
  lines.push('webai-hands 结果 id=' + res.id + ' exit=' + res.exit_code +
             ' ' + secs + 's host=' + (res.hostname || '?'));
  var cmd = cmdById[res.id];
  if (cmd) {
    var first = cmd.split('\n')[0];
    var n = cmd.split('\n').length;
    var extra = n > 1 ? '（共 ' + n + ' 行）' : '';
    lines.push('cmd: ' + (first.length > 120 ? first.slice(0, 120) + '…' : first) + extra);
  }
  if (res.error) lines.push('err: ' + res.error);
  if (res.stdout) lines.push(res.stdout.replace(/\s+$/, ''));
  if (res.stderr) {
    lines.push('');
    lines.push('stderr:');
    lines.push(clip(res.stderr.replace(/\s+$/, '')));
  }
  return lines.join('\n');
}

// ---------- 填回（交给适配器） ----------
function fillBack(text) {
  var ok = false;
  try { ok = adapter.fillResult(text); } catch (e) {
    console.error('[webai-hands] adapter.fillResult 抛异常：', e);
    ok = false;
  }
  if (ok) {
    console.log('[webai-hands] 结果已填回输入框');
    maybeAutoSend();
  } else {
    console.log('[webai-hands] 适配器未找到输入框，结果只能进日志：', text.slice(0, 200));
  }
}

function maybeAutoSend() {
  try {
    chrome.storage.local.get([AUTO_KEY], function (res) {
      if (res && res[AUTO_KEY]) setTimeout(trySend, 300);
    });
  } catch (e) {}
}

function trySend() {
  var ok = false;
  try { ok = adapter.clickSend(); } catch (e) {
    console.error('[webai-hands] adapter.clickSend 抛异常：', e);
    ok = false;
  }
  if (ok) console.log('[webai-hands] 已自动发送');
  else console.log('[webai-hands] 未找到发送按钮，保持只填不发');
}

// ---------- 扫描 ----------
function scan() {
  if (!ready) return;
  var els;
  try { els = adapter.findBlocks(); } catch (e) {
    console.error('[webai-hands] adapter.findBlocks 抛异常：', e);
    return;
  }
  if (!els || !els.length) return;
  els.forEach(function (el) {
    var text = el.innerText || el.textContent || '';
    var block = parseBlock(text);
    if (!block || processed[block.id] || inFlight[block.id]) return;
    if (!block.cmd && incompleteAt[block.id] && Date.now() - incompleteAt[block.id] < 5000) return;
    if (!firstSeenAt[block.id]) {
      firstSeenAt[block.id] = Date.now();
      console.log('[webai-hands] 标记块 ' + block.id + ' 出现了');
    }
    var fp = block.id + '|' + fingerprint(text);
    clearTimeout(stableTimers[fp]);
    stableTimers[fp] = setTimeout(function () {
      if (processed[block.id] || inFlight[block.id]) return;
      var again = parseBlock(el.innerText || el.textContent || '');
      if (!again) return;
      console.log('[webai-hands] 标记块 ' + block.id + ' 已稳定，开始执行');
      execBlock(again);
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
  console.log('[webai-hands] 内容脚本已启动：抓到命令块将真执行，结果默认只填回不发送。');
});
})();