# 阅渡制书

[English](./README.md)

阅渡制书是一款轻量、注重隐私的网页电子书制作工具，可以把 TXT 文稿整理并导出为
EPUB 或 AZW3。文本、封面和生成的电子书都只在浏览器本地处理，不会上传到服务器。

在线使用：[book.yuepad.com](https://book.yuepad.com)

## 功能

- 读取 UTF-8、UTF-16、GBK 和 GB18030 编码的 TXT 文件。
- 自动识别常见中文章节标题以及英文 `Chapter`、`Section` 标题，也支持自定义正则。
- 导出前可以检查章节并修改章节标题。
- 自定义书名、作者和封面。
- 支持 WebP、PNG、JPEG、BMP 和 GIF 封面。
- 将封面裁剪为适合 Kindle 的 5:8 比例，并转换成 1600 × 2560 JPEG，避免 WebP
  在部分阅读器和 Send to Kindle 中显示异常。
- 生成同时包含 EPUB 3 导航和 EPUB 2 NCX 目录的 EPUB。
- 在 Web Worker 中直接生成 KF8/AZW3，并在下载前检查文件结构。
- 适配桌面和移动端，支持 PWA 离线缓存。
- 提供简体中文、繁体中文和英文界面。

## Kindle 使用建议

- 通过 Send to Kindle 发送时使用 **EPUB**。
- 通过 USB 复制到 Kindle 时可以使用 **AZW3**。

本项目生成的是面向现代 Kindle 设备的 KF8-only AZW3 文件。

## 本地开发

需要 Node.js 20.19 或更新版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

其他常用命令：

```bash
npm run build
npm test
npm run lint
```

## 实现方式

项目使用 React、TypeScript 和 Vite 构建，是一个纯静态网页。TXT 解码、章节识别、
封面处理、EPUB 打包以及 AZW3 写入全部在浏览器中完成，不需要数据库、用户账号或
后端服务。

EPUB 写入器会在内存中创建 ZIP、OPF、NAV 和 NCX；AZW3 写入器则在独立的 Web
Worker 中运行，避免处理长篇文本时阻塞页面。

## 隐私

导入的文本和图片只存在于当前浏览器页面中，项目不会上传原稿、封面或生成的电子书。
关闭或刷新页面后，工作数据会被清除，浏览器自身保留的常规页面状态除外。

## 开源许可

本项目采用 [GNU General Public License v3.0](./LICENSE) 发布。

章节识别方式参考了 [gedoor/legado](https://github.com/gedoor/legado)，KF8/AZW3
写入器基于 [Ken-B/epub-to-kindle](https://github.com/Ken-B/epub-to-kindle)
修改。详细说明见 [NOTICE.md](./docs/NOTICE.md) 和
[THIRD-PARTY-NOTICES.md](./docs/THIRD-PARTY-NOTICES.md)。
