# Source and design notice

The TXT chapter-detection rules, automatic rule-selection approach, and
fallback splitting strategy in YueDu Book Maker were informed by
[gedoor/legado](https://github.com/gedoor/legado), licensed under the GNU
General Public License v3.0.

Relevant upstream files:

- `app/src/main/java/io/legado/app/model/localBook/TextFile.kt`
- `app/src/main/assets/defaultData/txtTocRule.json`
- `app/src/main/java/io/legado/app/service/ExportBookService.kt`

YueDu Book Maker does not link against Legado's Android code or Java EPUB
libraries. Its browser interface, text reader, cover processor, and EPUB writer
are implemented in this project.

The complete project is distributed under the GNU General Public License v3.0.
