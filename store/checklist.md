# Chrome Web Store 提交清单

## 已就绪（仓库里）

- [x] `store/webai-hands-store-0.4.0.zip` —— 上架包（`bash store/build.sh` 可重打；
      已剥离 dev `key`，首次上传商店会分配新扩展 ID）
- [x] 图标 16/48/128（`extension/icons/`，manifest 已引用）
- [x] 商品描述 `store/listing-en.txt` / `store/listing-zh.txt`
- [x] LICENSE（noncommercial）、隐私说明（见下）

## 需要你在开发者后台亲手做的

1. **截图**（必须，至少 1 张；建议 3–5 张）：
   - 1280×800 或 640×400
   - 建议内容：① 在 DeepSeek 对话里发命令块→结果回填；② attach 附件上传；
     ③ 扩展 popup 面板；④ Blender 被驱动的画面
   - 在你 M1 的 Chrome 里实际操作时截（开发者模式加载的版本即可）
2. **小宣传图**（可选但推荐）：440×280
3. 进 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole) →
   新增商品 → 上传 zip → 填描述（从 `listing-*.txt` 粘）→ 选类目
   （建议 Productivity/生产力工具）→ 语言：英语（默认）+ 中文
4. **隐私问卷**：按以下口径填
   - 收集用户数据：否（扩展本身不收集、不传输、不存储任何用户数据）
   - `nativeMessaging` 权限用途：与用户本机安装的开源 host 程序通信，
     执行用户在聊天中明确下达的命令；通信只走本机 stdio，无网络端口
   - 远程代码：否（扩展代码全在包内；host 是用户亲手安装的开源程序）
5. 提交审核（新商品通常几小时到几天）

## 上架成功后（必须做，否则 host 连不上）

1. 记下商店分配的**新扩展 ID**。
2. 更新 `native-host/install.py`（及 Windows bat）里的 allowlist/模板，
   把新 ID 加进去（或替换 dev ID）。
3. 发版说明里告诉用户：商店版装好后**重跑一遍 install**（host 要认新 ID）。
4. dev 版（`aaemlgedddakpgkfoakfmkdiiheplgnl`）继续保留给开发者自用，
   两套 ID 互不干扰。

## 隐私说明（供后台问卷/商品页引用）

> webai-hands 扩展本身不收集、不传输、不存储任何用户数据，不含广告、
> 不含追踪。`nativeMessaging` 权限仅用于与用户亲手安装在本机的开源
> host 程序通信（Chrome 官方 Native Messaging，本机 stdio，无网络端口），
> 执行用户在 AI 对话中明确下达的命令。文件上传需 AI 在对话中索取，
> 敏感路径（SSH 密钥、浏览器 cookie、.env 等）一律拒绝，单文件上限 25MB。
