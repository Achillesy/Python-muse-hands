// webai-hands 适配器：muse.ai
// 从油猴探针 v0.1.2 平移并验证过的 DOM 逻辑。
// muse.ai 的代码块结构是 <pre><code>...</code></pre>，
// 这里只保留最内层 <code>，避免同一块被外层容器重复计入。

(function () {
  'use strict';
  var reg = (window.__museHandsAdapters = window.__museHandsAdapters || {});

  reg['muse.ai'] = {
    name: 'muse',

    // 注：未实现 isStopButton（用户点停止/中断按钮时中止整条链，见 content.js）。
    // 原因：muse.ai 的停止按钮尚无实测的 DOM 特征可依据，不硬抄 deepseek
    // 适配器的文本正则，避免误伤。待实测补充选择器后再实现。
    // （无此方法时 content.js 会静默跳过，不影响其它功能。）

    findBlocks: function () {
      var els = Array.prototype.slice.call(
        document.querySelectorAll('pre code, code, [class*="code"]')
      );
      // 只留最里层元素，避免同一块被外层容器重复计入
      return els.filter(function (el) {
        return !els.some(function (other) {
          return other !== el && el.contains(other);
        });
      });
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
      var ta = document.querySelector('textarea[data-hatch-composer]') ||
               document.querySelector('textarea');
      if (ta) {
        var cur = ta.value || '';
        var next = cur ? cur.replace(/\s+$/, '') + '\n' + text : text;
        var setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, next);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      var ce = document.querySelector(
        '[contenteditable="true"], div[role="textbox"]');
      if (ce) {
        ce.focus();
        var ok = false;
        try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
        if (!ok) {
          ce.textContent = (ce.textContent || '') + text;
          ce.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      }
      return false;
    },

    clickSend: function () {
      var sels = [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="发送"]',
        'button[type="submit"]'
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