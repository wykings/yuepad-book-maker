# YueDu Book Maker

[简体中文](./README.zh-CN.md)

YueDu Book Maker (阅渡制书) is a lightweight, privacy-first web app for turning
plain-text manuscripts into EPUB and AZW3 e-books. Everything runs locally in
the browser: books, covers, and exported files are never uploaded to a server.

Try it at [book.yuepad.com](https://book.yuepad.com).

## Features

- Opens UTF-8, UTF-16, GBK, and GB18030 text files.
- Detects common Chinese chapter headings and English `Chapter` / `Section`
  headings, with custom regular-expression rules when needed.
- Lets you review chapters and rename chapter titles before export.
- Edits the book title, author, and cover.
- Accepts WebP, PNG, JPEG, BMP, and GIF cover images.
- Crops covers to a Kindle-friendly 5:8 ratio and converts them to a
  1600 × 2560 JPEG, avoiding WebP compatibility problems on e-readers.
- Creates EPUB files with EPUB 3 navigation and an EPUB 2 NCX table of
  contents.
- Creates KF8/AZW3 files directly in a Web Worker and validates the resulting
  container before download.
- Works on desktop and mobile, with offline caching through its PWA service
  worker.
- Includes Simplified Chinese, Traditional Chinese, and English interfaces.

## Recommended Kindle workflow

- Use **EPUB** with Send to Kindle.
- Use **AZW3** for direct USB transfer to a Kindle.

The AZW3 writer produces KF8-only files intended for modern Kindle devices.

## Local development

Node.js 20.19 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Other useful commands:

```bash
npm run build
npm test
npm run lint
```

## How it works

The application is a static React and TypeScript site built with Vite. TXT
decoding, chapter detection, cover processing, EPUB packaging, and AZW3 writing
all happen in the browser. It does not require a database, account system, or
backend service.

The EPUB writer creates the ZIP, OPF, NAV, and NCX structures in memory. The
AZW3 writer runs separately in a Web Worker so that large books do not block the
interface.

## Privacy

Imported text and images stay in the current browser tab. The app does not
upload source files or generated books. Closing or refreshing the page clears
the working data unless the browser retains it as part of its normal page
state.

## License

This project is licensed under the
[GNU General Public License v3.0](./LICENSE).

Chapter-detection behavior was informed by
[gedoor/legado](https://github.com/gedoor/legado). The KF8/AZW3 writer is based
on modifications to
[Ken-B/epub-to-kindle](https://github.com/Ken-B/epub-to-kindle).
See [NOTICE.md](./docs/NOTICE.md) and
[THIRD-PARTY-NOTICES.md](./docs/THIRD-PARTY-NOTICES.md) for details.
