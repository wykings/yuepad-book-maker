import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  createAzw3,
  validateAzw3,
} from "../src/azw3/writer.js";

function decompressPalmDoc(input) {
  const output = [];
  for (let index = 0; index < input.length; ) {
    const byte = input[index++];
    if (byte === 0) {
      output.push(0);
    } else if (byte <= 8) {
      for (let count = 0; count < byte; count += 1) {
        output.push(input[index++]);
      }
    } else if (byte <= 0x7f) {
      output.push(byte);
    } else if (byte <= 0xbf) {
      const code = ((byte & 0x3f) << 8) | input[index++];
      const distance = code >> 3;
      const length = (code & 7) + 3;
      for (let count = 0; count < length; count += 1) {
        output.push(output[output.length - distance]);
      }
    } else {
      output.push(0x20, byte & 0x7f);
    }
  }
  return new Uint8Array(output);
}

test("builds a directly deployable static site", async () => {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<title>阅渡制书 · TXT 转 EPUB \/ AZW3<\/title>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /href="\/favicon\.png"/);
  assert.match(html, /content="https:\/\/book\.yuepad\.com\/og\.png"/);

  const scriptPath = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(scriptPath, "index.html should reference a bundled JavaScript file");
  const script = await readFile(
    new URL(`../dist${scriptPath}`, import.meta.url),
    "utf8",
  );
  assert.match(script, /导出 EPUB/);
  assert.match(script, /导出 AZW3/);
  assert.match(script, /language-trigger/);
  assert.match(script, /menuitemradio/);
  assert.match(script, /gb18030/i);
  assert.match(script, /image\/jpeg/);
  assert.match(script, /application\/epub\+zip/);
  assert.match(script, /裁剪封面/);
  assert.match(script, /1600.{0,20}2560/);
});

test("ships Cloudflare Pages, brand, and offline assets", async () => {
  const [manifest, serviceWorker, headers, sitemap, robots, files] =
    await Promise.all([
    readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../dist/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/_headers", import.meta.url), "utf8"),
    readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8"),
    readFile(new URL("../dist/robots.txt", import.meta.url), "utf8"),
    readdir(new URL("../dist/", import.meta.url)),
    ]);

  assert.equal(JSON.parse(manifest).name, "阅渡制书");
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(headers, /X-Content-Type-Options/);
  assert.match(sitemap, /hreflang="zh-TW"/);
  assert.match(sitemap, /https:\/\/book\.yuepad\.com\/en\//);
  assert.match(
    robots,
    /Sitemap: https:\/\/book\.yuepad\.com\/sitemap\.xml/,
  );
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("brand-icon.png"));
  assert.ok(files.includes("icon-192.png"));
  assert.ok(files.includes("icon-512.png"));
  assert.ok(files.includes("favicon.png"));
  assert.ok(files.includes("apple-touch-icon.png"));
  assert.ok(files.includes("og.png"));
  await access(new URL("../dist/assets/", import.meta.url));
});

test("builds indexable Simplified Chinese, Traditional Chinese, and English pages", async () => {
  const [simplified, traditional, english] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/zh-tw/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/en/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(simplified, /<html lang="zh-CN">/);
  assert.match(traditional, /<html lang="zh-TW">/);
  assert.match(english, /<html lang="en">/);
  for (const html of [simplified, traditional, english]) {
    assert.match(html, /rel="canonical"/);
    assert.match(html, /hreflang="x-default"/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /SoftwareApplication/);
    assert.match(html, /name="robots" content="index, follow/);
  }
  assert.match(traditional, /TXT 轉 EPUB \/ AZW3/);
  assert.match(english, /TXT to EPUB \/ AZW3/);
});

test("ships bilingual open-source documentation and licensing", async () => {
  const [readme, chineseReadme, license, notice, thirdParty, packageJson] =
    await Promise.all([
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../README.zh-CN.md", import.meta.url), "utf8"),
      readFile(new URL("../LICENSE", import.meta.url), "utf8"),
      readFile(new URL("../docs/NOTICE.md", import.meta.url), "utf8"),
      readFile(
        new URL("../docs/THIRD-PARTY-NOTICES.md", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../package.json", import.meta.url), "utf8").then(
        JSON.parse,
      ),
    ]);

  assert.match(readme, /YueDu Book Maker/);
  assert.match(readme, /README\.zh-CN\.md/);
  assert.match(chineseReadme, /阅渡制书/);
  assert.match(chineseReadme, /\.\/README\.md/);
  assert.match(license, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(notice, /gedoor\/legado/);
  assert.match(thirdParty, /Ken-B\/epub-to-kindle/);
  assert.equal(packageJson.license, "GPL-3.0-only");
});

test("creates a readable KF8/AZW3 container with Chinese metadata", () => {
  const bytes = createAzw3({
    title: "阅渡测试书",
    author: "测试作者",
    language: "zh-CN",
    identifier: "urn:uuid:yuedu-test-book",
    cover: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    chapters: [
      {
        title: "第一章 出发",
        content: "这是第一段。\n\n这是第二段，包含中文和 emoji：🌊。",
      },
      {
        title: "第二章 抵达",
        content: "正文内容。",
      },
    ],
  });
  const result = validateAzw3(bytes);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.fileVersion, 8);
  assert.equal(result.title, "阅渡测试书");
  assert.ok(result.recordCount > 8);
  assert.equal(new TextDecoder().decode(bytes.slice(60, 68)), "BOOKMOBI");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const record0Offset = view.getUint32(78, false);
  const compression = view.getUint16(record0Offset, false);
  const textRecordCount = view.getUint16(record0Offset + 8, false);
  const decodedRecords = [];
  for (let index = 1; index <= textRecordCount; index += 1) {
    const start = view.getUint32(78 + index * 8, false);
    const end = view.getUint32(78 + (index + 1) * 8, false);
    const record = bytes.slice(start, end - 1);
    decodedRecords.push(
      compression === 2 ? decompressPalmDoc(record) : record,
    );
  }
  const text = new TextDecoder().decode(
    new Uint8Array(
      decodedRecords.flatMap((record) => Array.from(record)),
    ),
  );
  assert.match(text, /第一章 出发/);
  assert.match(text, /中文和 emoji：🌊/);
});
