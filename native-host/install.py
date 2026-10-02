#!/usr/bin/env python3
# webai-hands 本地 host 安装（每台机器运行一次）
#
# 干两件事：
# 1. 生成 com.webai.hands.json（Native Messaging host 清单；里面写的是
#    本机绝对路径，所以不进 git、每台现生成）；
# 2. 把它登记到 Chrome：Windows 写 HKCU 注册表 NativeMessagingHosts，
#    macOS 放进 Chrome 的 NativeMessagingHosts 目录。
#
# 扩展 ID 由 extension/manifest.json 里写死的 key 决定，全程固定，
# host 白名单只认它一个。

import json
import os
import sys

HOST_NAME = "com.webai.hands"
EXTENSION_ID = "aaemlgedddakpgkfoakfmkdiiheplgnl"
HERE = os.path.dirname(os.path.abspath(__file__))


def host_launcher():
    if sys.platform == "win32":
        return os.path.join(HERE, "host.bat")
    return os.path.join(HERE, "host.sh")


def write_manifest(target_path):
    manifest = {
        "name": HOST_NAME,
        "description": "webai-hands local host",
        "path": host_launcher(),
        "type": "stdio",
        "allowed_origins": ["chrome-extension://%s/" % EXTENSION_ID],
    }
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return target_path


def main():
    if sys.platform == "win32":
        manifest_path = write_manifest(os.path.join(HERE, HOST_NAME + ".json"))
        import winreg

        key_path = "Software\\Google\\Chrome\\NativeMessagingHosts\\" + HOST_NAME
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, None, 0, winreg.REG_SZ, manifest_path)
        print("已登记 host：HKCU\\%s" % key_path)
    elif sys.platform == "darwin":
        target_dir = os.path.expanduser(
            "~/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        )
        os.makedirs(target_dir, exist_ok=True)
        manifest_path = write_manifest(os.path.join(target_dir, HOST_NAME + ".json"))
        os.chmod(host_launcher(), 0o755)
        print("已写入 host 清单：%s" % manifest_path)
    else:
        print("暂不支持的平台：%s（先做 Windows，随后 macOS）" % sys.platform)
        return 1

    print("host 清单：%s" % manifest_path)
    print("扩展 ID（已写死在白名单里）：%s" % EXTENSION_ID)
    print(
        "下一步：Chrome 打开 chrome://extensions → 开开发者模式 → "
        "加载已解压的扩展程序 → 选 extension 文件夹 → 点工具栏的 "
        "webai-hands 图标，徽标出现 ✓ 即通桥。"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
