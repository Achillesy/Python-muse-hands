// muse-hands 适配器：chat.deepseek.com
//
// DeepSeek 渲染一个代码块时，会在 DOM 里放多份副本：
//   - <pre>  内容完整（首行 JSON + 命令正文）
//   - <code> 有时只有首行 JSON，正文丢失
// 核心层对残缺元素不标记 processed，等完整元素出现再执行。
// 所以这里把 <pre> 和 <code> 全部交出去，让核心层自己挑。

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

    fillResult: function (text) {
      // DeepSeek 页面只有一个 textarea（诊断实测）。
      // 用原生 setter + input 事件让 React 感知变化。
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
      // DeepSeek 的发送按钮没有 aria-label、没有 type=submit（诊断实测）。
      // 暂不自动发送，保持只填不发；需要时再补一个选择器。
      return false;
    }
  };
})();