# YueDu Book Maker

[简体中文](./README.zh-CN.md)

YueDu Book Maker (阅渡制书) is a lightweight, privacy-first web app for turning
plain-text manuscripts into EPUB e-books. Everything runs locally in
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
- Works on desktop and mobile, with offline caching through its PWA service
  worker.
- Includes Simplified Chinese, Traditional Chinese, and English interfaces.

## Recommended Kindle workflow

Export an **EPUB**, then deliver it with
[Send to Kindle](https://www.amazon.com/sendtokindle).

AZW3 export is intentionally unavailable. Files written directly by a browser
can freeze or lose their cover on some Kindle devices, especially older models.
The project exports EPUB only rather than offering an unreliable download.

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
decoding, chapter detection, cover processing, and EPUB packaging all happen in
the browser. It does not require a database, account system, or
backend service.

The EPUB writer creates the ZIP, OPF, NAV, and NCX structures in memory.

## Privacy

Imported text and images stay in the current browser tab. The app does not
upload source files or generated books. Closing or refreshing the page clears
the working data unless the browser retains it as part of its normal page
state.

## License

This project is licensed under the
[GNU General Public License v3.0](./LICENSE).

Chapter-detection behavior was informed by
[gedoor/legado](https://github.com/gedoor/legado).
See [NOTICE.md](./docs/NOTICE.md) for details.
