// webai-hands 适配器：gemini.google.com
// DOM 依据：2026-10-03 经浏览器实测采集。
// - 代码块：<code-block> … <pre><code data-test-id="code-content">（data-test-id 稳定，
//   Angular 的 ng-tns-* 类名后缀会变，不要用它做选择器）。
// - 输入框：Quill 编辑器 div[contenteditable="true"][role="textbox"]，无 textarea。
// - 发送按钮：button[aria-label="发送"]（纯图标按钮，有文字才渲染）。
// - 停止按钮：button[aria-label="停止回答"]，内含 mat-icon[data-mat-icon-name="stop"]。
// - 文件 input：静态页没有，上传时动态渲染，uploadFile 在调用时现查。

(function () {
  'use strict';
  var reg = (window.__museHandsAdapters = window.__museHandsAdapters || {});

  reg['gemini.google.com'] = {
    name: 'gemini',

    findBlocks: function () {
      // 每个围栏代码块对应一个 code[data-test-id="code-content"]，
      // 不用 pre 避免外层容器重复计入。
      return Array.prototype.slice.call(
        document.querySelectorAll('code[data-test-id="code-content"]')
      );
    },

    uploadFile: function (file) {
      // file: {name, mime, bytes(Uint8Array)}
      var inputs = document.querySelectorAll('input[type=file]');
      if (!inputs.length) return { ok: false, why: '页面无 input[type=file]' };
      var input = inputs[0];
      var blob, f;
      try {
        blob = new Blob([file.bytes], { type: file.mime || 'application/octet-stream' });
        f = new File([blob], file.name, { type: file.mime || 'application/octet-stream' });
      } catch (e) {
        return { ok: false, why: '构造 File 失败：' + e.message };
      }
      var dt = new DataTransfer();
      dt.items.add(f);
      try {
        input.files = dt.files;
      } catch (e) {
        return { ok: false, why: '写入 input.files 失败：' + e.message };
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    },

    fillResult: function (text) {
      var ce = document.querySelector(
        'div[contenteditable="true"][role="textbox"], div[contenteditable="true"]');
      if (!ce) return false;
      ce.focus();
      var ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        // Quill 占位是 <p><br></p>；execCommand 失败时直接追加文本并触发 input。
        ce.textContent = (ce.textContent || '') + text;
        ce.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    },

    isStopButton: function (el) {
      if (!el) return false;
      var label = (el.getAttribute && el.getAttribute('aria-label')) || '';
      var txt = (el.textContent || '').trim();
      if (/stop|停止|中断|中止/i.test(label + ' ' + txt)) return true;
      try {
        if (el.querySelector &&
            el.querySelector('mat-icon[data-mat-icon-name="stop"]')) return true;
      } catch (e) {}
      return false;
    },

    clickSend: function () {
      var sels = [
        'button[aria-label="发送"]',
        'button[aria-label="Send"]'
      ];
      for (var i = 0; i < sels.length; i++) {
        var btns = document.querySelectorAll(sels[i]);
        for (var j = btns.length - 1; j >= 0; j--) {
          var b = btns[j];
          if (b && !b.disabled && b.offsetParent !== null) {
            b.click();
            return true;
          }
        }
      }
      return false;
    }
  };
})();
