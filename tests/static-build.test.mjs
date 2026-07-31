import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
test("builds a directly deployable static site", async () => {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(
    html,
    /<title>Yuedu Ebook Maker · TXT to EPUB<\/title>/,
  );
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
  assert.doesNotMatch(script, /导出 AZW3/);
  assert.match(script, /为什么暂不提供 AZW3/);
  assert.match(script, /language-trigger/);
  assert.match(script, /menuitemradio/);
  assert.match(script, /yuedu-locale/);
  assert.match(script, /zh-hant/);
  assert.match(
    script,
    /github\.com\/wykings\/yuepad-book-maker\/issues\/new/,
  );
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

  assert.equal(JSON.parse(manifest).name, "Yuedu Ebook Maker");
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(headers, /X-Content-Type-Options/);
  assert.match(sitemap, /hreflang="zh-TW"/);
  assert.match(sitemap, /https:\/\/book\.yuepad\.com\/zh-cn\//);
  assert.match(sitemap, /hreflang="en" href="https:\/\/book\.yuepad\.com\/"/);
  assert.match(
    robots,
    /Sitemap: https:\/\/book\.yuepad\.com\/sitemap\.xml/,
  );
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("zh-cn"));
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
    readFile(new URL("../dist/zh-cn/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/zh-tw/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
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
  assert.match(traditional, /TXT 轉 EPUB/);
  assert.match(english, /TXT to EPUB/);
});

test("ships bilingual open-source documentation and licensing", async () => {
  const [readme, chineseReadme, license, notice, packageJson] =
    await Promise.all([
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../README.zh-CN.md", import.meta.url), "utf8"),
      readFile(new URL("../LICENSE", import.meta.url), "utf8"),
      readFile(new URL("../docs/NOTICE.md", import.meta.url), "utf8"),
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
  assert.match(chineseReadme, /暂不提供 AZW3/);
  assert.equal(packageJson.license, "GPL-3.0-only");
});
