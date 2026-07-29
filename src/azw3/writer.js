/*
 * KF8/AZW3 writer for 阅渡制书.
 *
 * Based on epub-to-kindle by Ken-B:
 * https://github.com/Ken-B/epub-to-kindle
 * Copyright (C) 2026 Ken-B contributors
 * Licensed under GNU GPL v3.0.
 *
 * Modified 2026-07-28: extracted into a data-model based module, removed the
 * general EPUB parser and MOBI6 path, and added deterministic validation.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TEXT_RECORD_SIZE = 4096;

function concat(...arrays) {
  const total = arrays.reduce((size, array) => size + array.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
  return bytes;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value & 0xffff, false);
  return bytes;
}

function fill(byte, length) {
  return new Uint8Array(length).fill(byte);
}

function align4(bytes) {
  const remainder = bytes.length % 4;
  return remainder === 0 ? bytes : concat(bytes, fill(0, 4 - remainder));
}

function encint(value) {
  value >>>= 0;
  const bytes = [];
  while (value > 0) {
    bytes.push(value & 0x7f);
    value >>>= 7;
  }
  if (bytes.length === 0) bytes.push(0);
  bytes[0] |= 0x80;
  bytes.reverse();
  return new Uint8Array(bytes);
}

export function palmDocCompress(data) {
  const length = data.length;
  const output = [];
  const hashBits = 15;
  const hashMask = (1 << hashBits) - 1;
  const chainLength = 8;
  const heads = new Int32Array(1 << hashBits).fill(-1);
  const next = new Int32Array(length).fill(-1);
  const hash3 = (position) =>
    (((data[position] * 2654435761) ^
      (data[position + 1] * 40503) ^
      data[position + 2]) >>>
      0) &
    hashMask;

  let index = 0;
  while (index < length) {
    let bestLength = 0;
    let bestDistance = 0;
    const maximumLength = Math.min(length - index, 10);

    if (maximumLength >= 3) {
      const hash = hash3(index);
      let position = heads[hash];
      let checks = 0;
      while (
        position !== -1 &&
        index - position <= 2047 &&
        checks < chainLength
      ) {
        const distance = index - position;
        let matchLength = 0;
        while (
          matchLength < maximumLength &&
          data[position + matchLength] === data[index + matchLength]
        ) {
          matchLength += 1;
        }
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestDistance = distance;
        }
        if (bestLength === 10) break;
        position = next[position];
        checks += 1;
      }
      next[index] = heads[hash];
      heads[hash] = index;
    }

    if (bestLength >= 3) {
      const code = ((bestDistance << 3) | (bestLength - 3)) & 0x3fff;
      output.push(0x80 | (code >> 8), code & 0xff);
      for (let step = 1; step < bestLength; step += 1) {
        if (index + step + 2 < length) {
          const hash = hash3(index + step);
          next[index + step] = heads[hash];
          heads[hash] = index + step;
        }
      }
      index += bestLength;
      continue;
    }

    const byte = data[index];
    if (
      byte === 0x20 &&
      index + 1 < length &&
      data[index + 1] >= 0x40 &&
      data[index + 1] < 0x80
    ) {
      output.push(data[index + 1] | 0x80);
      index += 2;
    } else if (byte >= 0x80 || (byte >= 0x01 && byte <= 0x08)) {
      let end = index + 1;
      while (end < length && end - index < 8) {
        const nextByte = data[end];
        if (
          nextByte >= 0x80 ||
          (nextByte >= 0x01 && nextByte <= 0x08)
        ) {
          end += 1;
        } else {
          break;
        }
      }
      output.push(end - index);
      for (let cursor = index; cursor < end; cursor += 1) {
        output.push(data[cursor]);
      }
      index = end;
    } else {
      output.push(byte);
      index += 1;
    }
  }
  return new Uint8Array(output);
}

function buildExth(records) {
  const parts = records.map(({ tag, value }) => {
    const data = value instanceof Uint8Array ? value : encoder.encode(String(value));
    return concat(u32(tag), u32(8 + data.length), data);
  });
  const raw = concat(...parts);
  const padding = 4 - (raw.length % 4);
  return concat(
    encoder.encode("EXTH"),
    u32(12 + raw.length),
    u32(records.length),
    raw,
    fill(0, padding),
  );
}

function buildFdst(flows) {
  return concat(
    encoder.encode("FDST"),
    u32(12),
    u32(flows.length),
    concat(...flows.map((flow) => concat(u32(flow.start), u32(flow.end)))),
  );
}

const FLIS_RECORD = new Uint8Array([
  0x46, 0x4c, 0x49, 0x53, 0x00, 0x00, 0x00, 0x08, 0x00, 0x41, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x01, 0x00, 0x03,
  0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xff,
]);

const EOF_RECORD = new Uint8Array([0xe9, 0x8e, 0x0d, 0x0a]);

function buildFcis(textLength) {
  return concat(
    encoder.encode("FCIS"),
    u32(0x14),
    u32(0x10),
    u32(0x02),
    u32(0),
    u32(textLength),
    u32(0),
    u32(0x28),
    u32(0),
    u32(0x28),
    u32(0x08),
    new Uint8Array([0, 1, 0, 1, 0, 0, 0, 0]),
  );
}

function buildTextRecords(text, compress) {
  const bytes = encoder.encode(text);
  const records = [];
  let position = 0;
  while (position < bytes.length) {
    let end = Math.min(position + TEXT_RECORD_SIZE, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end += 1;
    const chunk = bytes.slice(position, end);
    records.push(
      concat(compress ? palmDocCompress(chunk) : chunk, new Uint8Array([0])),
    );
    position = end;
  }
  if (!records.length) records.push(new Uint8Array([0]));
  return records;
}

const MASK_TO_SHIFT = {
  1: 0,
  2: 1,
  3: 0,
  4: 2,
  8: 3,
  12: 2,
  16: 4,
  32: 5,
  48: 4,
  64: 6,
  128: 7,
  192: 6,
};

function buildTagx(tagTypes) {
  const body = [];
  for (const type of tagTypes) {
    body.push(type.num, type.vpe, type.mask, 0);
  }
  body.push(0, 0, 0, 1);
  return concat(
    encoder.encode("TAGX"),
    u32(12 + body.length),
    u32(1),
    new Uint8Array(body),
  );
}

function serializeEntry(key, tags, tagTypes) {
  const keyBytes = encoder.encode(key);
  let control = 0;
  for (const type of tagTypes) {
    const values = tags[type.num] || [];
    control |=
      type.mask &
      ((values.length / type.vpe) << MASK_TO_SHIFT[type.mask]);
  }
  const values = [];
  for (const type of tagTypes) {
    for (const value of tags[type.num] || []) values.push(encint(value));
  }
  return concat(
    new Uint8Array([keyBytes.length]),
    keyBytes,
    new Uint8Array([control]),
    ...values,
  );
}

function buildIndxRecords(entries, tagTypes, cncxRecord) {
  const headerSize = 192;
  const limit = 0x10000 - headerSize - 1048;
  const blocks = [[]];
  const indexOffsets = [[]];
  const counts = [0];
  const lastKeys = [new Uint8Array(0)];

  for (const entry of entries) {
    const bytes = serializeEntry(entry.key, entry.tags, tagTypes);
    let blockIndex = blocks.length - 1;
    const used =
      blocks[blockIndex].reduce((size, part) => size + part.length, 0) +
      indexOffsets[blockIndex].length * 2;
    if (used + bytes.length + 2 > limit && blocks[blockIndex].length > 0) {
      blocks.push([]);
      indexOffsets.push([]);
      counts.push(0);
      lastKeys.push(new Uint8Array(0));
      blockIndex += 1;
    }
    indexOffsets[blockIndex].push(
      headerSize +
        blocks[blockIndex].reduce((size, part) => size + part.length, 0),
    );
    blocks[blockIndex].push(bytes);
    counts[blockIndex] += 1;
    lastKeys[blockIndex] = encoder.encode(entry.key);
  }

  const dataRecords = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const body = align4(concat(...blocks[index]));
    const offsetData = new Uint8Array(indexOffsets[index].length * 2);
    const offsetView = new DataView(offsetData.buffer);
    indexOffsets[index].forEach((offset, itemIndex) =>
      offsetView.setUint16(itemIndex * 2, offset, false),
    );
    const indexBlock = align4(concat(encoder.encode("IDXT"), offsetData));
    const indexOffset = headerSize + body.length;
    const header = new Uint8Array(headerSize);
    const view = new DataView(header.buffer);
    header.set(encoder.encode("INDX"), 0);
    view.setUint32(4, headerSize, false);
    view.setUint32(12, 1, false);
    view.setUint32(20, indexOffset, false);
    view.setUint32(24, counts[index], false);
    header.fill(0xff, 28, 36);
    dataRecords.push(concat(header, body, indexBlock));
  }

  const tagx = align4(buildTagx(tagTypes));
  const geometryParts = blocks.map((_, index) =>
    concat(
      new Uint8Array([lastKeys[index].length]),
      lastKeys[index],
      u16(counts[index]),
    ),
  );
  const geometry = align4(concat(...geometryParts));
  let geometryPosition = headerSize + tagx.length;
  let geometryOffset = 0;
  const headerOffsets = [];
  for (let index = 0; index < blocks.length; index += 1) {
    headerOffsets.push(geometryPosition + geometryOffset);
    geometryOffset += 1 + lastKeys[index].length + 2;
  }
  const headerOffsetData = new Uint8Array(headerOffsets.length * 2);
  const headerOffsetView = new DataView(headerOffsetData.buffer);
  headerOffsets.forEach((offset, index) =>
    headerOffsetView.setUint16(index * 2, offset, false),
  );
  const headerIdxt = align4(
    concat(encoder.encode("IDXT"), headerOffsetData),
  );
  const headerIdxtOffset = headerSize + tagx.length + geometry.length;
  const header = new Uint8Array(headerSize);
  const headerView = new DataView(header.buffer);
  header.set(encoder.encode("INDX"), 0);
  headerView.setUint32(4, headerSize, false);
  headerView.setUint32(16, 2, false);
  headerView.setUint32(20, headerIdxtOffset, false);
  headerView.setUint32(24, dataRecords.length, false);
  headerView.setUint32(28, 65001, false);
  headerView.setUint32(32, 0xffffffff, false);
  headerView.setUint32(36, entries.length, false);
  headerView.setUint32(52, cncxRecord ? 1 : 0, false);
  headerView.setUint32(180, headerSize, false);

  return [
    concat(header, tagx, geometry, headerIdxt),
    ...dataRecords,
    ...(cncxRecord ? [cncxRecord] : []),
  ];
}

const SKELETON_TAGS = [
  { num: 1, vpe: 1, mask: 3 },
  { num: 6, vpe: 2, mask: 12 },
];

function buildSkeletonIndex(parts) {
  const entries = parts.map((part, index) => {
    const skeletonLength =
      part.skeletonHeadByteLength + part.skeletonTailByteLength;
    return {
      key: `SKEL${String(index).padStart(10, "0")}`,
      tags: {
        1: [part.chunkCount, part.chunkCount],
        6: [
          part.flowStart,
          skeletonLength,
          part.flowStart,
          skeletonLength,
        ],
      },
    };
  });
  return buildIndxRecords(entries, SKELETON_TAGS, null);
}

const CHUNK_TAGS = [
  { num: 2, vpe: 1, mask: 1 },
  { num: 3, vpe: 1, mask: 2 },
  { num: 4, vpe: 1, mask: 4 },
  { num: 6, vpe: 2, mask: 8 },
];

function buildCncx(selectors) {
  const parts = [];
  const offsets = [];
  let byteOffset = 0;
  for (const selector of selectors) {
    const bytes = encoder.encode(selector);
    const length = encint(bytes.length);
    offsets.push(byteOffset);
    parts.push(length, bytes);
    byteOffset += length.length + bytes.length;
  }
  return { record: align4(concat(...parts)), offsets };
}

function buildChunkIndex(parts) {
  const selectors = parts.map(
    (part) => `P-//*[@aid='${part.firstAid}']`,
  );
  const { record, offsets } = buildCncx(selectors);
  const entries = parts.map((part, index) => {
    const insertPosition =
      part.flowStart + part.skeletonHeadByteLength - 1;
    const contentStart =
      part.flowStart +
      part.skeletonHeadByteLength +
      part.skeletonTailByteLength;
    return {
      key: String(insertPosition).padStart(10, "0"),
      tags: {
        2: [offsets[index]],
        3: [part.chapterIndex],
        4: [0],
        6: [contentStart, part.contentByteLength],
      },
    };
  });
  return buildIndxRecords(entries, CHUNK_TAGS, record);
}

const NCX_TAGS = [
  { num: 1, vpe: 1, mask: 1 },
  { num: 2, vpe: 1, mask: 2 },
  { num: 3, vpe: 1, mask: 4 },
  { num: 4, vpe: 1, mask: 8 },
  { num: 21, vpe: 1, mask: 16 },
  { num: 22, vpe: 1, mask: 32 },
  { num: 23, vpe: 1, mask: 64 },
  { num: 6, vpe: 2, mask: 128 },
];

function buildNcxIndex(parts, titles) {
  if (!parts.length) return null;
  const cncxParts = [];
  const cncxOffsets = [];
  let cncxOffset = 0;
  for (const title of titles) {
    const titleBytes = encoder.encode(title || "章节");
    const length = encint(titleBytes.length);
    cncxOffsets.push(cncxOffset);
    cncxParts.push(length, titleBytes);
    cncxOffset += length.length + titleBytes.length;
  }
  const cncxRecord = align4(concat(...cncxParts));
  const largest = parts.length - 1;
  const keyLength = Math.max(2, largest.toString(16).length);
  const entries = parts.map((part, index) => {
    const contentStart =
      part.flowStart +
      part.skeletonHeadByteLength +
      part.skeletonTailByteLength;
    return {
      key: index.toString(16).toUpperCase().padStart(keyLength, "0"),
      tags: {
        1: [contentStart],
        2: [part.contentByteLength],
        3: [cncxOffsets[index]],
        4: [0],
        6: [part.chapterIndex, 0],
      },
    };
  });
  return buildIndxRecords(entries, NCX_TAGS, cncxRecord);
}

function buildRecord0(options) {
  const titleBytes = encoder.encode(options.fullTitle);
  const exthBytes = buildExth(options.exthRecords);
  const headerSize = 280;
  const titleOffset = headerSize + exthBytes.length;
  const header = new Uint8Array(headerSize);
  const view = new DataView(header.buffer);
  let position = 0;

  view.setUint16(position, options.compress ? 2 : 1, false);
  position += 4;
  view.setUint32(position, options.textLength >>> 0, false);
  position += 4;
  view.setUint16(position, options.textRecordCount, false);
  position += 2;
  view.setUint16(position, TEXT_RECORD_SIZE, false);
  position += 2;
  position += 4;
  header.set(encoder.encode("MOBI"), position);
  position += 4;
  view.setUint32(position, 264, false);
  position += 4;
  view.setUint32(position, 2, false);
  position += 4;
  view.setUint32(position, 65001, false);
  position += 4;
  view.setUint32(position, options.uid >>> 0, false);
  position += 4;
  view.setUint32(position, 8, false);
  position += 4;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  for (let index = 0; index < 8; index += 1) {
    view.setUint32(position, 0xffffffff, false);
    position += 4;
  }
  view.setUint32(position, options.firstNonText, false);
  position += 4;
  view.setUint32(position, titleOffset, false);
  position += 4;
  view.setUint32(position, titleBytes.length, false);
  position += 4;
  view.setUint32(position, options.languageCode, false);
  position += 4;
  position += 8;
  view.setUint32(position, 8, false);
  position += 4;
  view.setUint32(position, options.firstResource, false);
  position += 4;
  position += 16;
  view.setUint32(position, 0x50, false);
  position += 4;
  position += 32;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  position += 12;
  position += 8;
  view.setUint32(position, options.fdstRecord, false);
  position += 4;
  view.setUint32(position, options.fdstCount, false);
  position += 4;
  view.setUint32(position, options.fcisRecord, false);
  position += 4;
  view.setUint32(position, 1, false);
  position += 4;
  view.setUint32(position, options.flisRecord, false);
  position += 4;
  view.setUint32(position, 1, false);
  position += 4;
  position += 8;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  position += 4;
  header.fill(0xff, position, position + 8);
  position += 8;
  view.setUint32(position, 1, false);
  position += 4;
  view.setUint32(position, options.ncxIndex, false);
  position += 4;
  view.setUint32(position, options.chunkIndex, false);
  position += 4;
  view.setUint32(position, options.skeletonIndex, false);
  position += 4;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  view.setUint32(position, 0xffffffff, false);
  position += 4;
  header.fill(0xff, position, position + 4);
  position += 8;
  header.fill(0xff, position, position + 4);

  return concat(header, exthBytes, titleBytes, fill(0, 8192));
}

function buildPalmDatabase(title, records) {
  const now = Math.floor(Date.now() / 1000);
  const recordCount = records.length;
  const headerSize = 78 + 8 * recordCount + 2;
  const header = new Uint8Array(headerSize);
  const view = new DataView(header.buffer);
  const databaseName = title
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/ /g, "_")
    .slice(0, 31);
  for (let index = 0; index < databaseName.length; index += 1) {
    header[index] = databaseName.charCodeAt(index);
  }
  view.setUint32(36, now, false);
  view.setUint32(40, now, false);
  header.set(encoder.encode("BOOKMOBI"), 60);
  view.setUint32(68, 2 * recordCount - 1, false);
  view.setUint16(76, recordCount, false);
  let offset = headerSize;
  for (let index = 0; index < recordCount; index += 1) {
    view.setUint32(78 + index * 8, offset, false);
    header[78 + index * 8 + 5] = (2 * index) >> 16;
    header[78 + index * 8 + 6] = ((2 * index) >> 8) & 0xff;
    header[78 + index * 8 + 7] = (2 * index) & 0xff;
    offset += records[index].length;
  }
  return concat(header, ...records);
}

const LANGUAGES = {
  af: 54,
  ar: 1,
  bg: 2,
  ca: 3,
  zh: 4,
  cs: 5,
  da: 6,
  nl: 19,
  en: 9,
  et: 37,
  fi: 11,
  fr: 12,
  de: 7,
  el: 8,
  he: 13,
  hi: 57,
  hu: 14,
  id: 33,
  it: 16,
  ja: 17,
  ko: 18,
  lv: 38,
  lt: 39,
  ms: 62,
  no: 20,
  pl: 21,
  pt: 22,
  ro: 24,
  ru: 25,
  sr: 26,
  sk: 27,
  sl: 36,
  es: 10,
  sv: 29,
  th: 30,
  tr: 31,
  uk: 34,
  vi: 42,
};

function languageCode(tag) {
  return LANGUAGES[(tag || "zh").toLowerCase().split("-")[0]] || 9;
}

function escapeMarkup(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contentMarkup(content, firstAid) {
  const normalized = String(content)
    .replace(/\r\n?/g, "\n")
    .replace(/\0/g, "")
    .trim();
  const paragraphs = normalized
    .split(/\n{2,}/)
    .flatMap((block) => block.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);
  if (!paragraphs.length) {
    return `<p aid="${firstAid}">&#160;</p>`;
  }
  return paragraphs
    .map(
      (paragraph, index) =>
        `<p aid="${firstAid + index}">${escapeMarkup(paragraph)}</p>`,
    )
    .join("\n");
}

const KINDLE_STYLES = [
  "body{margin:0 5%;line-height:1.65;text-align:justify;}",
  "h1{font-size:1.45em;text-align:center;margin:1.8em 0;page-break-before:always;}",
  "p{margin:.45em 0;text-indent:2em;}",
].join("");

function createChapterParts(chapters) {
  let nextAid = 1;
  return chapters.map((chapter, index) => {
    const firstAid = nextAid;
    const paragraphs = String(chapter.content)
      .replace(/\r\n?/g, "\n")
      .replace(/\0/g, "")
      .trim()
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    nextAid += Math.max(1, paragraphs.length) + 1;
    const title = chapter.title?.trim() || `第 ${index + 1} 章`;
    const skeletonHead =
      `<html xmlns="http://www.w3.org/1999/xhtml"><head>` +
      `<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>` +
      `<title>${escapeMarkup(title)}</title>` +
      `<style type="text/css">${KINDLE_STYLES}</style>` +
      `</head><body aid="0">\n`;
    const skeletonTail = "</body></html>\n";
    const content =
      `<h1 aid="${firstAid}">${escapeMarkup(title)}</h1>\n` +
      contentMarkup(chapter.content, firstAid + 1);
    return { title, skeletonHead, skeletonTail, content, firstAid };
  });
}

/**
 * Build a KF8-only AZW3 file for modern Kindle devices.
 *
 * @param {{
 *   title: string;
 *   author?: string;
 *   language?: string;
 *   identifier?: string;
 *   chapters: Array<{title: string; content: string}>;
 *   cover?: Uint8Array;
 * }} book
 * @param {(progress: number, message: string) => void} [onProgress]
 */
export function createAzw3(book, onProgress = () => undefined) {
  if (!book?.chapters?.length) {
    throw new Error("没有可导出的章节。");
  }
  const title = book.title?.trim() || "未命名书籍";
  const author = book.author?.trim() || "佚名";
  const language = book.language || "zh-CN";
  const identifier =
    book.identifier ||
    `urn:uuid:${
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    }`;

  onProgress(8, "正在整理章节");
  const chapters = createChapterParts(book.chapters);
  let htmlByteOffset = 0;
  const indexParts = chapters.map((chapter, index) => {
    const skeletonHeadByteLength = encoder.encode(
      chapter.skeletonHead,
    ).length;
    const skeletonTailByteLength = encoder.encode(
      chapter.skeletonTail,
    ).length;
    const contentByteLength = encoder.encode(chapter.content).length;
    const part = {
      chapterIndex: index,
      chunkCount: 1,
      skeletonHeadByteLength,
      skeletonTailByteLength,
      contentByteLength,
      flowStart: htmlByteOffset,
      firstAid: chapter.firstAid,
    };
    htmlByteOffset +=
      skeletonHeadByteLength +
      skeletonTailByteLength +
      contentByteLength;
    return part;
  });

  const fullText = chapters
    .map(
      (chapter) =>
        chapter.skeletonHead + chapter.skeletonTail + chapter.content,
    )
    .join("");
  const textLength = encoder.encode(fullText).length;
  const compress = textLength > 2048;
  onProgress(25, compress ? "正在压缩正文" : "正在写入正文");
  const textRecords = buildTextRecords(fullText, compress);
  const records = [new Uint8Array(0), ...textRecords];
  const dataLength = records
    .slice(1)
    .reduce((size, record) => size + record.length, 0);
  if (dataLength % 4) records.push(fill(0, 4 - (dataLength % 4)));
  const firstNonText = records.length;

  onProgress(55, "正在生成章节索引");
  const skeletonIndex = records.length;
  records.push(...buildSkeletonIndex(indexParts));
  const chunkIndex = records.length;
  records.push(...buildChunkIndex(indexParts));
  const ncxRecords = buildNcxIndex(
    indexParts,
    chapters.map((chapter) => chapter.title),
  );
  const ncxIndex = ncxRecords ? records.length : 0xffffffff;
  if (ncxRecords) records.push(...ncxRecords);

  let firstResource = 0xffffffff;
  let coverOffset = -1;
  if (book.cover?.length) {
    firstResource = records.length;
    coverOffset = 0;
    records.push(book.cover);
  }

  const fdstRecord = records.length;
  records.push(buildFdst([{ start: 0, end: htmlByteOffset }]));
  const flisRecord = records.length;
  records.push(FLIS_RECORD);
  const fcisRecord = records.length;
  records.push(buildFcis(textLength));
  records.push(EOF_RECORD);

  const uuid = identifier.replace(/^urn:uuid:/i, "").slice(0, 64);
  const exthRecords = [
    { tag: 503, value: title },
    { tag: 112, value: `yuedu:${uuid}` },
    { tag: 113, value: uuid },
    { tag: 501, value: "EBOK" },
    { tag: 524, value: language.split("-")[0] },
    { tag: 528, value: "true" },
    { tag: 108, value: "阅渡制书 Web（基于 epub-to-kindle KF8 writer）" },
    { tag: 100, value: author },
    { tag: 106, value: new Date().toISOString().slice(0, 10) },
  ];
  if (firstResource !== 0xffffffff && coverOffset >= 0) {
    exthRecords.push(
      { tag: 201, value: u32(coverOffset) },
      { tag: 202, value: u32(coverOffset) },
      { tag: 203, value: u32(0) },
    );
  }

  onProgress(78, "正在封装 AZW3");
  records[0] = buildRecord0({
    compress,
    textLength,
    textRecordCount: textRecords.length,
    firstNonText,
    fdstRecord,
    fdstCount: 1,
    flisRecord,
    fcisRecord,
    chunkIndex,
    skeletonIndex,
    ncxIndex,
    firstResource,
    uid: Math.floor(Math.random() * 0xffffffff) >>> 0,
    languageCode: languageCode(language),
    exthRecords,
    fullTitle: title,
  });

  const result = buildPalmDatabase(title, records);
  const validation = validateAzw3(result);
  if (!validation.valid) {
    throw new Error(`AZW3 校验失败：${validation.errors.join("；")}`);
  }
  onProgress(100, "AZW3 已生成");
  return result;
}

/**
 * Validate the container signature and essential KF8 header fields.
 *
 * @param {Uint8Array} bytes
 */
export function validateAzw3(bytes) {
  const errors = [];
  let title = "";
  let recordCount = 0;
  let fileVersion = 0;
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length < 100) {
      throw new Error("文件过小");
    }
    const signature = decoder.decode(bytes.slice(60, 68));
    if (signature !== "BOOKMOBI") errors.push("缺少 BOOKMOBI 标识");
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    recordCount = view.getUint16(76, false);
    if (recordCount < 2) errors.push("记录数量异常");
    const record0Offset = view.getUint32(78, false);
    if (record0Offset + 100 > bytes.length) {
      errors.push("首记录偏移越界");
    } else {
      const mobi = decoder.decode(
        bytes.slice(record0Offset + 16, record0Offset + 20),
      );
      if (mobi !== "MOBI") errors.push("缺少 MOBI 头");
      const encoding = view.getUint32(record0Offset + 28, false);
      if (encoding !== 65001) errors.push("正文不是 UTF-8 编码");
      fileVersion = view.getUint32(record0Offset + 36, false);
      if (fileVersion !== 8) errors.push("文件不是 KF8/MOBI 8");
      const titleOffset = view.getUint32(record0Offset + 84, false);
      const titleLength = view.getUint32(record0Offset + 88, false);
      const titleStart = record0Offset + titleOffset;
      if (
        titleLength > 0 &&
        titleStart + titleLength <= bytes.length
      ) {
        title = decoder.decode(
          bytes.slice(titleStart, titleStart + titleLength),
        );
      } else {
        errors.push("书名元数据异常");
      }
    }
  } catch (problem) {
    errors.push(problem instanceof Error ? problem.message : "无法读取文件");
  }
  return {
    valid: errors.length === 0,
    errors,
    title,
    recordCount,
    fileVersion,
    size: bytes?.length || 0,
  };
}
