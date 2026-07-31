"use client";

import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LANGUAGE_OPTIONS,
  LOCALE_PATHS,
  Locale,
  localeFromPath,
  localizeRule,
  message,
  rememberLocale,
} from "./i18n";

type Chapter = {
  title: string;
  content: string;
  sourceStart: number;
};

type SplitMode = "auto" | "chinese" | "english" | "custom";

type SplitResult = {
  chapters: Chapter[];
  ruleName: string;
  usedFallback: boolean;
};

type Rule = {
  name: string;
  pattern: string;
};

type MatchSpan = {
  index: number;
  end: number;
  value: string;
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

type CoverCrop = {
  zoom: number;
  x: number;
  y: number;
};

const SAMPLE_LENGTH = 512_000;
const FALLBACK_CHAPTER_LENGTH = 10 * 1024;
const MAX_CHAPTER_LENGTH = 100 * 1024;
const MAX_COVER_WIDTH = 1600;
const MAX_COVER_HEIGHT = 2560;
const DEFAULT_COVER_CROP: CoverCrop = { zoom: 1, x: 0, y: 0 };
const encoder = new TextEncoder();

const CHINESE_NUMBER =
  String.raw`\d〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟`;

const CHINESE_STANDARD: Rule = {
  name: "中文标准章节",
  pattern:
    String.raw`^[ \u3000\t]{0,4}(?:(?:内容|文章)?简介|文案|前言|序章|楔子|正文(?!完|结)|终章|后记|尾声|番外|第\s{0,4}[` +
    CHINESE_NUMBER +
    String.raw`]+?\s{0,4}(?:章|节(?!课)|卷|集(?![合和])|部(?![分赛游])|篇(?!张))).{0,30}[ \u3000\t]*$`,
};

const CHINESE_EXTENDED: Rule = {
  name: "中文扩展章节",
  pattern:
    String.raw`^[ \u3000\t]{0,4}(?:(?:内容|文章)?简介|文案|前言|序章|楔子|正文(?!完|结)|终章|后记|尾声|番外|第\s{0,4}[` +
    CHINESE_NUMBER +
    String.raw`]+?\s{0,4}(?:章|节|卷|集|部|篇|回|话)|[卷章][` +
    CHINESE_NUMBER +
    String.raw`]{1,8})[ \u3000\t]{0,4}.{0,30}$`,
};

const CHINESE_NUMBERED: Rule = {
  name: "数字序号章节",
  pattern:
    String.raw`^[ \u3000\t]{0,4}(?:\d{1,5}[：:、,.，_\-—]|[` +
    CHINESE_NUMBER +
    String.raw`]{1,8}(?:章)?[、_\-—])[ \u3000\t]*.{1,30}$`,
};

const ENGLISH_STANDARD: Rule = {
  name: "英文 Chapter / Section",
  pattern: String.raw`^[ \u3000\t]{0,4}(?:Chapter|Section|Part|Episode|No[.、]?)[ \t]*\d{1,5}\b.{0,40}$`,
};

const AUTO_RULES = [
  CHINESE_STANDARD,
  CHINESE_EXTENDED,
  ENGLISH_STANDARD,
  CHINESE_NUMBERED,
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value =
        (value & 1) !== 0
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of data) {
    crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cleanTitle(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function cleanContent(value: string) {
  return value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
}

function characterCount(value: string) {
  return value.replace(/\s/g, "").length;
}

function formatNumber(value: number, locale: Locale = "zh-CN") {
  return new Intl.NumberFormat(locale).format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function findMatches(text: string, pattern: string) {
  const expression = new RegExp(pattern, "gmi");
  const matches: MatchSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)) !== null) {
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      value: match[0],
    });
    if (match[0].length === 0) expression.lastIndex += 1;
  }
  return matches;
}

function selectBestRule(text: string) {
  const sample = text.slice(0, SAMPLE_LENGTH);
  let best: Rule | null = null;
  let bestValid = -1;
  let rawBest: Rule | null = null;
  let rawBestCount = -1;

  for (const candidate of AUTO_RULES) {
    const matches = findMatches(sample, candidate.pattern);
    if (matches.length > rawBestCount) {
      rawBest = candidate;
      rawBestCount = matches.length;
    }

    let lastEnd = 0;
    let valid = 0;
    let tooClose = 0;
    for (const match of matches) {
      const contentLength = match.index - lastEnd;
      if (lastEnd === 0 || contentLength > 1000) {
        valid += 1;
        lastEnd = match.end;
      } else if (contentLength < 100) {
        tooClose += 1;
      }
    }

    if (valid >= tooClose * 3 && valid > bestValid + 2) {
      best = candidate;
      bestValid = valid;
      if (valid > 70) break;
    }
  }

  if (best && bestValid >= 2) return best;
  return rawBestCount >= 2 ? rawBest : null;
}

function splitIntoChunks(text: string, preferredLength: number) {
  const result: string[] = [];
  let position = 0;
  while (position < text.length) {
    const remaining = text.length - position;
    if (remaining <= preferredLength) {
      const tail = cleanContent(text.slice(position));
      if (tail) result.push(tail);
      break;
    }

    const target = position + preferredLength;
    const minimum = position + Math.floor((preferredLength * 3) / 4);
    let split = text.lastIndexOf("\n", target);
    if (split < minimum) split = text.indexOf("\n", target);
    if (split <= position || split >= text.length) split = target;

    const part = cleanContent(text.slice(position, split));
    if (part) result.push(part);
    position = split;
    while (position < text.length && /\s/.test(text[position])) position += 1;
  }
  return result.length ? result : [""];
}

function addLongChapter(
  chapters: Chapter[],
  title: string,
  content: string,
  sourceStart: number,
) {
  if (content.length <= MAX_CHAPTER_LENGTH) {
    chapters.push({ title, content, sourceStart });
    return;
  }
  const parts = splitIntoChunks(content, MAX_CHAPTER_LENGTH);
  parts.forEach((part, index) => {
    chapters.push({
      title: `${title}（${index + 1}）`,
      content: part,
      sourceStart,
    });
  });
}

function buildFallback(text: string): SplitResult {
  const parts = splitIntoChunks(cleanContent(text), FALLBACK_CHAPTER_LENGTH);
  return {
    chapters: parts.map((content, index) => ({
      title:
        parts.length === 1 ? "正文" : `第${index + 1}章（自动分段）`,
      content,
      sourceStart: index * FALLBACK_CHAPTER_LENGTH,
    })),
    ruleName: "未识别到目录，按约 10KB 自动分段",
    usedFallback: true,
  };
}

function splitChapters(
  text: string,
  mode: SplitMode,
  customPattern: string,
): SplitResult {
  if (!text.trim()) throw new Error("TXT 文件中没有可拆分的正文。");

  let rule: Rule | null;
  if (mode === "chinese") {
    rule = {
      name: "中文章节",
      pattern: `(?:${CHINESE_STANDARD.pattern})|(?:${CHINESE_EXTENDED.pattern})|(?:${CHINESE_NUMBERED.pattern})`,
    };
  } else if (mode === "english") {
    rule = ENGLISH_STANDARD;
  } else if (mode === "custom") {
    if (!customPattern.trim()) throw new Error("请输入自定义章节正则。");
    try {
      new RegExp(customPattern, "gmi");
    } catch (error) {
      throw new Error(
        `自定义正则无效：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
    rule = { name: "自定义正则", pattern: customPattern };
  } else {
    rule = selectBestRule(text);
  }

  if (!rule) return buildFallback(text);
  const matches = findMatches(text, rule.pattern);
  if (!matches.length) return buildFallback(text);

  const chapters: Chapter[] = [];
  const preface = cleanContent(text.slice(0, matches[0].index));
  if (preface) addLongChapter(chapters, "前言", preface, 0);

  matches.forEach((match, index) => {
    const nextStart =
      index + 1 < matches.length ? matches[index + 1].index : text.length;
    const title =
      cleanTitle(match.value) || `第${chapters.length + 1}章`;
    const content = cleanContent(text.slice(match.end, nextStart));
    addLongChapter(chapters, title, content, match.index);
  });

  return chapters.length
    ? { chapters, ruleName: rule.name, usedFallback: false }
    : buildFallback(text);
}

function detectAndDecode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length) throw new Error("TXT 文件为空。");

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(3)),
      encoding: "UTF-8",
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes.slice(2)),
      encoding: "UTF-16 LE",
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes.slice(2)),
      encoding: "UTF-16 BE",
    };
  }

  const sampleLength = Math.min(bytes.length, 4096);
  let evenZero = 0;
  let oddZero = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (bytes[index] === 0) {
      if ((index & 1) === 0) evenZero += 1;
      else oddZero += 1;
    }
  }
  if (oddZero > sampleLength / 8 && evenZero < oddZero / 4) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes),
      encoding: "UTF-16 LE",
    };
  }
  if (evenZero > sampleLength / 8 && oddZero < evenZero / 4) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes),
      encoding: "UTF-16 BE",
    };
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "UTF-8",
    };
  } catch {
    try {
      return {
        text: new TextDecoder("gb18030").decode(bytes),
        encoding: "GB18030 / GBK",
      };
    } catch {
      throw new Error(
        "当前浏览器不支持 GB18030 解码，请使用最新版 Edge 或 Chrome。",
      );
    }
  }
}

async function decodeCover(file: Blob) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("无法读取封面图片。"));
      element.src = url;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9) {
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("浏览器无法转换封面图片。"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality,
    );
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    const candidate = line + character;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function drawCroppedImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  crop: CoverCrop,
) {
  const scale =
    Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) *
    crop.zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const movableX = Math.max(0, (drawWidth - targetWidth) / 2);
  const movableY = Math.max(0, (drawHeight - targetHeight) / 2);
  const drawX = (targetWidth - drawWidth) / 2 + crop.x * movableX;
  const drawY = (targetHeight - drawHeight) / 2 + crop.y * movableY;

  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

async function makeCoverJpeg(
  file: File | null,
  title: string,
  author: string,
  crop: CoverCrop,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持 Canvas 图片转换。");

  canvas.width = MAX_COVER_WIDTH;
  canvas.height = MAX_COVER_HEIGHT;

  if (file) {
    const decoded = await decodeCover(file);
    try {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawCroppedImage(
        context,
        decoded.source,
        decoded.width,
        decoded.height,
        canvas.width,
        canvas.height,
        crop,
      );
    } finally {
      decoded.close();
    }
  } else {
    const gradient = context.createLinearGradient(0, 0, 1600, 2560);
    gradient.addColorStop(0, "#173e3a");
    gradient.addColorStop(1, "#2c756d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(228, 174, 85, .16)";
    context.beginPath();
    context.arc(1320, 350, 480, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e4ae55";
    context.fillRect(150, 300, 10, 400);
    context.fillStyle = "#ffffff";
    context.font =
      '700 104px "Microsoft YaHei UI", "PingFang SC", sans-serif';
    wrapCanvasText(context, title || "未命名书籍", 1100).forEach(
      (line, index) => context.fillText(line, 210, 560 + index * 140),
    );
    context.fillStyle = "#d7e7e4";
    context.font =
      '400 52px "Microsoft YaHei UI", "PingFang SC", sans-serif';
    context.fillText(author || "佚名", 210, 1400);
    context.font = '400 38px "Microsoft YaHei UI", sans-serif';
    context.fillText("阅渡制书", 210, 2320);
  }

  return canvasToJpeg(canvas);
}

function paragraphMarkup(content: string) {
  const paragraphs = content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return paragraphs.length
    ? paragraphs.map((paragraph) => `    <p>${xml(paragraph)}</p>`).join("\n")
    : "    <p>&#160;</p>";
}

function buildEpubEntries(
  title: string,
  author: string,
  chapters: Chapter[],
  cover: Uint8Array,
) {
  const identifier = `urn:uuid:${
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }`;
  const chapterItems = chapters
    .map(
      (_, index) =>
        `    <item id="chapter_${index + 1}" href="Text/chapter_${String(
          index + 1,
        ).padStart(4, "0")}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const spineItems = chapters
    .map((_, index) => `    <itemref idref="chapter_${index + 1}"/>`)
    .join("\n");
  const navItems = chapters
    .map(
      (chapter, index) =>
        `        <li><a href="Text/chapter_${String(index + 1).padStart(
          4,
          "0",
        )}.xhtml">${xml(chapter.title)}</a></li>`,
    )
    .join("\n");
  const ncxItems = chapters
    .map(
      (chapter, index) =>
        `    <navPoint id="navPoint-${index + 1}" playOrder="${
          index + 1
        }"><navLabel><text>${xml(
          chapter.title,
        )}</text></navLabel><content src="Text/chapter_${String(
          index + 1,
        ).padStart(4, "0")}.xhtml"/></navPoint>`,
    )
    .join("\n");
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const entries: ZipEntry[] = [
    { name: "mimetype", data: encoder.encode("application/epub+zip") },
    {
      name: "META-INF/container.xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`),
    },
    {
      name: "OEBPS/Styles/book.css",
      data: encoder.encode(`html { writing-mode: horizontal-tb; }
body { margin: 5%; line-height: 1.8; font-family: serif; text-align: justify; }
h1 { font-size: 1.45em; text-align: center; margin: 1.8em 0; page-break-before: always; }
p { margin: .45em 0; text-indent: 2em; }
body.cover { margin: 0; padding: 0; text-align: center; }
body.cover img { max-width: 100%; max-height: 100vh; object-fit: contain; }
nav ol { list-style: none; padding-left: 0; } nav li { margin: .65em 0; }`),
    },
    { name: "OEBPS/Images/cover.jpg", data: cover },
    {
      name: "OEBPS/Text/cover.xhtml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>封面</title><meta name="viewport" content="width=device-width,height=device-height"/><link rel="stylesheet" type="text/css" href="../Styles/book.css"/></head><body class="cover"><div><img src="../Images/cover.jpg" alt="${xml(
        title,
      )}"/></div></body></html>`),
    },
  ];

  chapters.forEach((chapter, index) => {
    entries.push({
      name: `OEBPS/Text/chapter_${String(index + 1).padStart(
        4,
        "0",
      )}.xhtml`,
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>${xml(
        chapter.title,
      )}</title><link rel="stylesheet" type="text/css" href="../Styles/book.css"/></head><body>
  <h1>${xml(chapter.title)}</h1>
${paragraphMarkup(chapter.content)}
</body></html>`),
    });
  });

  entries.push(
    {
      name: "OEBPS/nav.xhtml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN"><head><title>${xml(
        title,
      )}</title><link rel="stylesheet" type="text/css" href="Styles/book.css"/></head><body><nav epub:type="toc" id="toc"><h1>目录</h1><ol>
${navItems}
      </ol></nav></body></html>`),
    },
    {
      name: "OEBPS/toc.ncx",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${xml(
    identifier,
  )}"/><meta name="dtb:depth" content="1"/></head>
  <docTitle><text>${xml(title)}</text></docTitle>
  <docAuthor><text>${xml(author)}</text></docAuthor>
  <navMap>
${ncxItems}
  </navMap>
</ncx>`),
    },
    {
      name: "OEBPS/content.opf",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${xml(identifier)}</dc:identifier>
    <dc:title>${xml(title)}</dc:title>
    <dc:creator>${xml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
    <meta name="cover" content="cover-image"/>
    <meta name="generator" content="阅渡制书 Web"/>
  </metadata>
  <manifest>
    <item id="css" href="Styles/book.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover-image" href="Images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
    <item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
${chapterItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover" linear="no"/>
${spineItems}
  </spine>
  <guide><reference type="cover" title="封面" href="Text/cover.xhtml"/></guide>
</package>`),
    },
  );

  return entries;
}

function setUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function setUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function createZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const stamp = dosDateTime(new Date());
  let offset = 0;

  entries.forEach((entry, index) => {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const flags = index === 0 ? 0 : 0x0800;
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    setUint32(localView, 0, 0x04034b50);
    setUint16(localView, 4, 20);
    setUint16(localView, 6, flags);
    setUint16(localView, 8, 0);
    setUint16(localView, 10, stamp.time);
    setUint16(localView, 12, stamp.date);
    setUint32(localView, 14, crc);
    setUint32(localView, 18, entry.data.length);
    setUint32(localView, 22, entry.data.length);
    setUint16(localView, 26, name.length);
    setUint16(localView, 28, 0);
    local.set(name, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    setUint32(centralView, 0, 0x02014b50);
    setUint16(centralView, 4, 20);
    setUint16(centralView, 6, 20);
    setUint16(centralView, 8, flags);
    setUint16(centralView, 10, 0);
    setUint16(centralView, 12, stamp.time);
    setUint16(centralView, 14, stamp.date);
    setUint32(centralView, 16, crc);
    setUint32(centralView, 20, entry.data.length);
    setUint32(centralView, 24, entry.data.length);
    setUint16(centralView, 28, name.length);
    setUint16(centralView, 30, 0);
    setUint16(centralView, 32, 0);
    setUint16(centralView, 34, 0);
    setUint16(centralView, 36, 0);
    setUint32(centralView, 38, 0);
    setUint32(centralView, 42, offset);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce(
    (total, part) => total + part.length,
    0,
  );
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  setUint32(endView, 0, 0x06054b50);
  setUint16(endView, 4, 0);
  setUint16(endView, 6, 0);
  setUint16(endView, 8, entries.length);
  setUint16(endView, 10, entries.length);
  setUint32(endView, 12, centralSize);
  setUint32(endView, 16, centralOffset);
  setUint16(endView, 20, 0);

  return new Blob(
    [...localParts, ...centralParts, end] as BlobPart[],
    { type: "application/epub+zip" },
  );
}

function safeFileName(value: string) {
  return (
    value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "未命名书籍"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function Home() {
  const locale = useMemo(() => localeFromPath(), []);
  const t = (key: string, variables?: Record<string, string | number>) =>
    message(locale, key, variables);
  const txtInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const activeLanguageRef = useRef<HTMLButtonElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropDragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [encodingName, setEncodingName] = useState("");
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverCrop, setCoverCrop] = useState<CoverCrop>(DEFAULT_COVER_CROP);
  const [cropDraft, setCropDraft] =
    useState<CoverCrop>(DEFAULT_COVER_CROP);
  const [cropOpen, setCropOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>("auto");
  const [customRegex, setCustomRegex] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(() => t("chooseTxtFirst"));
  const [error, setError] = useState("");

  const coverUrl = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : ""),
    [coverFile],
  );

  useEffect(
    () => () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    },
    [coverUrl],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!languageMenuOpen) return;
    activeLanguageRef.current?.focus();
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !languageMenuRef.current?.contains(event.target)
      ) {
        setLanguageMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLanguageMenuOpen(false);
      languageButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen]);

  useEffect(() => {
    if (
      import.meta.env.PROD &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!cropOpen) return;
    const canvas = cropCanvasRef.current;
    const image = cropImageRef.current;
    if (!canvas || !image || !image.complete || !image.naturalWidth) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = 500;
    canvas.height = 800;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawCroppedImage(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      canvas.width,
      canvas.height,
      cropDraft,
    );
  }, [coverUrl, cropDraft, cropOpen]);

  const totalCharacters = useMemo(
    () => chapters.reduce((total, chapter) => total + characterCount(chapter.content), 0),
    [chapters],
  );
  const selectedChapter = chapters[selectedIndex] ?? null;

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    rememberLocale(nextLocale);
    window.location.assign(LOCALE_PATHS[nextLocale]);
  }

  function applySplit(text: string, mode = splitMode) {
    const result = splitChapters(text, mode, customRegex);
    setChapters(result.chapters);
    setRuleName(result.ruleName);
    setUsedFallback(result.usedFallback);
    setSelectedIndex(0);
    setStatus(
      t("selectedSummary", {
        count: formatNumber(result.chapters.length, locale),
        rule: localizeRule(locale, result.ruleName),
      }),
    );
  }

  async function loadTxt(file: File) {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError(t("chooseTxtFormat"));
      return;
    }
    setBusy(true);
    setError("");
    setStatus(t("readingTxt"));
    try {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      const decoded = detectAndDecode(await file.arrayBuffer());
      const normalized = decoded.text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\0/g, "");
      setRawText(normalized);
      setSourceName(file.name);
      setEncodingName(decoded.encoding);
      if (!title.trim()) setTitle(file.name.replace(/\.txt$/i, ""));
      applySplit(normalized);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("readTxtFailed"));
      setChapters([]);
      setRuleName("");
    } finally {
      setBusy(false);
    }
  }

  function handleTxtChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void loadTxt(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadTxt(file);
  }

  function reanalyze() {
    if (!rawText) {
      setError(t("chooseTxt"));
      return;
    }
    setError("");
    setBusy(true);
    setStatus(t("reanalyzing"));
    window.setTimeout(() => {
      try {
        applySplit(rawText);
      } catch (problem) {
        setError(
          problem instanceof Error ? problem.message : t("splitFailed"),
        );
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  function beginEdit(index: number) {
    setEditingIndex(index);
    setEditTitle(chapters[index].title);
  }

  function saveEdit(index: number) {
    const nextTitle = editTitle.trim();
    if (nextTitle) {
      setChapters((current) =>
        current.map((chapter, chapterIndex) =>
          chapterIndex === index
            ? { ...chapter, title: nextTitle }
            : chapter,
        ),
      );
    }
    setEditingIndex(null);
  }

  function editKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") saveEdit(index);
    if (event.key === "Escape") setEditingIndex(null);
  }

  function chooseCover(file: File | null) {
    setCoverFile(file);
    setCoverCrop(DEFAULT_COVER_CROP);
    setCropDraft(DEFAULT_COVER_CROP);
    setCropOpen(Boolean(file));
    if (file) setStatus(t("coverLoaded"));
  }

  function openCoverCrop() {
    setCropDraft(coverCrop);
    setCropOpen(true);
  }

  function handleCropPointerDown(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    cropDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: cropDraft.x,
      y: cropDraft.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCropDraft((current) => ({
      ...current,
      x: clamp(drag.x + ((event.clientX - drag.clientX) / bounds.width) * 2, -1, 1),
      y: clamp(drag.y + ((event.clientY - drag.clientY) / bounds.height) * 2, -1, 1),
    }));
  }

  function handleCropPointerUp(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCropKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const step = event.shiftKey ? 0.1 : 0.025;
    const movement: Partial<CoverCrop> = {};
    if (event.key === "ArrowLeft") movement.x = clamp(cropDraft.x - step, -1, 1);
    if (event.key === "ArrowRight") movement.x = clamp(cropDraft.x + step, -1, 1);
    if (event.key === "ArrowUp") movement.y = clamp(cropDraft.y - step, -1, 1);
    if (event.key === "ArrowDown") movement.y = clamp(cropDraft.y + step, -1, 1);
    if (!Object.keys(movement).length) return;
    event.preventDefault();
    setCropDraft((current) => ({ ...current, ...movement }));
  }

  async function exportEpub() {
    if (!chapters.length) {
      setError(t("noExportableChapters"));
      return;
    }
    setBusy(true);
    setError("");
    setStatus(t("epubPreparing"));
    try {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      const bookTitle = title.trim() || t("untitled");
      const bookAuthor = author.trim() || t("anonymous");
      const cover = await makeCoverJpeg(
        coverFile,
        bookTitle,
        bookAuthor,
        coverCrop,
      );
      const entries = buildEpubEntries(
        bookTitle,
        bookAuthor,
        chapters,
        cover,
      );
      const epub = createZip(entries);
      downloadBlob(epub, `${safeFileName(bookTitle)}.epub`);
      setStatus(
        t("epubDone", { size: formatBytes(epub.size) }),
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("epubFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-root">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/icon-192.png" alt="" />
          <div>
            <h1>阅渡制书</h1>
            <p>{t("brandTagline")}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="language-menu" ref={languageMenuRef}>
            <button
              ref={languageButtonRef}
              type="button"
              className="language-trigger"
              aria-label={t("language")}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((current) => !current)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setLanguageMenuOpen(true);
                }
              }}
            >
              <span className="language-globe" aria-hidden="true">
                文
              </span>
              <span>
                {
                  LANGUAGE_OPTIONS.find(
                    (option) => option.locale === locale,
                  )?.label
                }
              </span>
              <span className="language-chevron" aria-hidden="true" />
            </button>
            {languageMenuOpen && (
              <div
                className="language-popover"
                role="menu"
                aria-label={t("language")}
              >
                {LANGUAGE_OPTIONS.map((option) => {
                  const active = option.locale === locale;
                  return (
                    <button
                      key={option.locale}
                      ref={active ? activeLanguageRef : undefined}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={active ? "active" : ""}
                      onClick={() => changeLocale(option.locale)}
                    >
                      <span>{option.label}</span>
                      <span className="language-check" aria-hidden="true">
                        {active ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="privacy-pill">
            <span className="privacy-dot" />
            {t("privacy")}
          </div>
        </div>
      </header>

      <div className="page-intro">
        <h2>{t("introTitle")}</h2>
        <p>{t("introDescription")}</p>
      </div>

      <div className="app-shell">
        <aside className="control-card">
          <section className="control-section">
            <div className="section-title">
              <span>1</span>
              <div>
                <h3>{t("selectFile")}</h3>
                <p>{t("encodingSupport")}</p>
              </div>
            </div>
            <input
              ref={txtInputRef}
              className="visually-hidden"
              type="file"
              accept=".txt,text/plain"
              onChange={handleTxtChange}
            />
            <div
              className={`drop-zone ${dragActive ? "is-dragging" : ""} ${
                sourceName ? "has-file" : ""
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <span className="file-glyph" aria-hidden="true">
                TXT
              </span>
              {sourceName ? (
                <div className="file-copy">
                  <strong>{sourceName}</strong>
                  <span>
                    {t("loadedSummary", { encoding: encodingName })}
                  </span>
                </div>
              ) : (
                <div className="file-copy">
                  <strong>{t("dropTxt")}</strong>
                  <span>{t("orChoose")}</span>
                </div>
              )}
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => txtInputRef.current?.click()}
              >
                {sourceName ? t("replace") : t("choose")}
              </button>
            </div>
          </section>

          <section className="control-section">
            <div className="section-title">
              <span>2</span>
              <div>
                <h3>{t("metadata")}</h3>
                <p>{t("optional")}</p>
              </div>
            </div>
            <div className="cover-row">
              <div className="cover-preview">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={t("customCoverPreview")}
                    style={{
                      transform: `translate(${coverCrop.x * 12}%, ${coverCrop.y * 12}%) scale(${coverCrop.zoom})`,
                    }}
                  />
                ) : (
                  <div className="default-cover">
                    <span>{title.trim().slice(0, 10) || t("untitled")}</span>
                    <small>{author.trim() || t("anonymous")}</small>
                  </div>
                )}
              </div>
              <div className="cover-actions">
                <input
                  ref={coverInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    chooseCover(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {t("chooseCover")}
                </button>
                <button
                  type="button"
                  className="text-button crop-cover-button"
                  onClick={openCoverCrop}
                  disabled={!coverFile}
                >
                  {t("cropCover")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => chooseCover(null)}
                  disabled={!coverFile}
                >
                  {t("defaultCover")}
                </button>
                <p>{t("coverHint")}</p>
              </div>
            </div>

            <label className="field">
              <span>{t("title")}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>{t("author")}</span>
              <input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder={t("authorPlaceholder")}
                autoComplete="off"
              />
            </label>
          </section>

          <section className="control-section">
            <div className="section-title">
              <span>3</span>
              <div>
                <h3>{t("split")}</h3>
                <p>{t("splitHint")}</p>
              </div>
            </div>
            <label className="field">
              <span>{t("splitMode")}</span>
              <select
                value={splitMode}
                onChange={(event) =>
                  setSplitMode(event.target.value as SplitMode)
                }
              >
                <option value="auto">{t("auto")}</option>
                <option value="chinese">{t("chinese")}</option>
                <option value="english">{t("english")}</option>
                <option value="custom">{t("custom")}</option>
              </select>
            </label>
            {splitMode === "custom" && (
              <label className="field">
                <span>{t("chapterRegex")}</span>
                <textarea
                  value={customRegex}
                  onChange={(event) => setCustomRegex(event.target.value)}
                  rows={3}
                  placeholder={t("regexPlaceholder")}
                  spellCheck={false}
                />
              </label>
            )}
            <button
              type="button"
              className="secondary-button full-width"
              onClick={reanalyze}
              disabled={!rawText || busy}
            >
              {t("reanalyze")}
            </button>
          </section>

          <div className="export-area">
            <div className="export-buttons">
              <button
                type="button"
                className="primary-button"
                onClick={() => void exportEpub()}
                disabled={!chapters.length || busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    {t("generating")}
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">↓</span>
                    {t("exportEpub")}
                  </>
                )}
              </button>
            </div>
            <p>{t("exportHint")}</p>
            <div className="format-notice" role="note">
              <strong>{t("formatNoticeTitle")}</strong>
              <span>{t("formatNoticeBody")}</span>
            </div>
          </div>
        </aside>

        <section className="workspace-card">
          <div className="workspace-header">
            <div>
              <h3>{t("chapters")}</h3>
              <p className="workspace-stats">
                {chapters.length
                  ? t("chapterStats", {
                      chapters: formatNumber(chapters.length, locale),
                      characters: formatNumber(totalCharacters, locale),
                      encoding: encodingName,
                    })
                  : t("afterTxt")}
              </p>
            </div>
            {ruleName && (
              <span className={`rule-badge ${usedFallback ? "warning" : ""}`}>
                {localizeRule(locale, ruleName)}
              </span>
            )}
          </div>

          <div className="chapter-list-header" aria-hidden="true">
            <span>#</span>
            <span>{t("chapterTitle")}</span>
            <span>{t("wordCount")}</span>
            <span />
          </div>
          <div
            className={`chapter-list ${!chapters.length ? "is-empty" : ""}`}
            role="listbox"
            aria-label={t("chapterList")}
          >
            {!chapters.length ? (
              <div className="empty-state">
                <span className="empty-book" aria-hidden="true">
                  {t("book")}
                </span>
                <strong>{t("noChapters")}</strong>
                <p>{t("chooseTxtFirst")}</p>
              </div>
            ) : (
              chapters.map((chapter, index) => (
                <div
                  className={`chapter-row ${
                    selectedIndex === index ? "is-selected" : ""
                  }`}
                  key={`${chapter.sourceStart}-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <button
                    type="button"
                    className="chapter-main"
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => beginEdit(index)}
                  >
                    <span className="chapter-index">{index + 1}</span>
                    {editingIndex === index ? (
                      <input
                        className="chapter-edit"
                        value={editTitle}
                        autoFocus
                        onChange={(event) => setEditTitle(event.target.value)}
                        onKeyDown={(event) => editKeyDown(event, index)}
                        onBlur={() => saveEdit(index)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      <span className="chapter-title">{chapter.title}</span>
                    )}
                    <span className="chapter-count">
                      {formatNumber(characterCount(chapter.content), locale)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="edit-button"
                    aria-label={t("editChapter", {
                      title: chapter.title,
                    })}
                    onClick={() => beginEdit(index)}
                  >
                    {t("edit")}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="preview-panel">
            <div className="preview-heading">
              <span>{t("excerpt")}</span>
              {selectedChapter && (
                <small>{selectedChapter.title}</small>
              )}
            </div>
            <div className="preview-content">
              {selectedChapter ? (
                <>
                  <h4>{selectedChapter.title}</h4>
                  <p>
                    {selectedChapter.content.length > 30_000
                      ? `${selectedChapter.content.slice(
                          0,
                          30_000,
                        )}\n\n${t("excerptTruncated")}`
                      : selectedChapter.content || t("emptyChapter")}
                  </p>
                </>
              ) : (
                <p className="preview-placeholder">{t("selectChapter")}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {cropOpen && coverUrl && (
        <div
          className="crop-dialog-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setCropOpen(false);
          }}
        >
          <section
            className="crop-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-dialog-title"
          >
            <div className="crop-dialog-header">
              <div>
                <h3 id="crop-dialog-title">{t("cropTitle")}</h3>
                <p>{t("cropDescription")}</p>
              </div>
              <button
                type="button"
                className="crop-close"
                onClick={() => setCropOpen(false)}
                aria-label={t("closeCrop")}
              >
                ×
              </button>
            </div>

            <div className="crop-dialog-body">
              <div className="crop-stage">
                <img
                  ref={cropImageRef}
                  src={coverUrl}
                  alt=""
                  onLoad={() => setCropDraft((current) => ({ ...current }))}
                />
                <canvas
                  ref={cropCanvasRef}
                  className="crop-canvas"
                  tabIndex={0}
                  aria-label={t("cropArea")}
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerCancel={handleCropPointerUp}
                  onKeyDown={handleCropKeyDown}
                />
                <span className="crop-ratio">5:8</span>
              </div>

              <div className="crop-controls">
                <div className="crop-output">
                  <strong>{t("outputSize")}</strong>
                  <span>1600 × 2560 JPEG（5:8）</span>
                </div>
                <label className="crop-zoom">
                  <span>
                    {t("zoom")}
                    <output>{cropDraft.zoom.toFixed(2)}×</output>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={cropDraft.zoom}
                    onChange={(event) =>
                      setCropDraft((current) => ({
                        ...current,
                        zoom: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <p className="crop-tip">
                  {t("cropHelp")}
                </p>
                <div className="crop-dialog-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCropDraft(DEFAULT_COVER_CROP)}
                  >
                    {t("reset")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setCropOpen(false)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="primary-button crop-apply"
                    onClick={() => {
                      setCoverCrop(cropDraft);
                      setCropOpen(false);
                      setStatus(t("cropApplied"));
                    }}
                  >
                    {t("applyCrop")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <div
        className={`status-bar ${error ? "has-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        <span className="status-icon" aria-hidden="true">
          {error ? "!" : "✓"}
        </span>
        <span>{error || status}</span>
      </div>

      <footer>
        <span>阅渡制书</span>
        <div className="footer-meta">
          <span>{t("localOnly")}</span>
          <a
            href="https://github.com/wykings/yuepad-book-maker/issues/new"
            target="_blank"
            rel="noreferrer"
          >
            {t("githubFeedback")}
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
