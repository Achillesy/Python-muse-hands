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

    // Gemini 附件限制（2026-10-03 登录态实测）：
    // - file input 平时不在 DOM 里，点「上传和工具」菜单后才渲染（2 个文档上传
    //   + 1 个图片上传），所以这里先点开菜单、等 input 出现再注入；
    //   为此本函数返回 Promise（content.js 用 Promise.resolve 兼容同步/异步）。
    // - 文档上传 input 有明确的 accept 白名单（约 150 种扩展名：文档/数据/代码/
    //   表格类，含 .zip；图片上传是 accept="image/*"）。用 input 自身的 accept
    //   做预检，名单以页面实时读取为准，不在代码里硬编码。
    // - 实测：txt / zip 均可作为附件接受（只到附件待发送阶段，未点发送，
    //   服务端行为未知）。
    uploadFile: function (file) {
      // file: {name, mime, bytes(Uint8Array)}
      return new Promise(function (resolve) {
        function done(ok, why) { resolve({ ok: ok, why: why }); }

        function findDocInput() {
          var inputs = document.querySelectorAll('input[type=file]');
          for (var i = 0; i < inputs.length; i++) {
            var acc = (inputs[i].getAttribute('accept') || '').toLowerCase();
            // 文档上传 input 的 accept 很长且含 .zip；图片上传的是 image/*
            if (acc && acc.indexOf('image/*') !== 0 && acc.indexOf('.zip') !== -1) {
              return inputs[i];
            }
          }
          return null;
        }

        function acceptOk(input, name) {
          var acc = (input.getAttribute('accept') || '').toLowerCase();
          var m = /\.([a-z0-9]+)$/i.exec(name || '');
          var ext = m ? m[1].toLowerCase() : '';
          if (!ext) return true; // 无后缀：不拦，交给站点自己判断
          var parts = acc.split(',');
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i].trim();
            if (p.charAt(0) === '.' && p.slice(1) === ext) return true;
          }
          return false;
        }

        function closeMenu() {
          try {
            document.dispatchEvent(new KeyboardEvent('keydown',
              { key: 'Escape', code: 'Escape', bubbles: true }));
          } catch (e) {}
        }

        function inject(input) {
          if (!acceptOk(input, file.name)) {
            done(false, 'Gemini 不收这种文件（' + file.name +
              '），仅支持文档/数据/代码/表格类及图片');
            return;
          }
          var blob, f;
          try {
            blob = new Blob([file.bytes], { type: file.mime || 'application/octet-stream' });
            f = new File([blob], file.name, { type: file.mime || 'application/octet-stream' });
          } catch (e) {
            done(false, '构造 File 失败：' + e.message);
            return;
          }
          var dt = new DataTransfer();
          dt.items.add(f);
          try {
            input.files = dt.files;
          } catch (e) {
            done(false, '写入 input.files 失败：' + e.message);
            return;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          closeMenu();
          done(true);
        }

        var input = findDocInput();
        if (input) { inject(input); return; }
        // input 还没渲染：点开「上传和工具」菜单等它出现
        var menuBtn = document.querySelector(
          'button[aria-label="上传和工具"], button[aria-label="上传"]');
        if (!menuBtn) { done(false, '找不到上传菜单按钮'); return; }
        menuBtn.click();
        var tries = 0;
        var timer = setInterval(function () {
          tries++;
          var inp = findDocInput();
          if (inp) { clearInterval(timer); inject(inp); }
          else if (tries >= 20) {
            clearInterval(timer);
            done(false, '上传菜单打开后仍无 file input');
          }
        }, 150);
      });
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
