export type Locale = "zh-CN" | "zh-TW" | "en";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_PATHS: Record<Locale, string> = {
  "zh-CN": "/zh-cn/",
  "zh-TW": "/zh-tw/",
  en: "/",
};

export const LANGUAGE_OPTIONS: Array<{ locale: Locale; label: string }> = [
  { locale: "zh-CN", label: "简体中文" },
  { locale: "zh-TW", label: "繁體中文" },
  { locale: "en", label: "English" },
];

const messages: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    brandTagline: "TXT 转 EPUB",
    privacy: "文件不会上传",
    language: "语言",
    githubFeedback: "在 GitHub 提交建议",
    introTitle: "把 TXT 整理成电子书",
    introDescription:
      "选文件，检查分章，补上书名和封面，再按阅读方式导出。",
    selectFile: "选文件",
    encodingSupport: "UTF-8、UTF-16、GBK 均可",
    loaded: "已载入",
    dropTxt: "把 TXT 拖到这里",
    orChoose: "或点“选择”",
    choose: "选择",
    replace: "更换",
    metadata: "书名与封面",
    optional: "不填也能导出",
    customCoverPreview: "自定义封面预览",
    untitled: "未命名书籍",
    anonymous: "佚名",
    chooseCover: "选择封面",
    cropCover: "裁剪封面",
    defaultCover: "使用默认封面",
    coverHint: "WebP 可用，导出为 1600×2560 JPEG",
    title: "书名",
    titlePlaceholder: "输入书名",
    author: "作者",
    authorPlaceholder: "输入作者",
    split: "分章",
    splitHint: "先用自动识别，不准再换规则",
    splitMode: "识别方式",
    auto: "自动识别",
    chinese: "中文网文章节",
    english: "英文 Chapter / Section",
    custom: "自定义正则",
    chapterRegex: "章节正则",
    regexPlaceholder: "例如：^第.+章.*$",
    reanalyze: "重新分析章节",
    generating: "正在生成",
    exportEpub: "导出 EPUB",
    exportHint: "生成后可通过 Send to Kindle 发送到 Kindle",
    formatNoticeTitle: "为什么暂不提供 AZW3？",
    formatNoticeBody:
      "浏览器直接生成的 AZW3 在部分 Kindle，尤其较旧机型上，可能出现打开卡死或封面不显示。为避免导出不可用的文件，目前仅提供兼容性更稳定的 EPUB。",
    chapters: "章节",
    afterTxt: "选好 TXT 后，章节会列在这里",
    chapterTitle: "章节标题",
    wordCount: "字数",
    chapterList: "章节列表",
    book: "书",
    noChapters: "还没有章节",
    chooseTxtFirst: "先选一个 TXT 文件。",
    edit: "改",
    editChapter: "修改“{title}”",
    excerpt: "正文片段",
    excerptTruncated: "……（预览已截断，导出内容不受影响）",
    emptyChapter: "本章暂无正文",
    selectChapter: "选择章节后显示正文片段",
    cropTitle: "调一下封面",
    cropDescription: "拖动图片，滑块控制大小。",
    closeCrop: "关闭封面裁剪",
    cropArea: "封面裁剪区域，可拖动或使用方向键调整",
    outputSize: "输出尺寸",
    zoom: "缩放",
    cropHelp: "手机上直接拖动。键盘可用方向键微调。",
    reset: "重置",
    cancel: "取消",
    applyCrop: "应用裁剪",
    localOnly: "文件只在当前浏览器中处理",
    selectedSummary: "已识别 {count} 章 · {rule}",
    loadedSummary: "{encoding} · 已载入",
    chapterStats: "{chapters} 章 · {characters} 字 · {encoding}",
    noExportableChapters: "没有可导出的章节。",
    chooseTxt: "请先选择 TXT 文件。",
    chooseTxtFormat: "请选择 TXT 格式文件。",
    readingTxt: "正在读取并分析章节…",
    readTxtFailed: "读取 TXT 失败。",
    reanalyzing: "正在重新分析章节…",
    splitFailed: "章节分析失败。",
    coverLoaded: "封面已载入，请拖动并裁剪为 Kindle 5:8 比例",
    epubPreparing: "正在转换封面并生成 EPUB…",
    epubDone: "EPUB 已生成 · {size} · 封面已转换为 Kindle JPEG",
    epubFailed: "EPUB 生成失败。",
    cropApplied: "封面裁剪已应用，导出时将生成 1600×2560 JPEG",
  },
  "zh-TW": {
    brandTagline: "TXT 轉 EPUB",
    privacy: "檔案不會上傳",
    language: "語言",
    githubFeedback: "在 GitHub 提交建議",
    introTitle: "把 TXT 整理成電子書",
    introDescription:
      "選檔案、檢查分章、補上書名與封面，再依閱讀方式匯出。",
    selectFile: "選檔案",
    encodingSupport: "支援 UTF-8、UTF-16、GBK",
    loaded: "已載入",
    dropTxt: "把 TXT 拖到這裡",
    orChoose: "或按「選擇」",
    choose: "選擇",
    replace: "更換",
    metadata: "書名與封面",
    optional: "不填也能匯出",
    customCoverPreview: "自訂封面預覽",
    untitled: "未命名書籍",
    anonymous: "佚名",
    chooseCover: "選擇封面",
    cropCover: "裁剪封面",
    defaultCover: "使用預設封面",
    coverHint: "支援 WebP，匯出為 1600×2560 JPEG",
    title: "書名",
    titlePlaceholder: "輸入書名",
    author: "作者",
    authorPlaceholder: "輸入作者",
    split: "分章",
    splitHint: "先用自動識別，不準再更換規則",
    splitMode: "識別方式",
    auto: "自動識別",
    chinese: "中文網文章節",
    english: "英文 Chapter / Section",
    custom: "自訂正則",
    chapterRegex: "章節正則",
    regexPlaceholder: "例如：^第.+章.*$",
    reanalyze: "重新分析章節",
    generating: "正在產生",
    exportEpub: "匯出 EPUB",
    exportHint: "產生後可透過 Send to Kindle 傳送至 Kindle",
    formatNoticeTitle: "為什麼暫不提供 AZW3？",
    formatNoticeBody:
      "瀏覽器直接產生的 AZW3 在部分 Kindle，尤其較舊機型上，可能無法開啟或不顯示封面。為避免匯出無法使用的檔案，目前僅提供相容性較穩定的 EPUB。",
    chapters: "章節",
    afterTxt: "選好 TXT 後，章節會列在這裡",
    chapterTitle: "章節標題",
    wordCount: "字數",
    chapterList: "章節列表",
    book: "書",
    noChapters: "還沒有章節",
    chooseTxtFirst: "請先選擇 TXT 檔案。",
    edit: "改",
    editChapter: "修改「{title}」",
    excerpt: "正文片段",
    excerptTruncated: "……（預覽已截斷，匯出內容不受影響）",
    emptyChapter: "本章暫無正文",
    selectChapter: "選擇章節後顯示正文片段",
    cropTitle: "調整封面",
    cropDescription: "拖動圖片，使用滑桿控制大小。",
    closeCrop: "關閉封面裁剪",
    cropArea: "封面裁剪區域，可拖動或使用方向鍵調整",
    outputSize: "輸出尺寸",
    zoom: "縮放",
    cropHelp: "手機可直接拖動，鍵盤可用方向鍵微調。",
    reset: "重設",
    cancel: "取消",
    applyCrop: "套用裁剪",
    localOnly: "檔案只在目前的瀏覽器中處理",
    selectedSummary: "已識別 {count} 章 · {rule}",
    loadedSummary: "{encoding} · 已載入",
    chapterStats: "{chapters} 章 · {characters} 字 · {encoding}",
    noExportableChapters: "沒有可匯出的章節。",
    chooseTxt: "請先選擇 TXT 檔案。",
    chooseTxtFormat: "請選擇 TXT 格式檔案。",
    readingTxt: "正在讀取並分析章節…",
    readTxtFailed: "讀取 TXT 失敗。",
    reanalyzing: "正在重新分析章節…",
    splitFailed: "章節分析失敗。",
    coverLoaded: "封面已載入，請拖動並裁剪為 Kindle 5:8 比例",
    epubPreparing: "正在轉換封面並產生 EPUB…",
    epubDone: "EPUB 已產生 · {size} · 封面已轉換為 Kindle JPEG",
    epubFailed: "EPUB 產生失敗。",
    cropApplied: "封面裁剪已套用，匯出時將產生 1600×2560 JPEG",
  },
  en: {
    brandTagline: "TXT to EPUB",
    privacy: "Files never leave your device",
    language: "Language",
    githubFeedback: "Share feedback on GitHub",
    introTitle: "Turn a TXT file into an ebook",
    introDescription:
      "Choose a file, review the chapters, add book details and export.",
    selectFile: "Choose a file",
    encodingSupport: "UTF-8, UTF-16 and GBK supported",
    loaded: "Loaded",
    dropTxt: "Drop a TXT file here",
    orChoose: "or click “Choose”",
    choose: "Choose",
    replace: "Replace",
    metadata: "Book details and cover",
    optional: "Everything here is optional",
    customCoverPreview: "Custom cover preview",
    untitled: "Untitled book",
    anonymous: "Unknown author",
    chooseCover: "Choose cover",
    cropCover: "Crop cover",
    defaultCover: "Use default cover",
    coverHint: "WebP supported; exported as 1600×2560 JPEG",
    title: "Title",
    titlePlaceholder: "Enter the book title",
    author: "Author",
    authorPlaceholder: "Enter the author",
    split: "Chapters",
    splitHint: "Start with auto detection and adjust only if needed",
    splitMode: "Detection method",
    auto: "Auto detect",
    chinese: "Chinese web novel",
    english: "English Chapter / Section",
    custom: "Custom regular expression",
    chapterRegex: "Chapter pattern",
    regexPlaceholder: "Example: ^Chapter\\s+\\d+.*$",
    reanalyze: "Analyze chapters again",
    generating: "Generating",
    exportEpub: "Export EPUB",
    exportHint: "Send the finished EPUB to Kindle with Send to Kindle",
    formatNoticeTitle: "Why is AZW3 unavailable?",
    formatNoticeBody:
      "AZW3 files generated directly in a browser may freeze or lose their cover on some Kindle devices, especially older models. To avoid unreliable downloads, this tool currently exports the more compatible EPUB format only.",
    chapters: "Chapters",
    afterTxt: "Your chapters will appear here after you choose a TXT file",
    chapterTitle: "Chapter title",
    wordCount: "Characters",
    chapterList: "Chapter list",
    book: "Book",
    noChapters: "No chapters yet",
    chooseTxtFirst: "Choose a TXT file to get started.",
    edit: "Edit",
    editChapter: "Edit “{title}”",
    excerpt: "Excerpt",
    excerptTruncated: "… (Preview shortened; the export remains complete.)",
    emptyChapter: "This chapter has no text",
    selectChapter: "Choose a chapter to preview it",
    cropTitle: "Adjust the cover",
    cropDescription: "Drag the image and use the slider to resize it.",
    closeCrop: "Close cover crop",
    cropArea: "Cover crop area; drag or use the arrow keys to adjust",
    outputSize: "Output size",
    zoom: "Zoom",
    cropHelp: "Drag on mobile, or use the arrow keys for fine adjustment.",
    reset: "Reset",
    cancel: "Cancel",
    applyCrop: "Apply crop",
    localOnly: "Files are processed only in this browser",
    selectedSummary: "Found {count} chapters · {rule}",
    loadedSummary: "{encoding} · Loaded",
    chapterStats:
      "{chapters} chapters · {characters} characters · {encoding}",
    noExportableChapters: "There are no chapters to export.",
    chooseTxt: "Choose a TXT file first.",
    chooseTxtFormat: "Choose a TXT file.",
    readingTxt: "Reading the file and detecting chapters…",
    readTxtFailed: "Could not read the TXT file.",
    reanalyzing: "Analyzing chapters again…",
    splitFailed: "Could not detect chapters.",
    coverLoaded: "Cover loaded. Drag and crop it to the Kindle 5:8 ratio.",
    epubPreparing: "Converting the cover and creating EPUB…",
    epubDone: "EPUB created · {size} · cover converted to Kindle JPEG",
    epubFailed: "Could not create EPUB.",
    cropApplied: "Cover crop applied; export will use a 1600×2560 JPEG",
  },
};

const ruleNames: Record<Locale, Record<string, string>> = {
  "zh-CN": {},
  "zh-TW": {
    中文标准章节: "中文標準章節",
    中文扩展章节: "中文擴展章節",
    数字序号章节: "數字序號章節",
    中文章节: "中文章節",
    自定义正则: "自訂正則",
    "未识别到目录，按约 10KB 自动分段":
      "未識別到目錄，依約 10KB 自動分段",
  },
  en: {
    中文标准章节: "Standard Chinese chapter pattern",
    中文扩展章节: "Extended Chinese chapter pattern",
    数字序号章节: "Numbered chapter pattern",
    "英文 Chapter / Section": "English Chapter / Section",
    中文章节: "Chinese chapter pattern",
    自定义正则: "Custom pattern",
    "未识别到目录，按约 10KB 自动分段":
      "No table of contents found; split into roughly 10 KB sections",
  },
};

const LOCALE_STORAGE_KEY = "yuedu-locale";

function storedLocale(): Locale | undefined {
  try {
    const locale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (locale === "zh-CN" || locale === "zh-TW" || locale === "en") {
      return locale;
    }
  } catch {
    // Browser privacy settings may make localStorage unavailable.
  }
  return undefined;
}

export function rememberLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The localized URL still preserves the user's choice.
  }
}

export function localeFromLanguages(
  languages: readonly string[] = navigator.languages?.length
    ? navigator.languages
    : [navigator.language],
): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase().replace("_", "-");
    if (
      normalized === "zh-tw" ||
      normalized === "zh-hk" ||
      normalized === "zh-mo" ||
      normalized.startsWith("zh-hant")
    ) {
      return "zh-TW";
    }
    if (normalized === "zh" || normalized.startsWith("zh-")) {
      return "zh-CN";
    }
    if (normalized === "en" || normalized.startsWith("en-")) {
      return "en";
    }
  }
  return DEFAULT_LOCALE;
}

export function localeFromPath(
  pathname = window.location.pathname,
  languages: readonly string[] = navigator.languages?.length
    ? navigator.languages
    : [navigator.language],
): Locale {
  if (/^\/zh-cn(?:\/|$)/i.test(pathname)) return "zh-CN";
  if (/^\/zh-tw(?:\/|$)/i.test(pathname)) return "zh-TW";
  if (/^\/en(?:\/|$)/i.test(pathname)) return "en";
  return storedLocale() ?? localeFromLanguages(languages);
}

export function message(
  locale: Locale,
  key: string,
  variables: Record<string, string | number> = {},
) {
  const template = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(variables[name] ?? `{${name}}`),
  );
}

export function localizeRule(locale: Locale, rule: string) {
  return ruleNames[locale][rule] ?? rule;
}
