// ==UserScript==
// @name         webai-hands 探针 probe
// @namespace    muse.hands
// @version      0.1.2
// @description  只验证一件事：聊天页里能不能稳定抓到带哨兵标记的助手回复代码块。全程只检测、计数、打日志，绝不执行任何命令。
// @match        https://muse.ai/*
// @match        https://*.muse.ai/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 标记块约定：代码块第一行是 JSON，且含 "muse":"exec"，例如
  //   {"muse":"exec","v":1,"id":"p001","shell":"powershell"}
  // 只认“第一行就是哨兵行”的代码块，正文里引用这串字样的段落不会误触发。
  function sentinelId(text) {
    try {
      var obj = JSON.parse(text.split('\n', 1)[0]);
      return obj && obj.muse === 'exec' ? (obj.id || '(no-id)') : null;
    } catch (e) {
      return null;
    }
  }

  var counted = {};      // id -> 已计数（每块只数一次）
  var firstSeenAt = {};  // id -> 第一次出现的时间（看流式要等多久才稳定）
  var stableTimers = {}; // 内容指纹 -> 稳定计时器
  var count = 0;

  function fingerprint(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
    return text.length + ':' + h;
  }

  // ---------- 右下角角标 ----------
  // v0.1.1：改用浏览器顶层（popover）显示，并随每次扫描自检，被页面清掉就补回来。
  // v0.1.2：角标原来挂在 <html> 上、在 body 之外，跟应用外壳不在同一层；
  // 改挂进 body（恩公在 Elements 里一眼看出的），再叠顶层显示，双保险。
  var badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;right:12px;bottom:12px;top:auto;left:auto;' +
    'margin:0;border:0;z-index:2147483647;' +
    'background:#111;color:#7CFC90;font:12px/1.5 monospace;padding:6px 10px;' +
    'border-radius:8px;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.35)';
  var label = document.createElement('span');
  label.textContent = 'muse-probe: 0';
  var fillBtn = document.createElement('button');
  fillBtn.textContent = '填回测试';
  fillBtn.style.cssText = 'margin-left:8px;font:12px monospace;cursor:pointer';
  fillBtn.addEventListener('click', fillTest);
  badge.appendChild(label);
  badge.appendChild(fillBtn);
  (document.body || document.documentElement).appendChild(badge);

  function ensureBadge() {
    try {
      if (!badge.isConnected) {
        (document.body || document.documentElement).appendChild(badge);
      }
      if (typeof badge.showPopover === 'function' && !badge.matches(':popover-open')) {
        badge.setAttribute('popover', 'manual');
        badge.showPopover();
      }
    } catch (e) { /* 顶层不可用时退回普通固定定位，不影响检测 */ }
  }
  ensureBadge();

  function setBadge(extra) {
    label.textContent = 'muse-probe: ' + count + (extra ? ' ' + extra : '');
  }

  function scan() {
    ensureBadge();
    var els = Array.prototype.slice.call(
      document.querySelectorAll('pre code, code, [class*="code"]'));
    var hits = els.filter(function (el) {
      return sentinelId(el.innerText || el.textContent || '') !== null;
    });
    // 只留最里层元素，避免同一块被外层容器重复计入
    hits = hits.filter(function (el) {
      return !hits.some(function (other) {
        return other !== el && el.contains(other);
      });
    });
    hits.forEach(function (el) {
      var text = el.innerText || el.textContent || '';
      var id = sentinelId(text);
      if (!firstSeenAt[id]) {
        firstSeenAt[id] = Date.now();
        console.log('[muse-probe] 标记块 ' + id + ' 出现了（流式中内容可能还在变）');
      }
      var fp = id + '|' + fingerprint(text);
      clearTimeout(stableTimers[fp]);
      stableTimers[fp] = setTimeout(function () {
        if (counted[id]) return;
        counted[id] = true;
        count++;
        var waited = ((Date.now() - firstSeenAt[id]) / 1000).toFixed(1);
        console.log('[muse-probe] ✅ 稳定抓到 ' + id + '（第 ' + count +
          ' 块，从出现到稳定 ' + waited + 's）：', text.slice(0, 120));
        setBadge('✅ ' + id);
        badge.style.background = '#14532d';
        setTimeout(function () { badge.style.background = '#111'; }, 600);
      }, 1000);
    });
  }

  var scanTimer = null;
  new MutationObserver(function () {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 300);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scan();

  // ---------- 填回测试：只往输入框填字，绝不按发送 ----------
  function fillTest() {
    var msg = 'muse-probe 填回测试 ✅（只填入，不发送）';
    var ta = document.querySelector('textarea');
    if (ta) {
      var setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, msg);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[muse-probe] 已填入 textarea');
      setBadge('（已填入 textarea）');
      return;
    }
    var ce = document.querySelector('[contenteditable="true"], div[role="textbox"]');
    if (ce) {
      ce.focus();
      var ok = false;
      try { ok = document.execCommand('insertText', false, msg); } catch (e) { ok = false; }
      if (!ok) {
        ce.textContent = msg;
        ce.dispatchEvent(new Event('input', { bubbles: true }));
      }
      console.log('[muse-probe] 已填入 contenteditable');
      setBadge('（已填入编辑框）');
      return;
    }
    console.log('[muse-probe] ❌ 没找到输入框');
    setBadge('（没找到输入框）');
  }

  console.log('[muse-probe] 探针已启动，只检测不执行。等待标记块…');
})();
