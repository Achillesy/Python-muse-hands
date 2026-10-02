# 首次安装与 M1 验收（Windows）

三步，前两步都是一次性的亲手动作，只能在你本机做，我替不了：

1. `git pull` 拿到最新代码。
2. 双击 `native-host\install_windows.bat`。
   它在本机登记 host：生成 `native-host\com.webai.hands.json`，
   并写入注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.webai.hands`。
   跑一次就好，以后更新代码不用再跑（除非仓库目录搬家）。
3. Chrome 打开 `chrome://extensions/`，打开右上角「开发者模式」，
   点「加载已解压的扩展程序」，选仓库里的 `extension` 文件夹。
   工具栏会出现 webai-hands 图标。

验收（通桥）：点一下 webai-hands 图标打开面板，点「测通桥」，显示
「已连接 <机器名>」即通桥。若连接失败：多半是第 2 步没跑、或仓库
挪过窝——把情况告诉我。图标徽标平日就是状态：✓ 就绪、… 执行中、
✕ 断开。

说明：
- 扩展 ID 已固定为 `aaemlgedddakpgkfoakfmkdiiheplgnl`，
  host 白名单只认它一个；重装扩展、更新代码都不用改。
- host 不监听任何网络端口，只跟这一个扩展说话。
