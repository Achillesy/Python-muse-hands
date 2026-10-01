# 首次安装与 M1 验收（Windows）

三步，前两步都是一次性的亲手动作，只能在你本机做，我替不了：

1. `git pull` 拿到最新代码。
2. 双击 `native-host\install_windows.bat`。
   它在本机登记 host：生成 `native-host\com.muse.hands.json`，
   并写入注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.muse.hands`。
   跑一次就好，以后更新代码不用再跑（除非仓库目录搬家）。
3. Chrome 打开 `chrome://extensions/`，打开右上角「开发者模式」，
   点「加载已解压的扩展程序」，选仓库里的 `extension` 文件夹。
   工具栏会出现 muse-hands 图标。

验收（M1 通桥）：点一下 muse-hands 图标，徽标出现 ✓ 就是桥通了
（Chrome 已把 host 拉起来并收到回音）。若徽标变 ✕：多半是第 2 步
没跑、或仓库挪过窝——把情况告诉我；在 `chrome://extensions` 里
点这个扩展的「检查视图 service worker」能看到日志。

说明：
- 扩展 ID 已固定为 `aaemlgedddakpgkfoakfmkdiiheplgnl`，
  host 白名单只认它一个；重装扩展、更新代码都不用改。
- host 不监听任何网络端口，只跟这一个扩展说话。
