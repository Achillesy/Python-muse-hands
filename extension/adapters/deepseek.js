// webai-hands adapter: chat.deepseek.com
(function () {
  'use strict';
  var reg = (window.__museHandsAdapters = window.__museHandsAdapters || {});

  reg['chat.deepseek.com'] = {
    name: 'deepseek',

    findBlocks: function () {
      return Array.prototype.slice.call(
        document.querySelectorAll('pre, pre code, code')
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
      var ta = document.querySelector('textarea');
      if (!ta) return false;
      var cur = ta.value || '';
      var next = cur ? cur.replace(/\s+$/, '') + '\n' + text : text;
      var setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, next);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },

    clickSend: function () {
      var sels = [
        'button[aria-label*="发送"]',
        'button[aria-label*="Send"]',
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
      var ta = document.querySelector('textarea');
      if (!ta) return false;
      try {
        ta.focus();
        var ev = function (t) {
          return new KeyboardEvent(t, {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
            bubbles: true, cancelable: true, composed: true
          });
        };
        ta.dispatchEvent(ev('keydown'));
        ta.dispatchEvent(ev('keypress'));
        ta.dispatchEvent(ev('keyup'));
        return true;
      } catch (e) {
        return false;
      }
    }
  };
})();
