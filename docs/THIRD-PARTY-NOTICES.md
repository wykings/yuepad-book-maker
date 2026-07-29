# Third-party open-source notices

## epub-to-kindle

The KF8/AZW3 binary writer in YueDu Book Maker is based on modifications to
[Ken-B/epub-to-kindle](https://github.com/Ken-B/epub-to-kindle).

- Upstream copyright: Copyright (C) 2026 Ken-B contributors
- Upstream license: GNU General Public License v3.0
- Modification date: 2026-07-28
- Modifications: extracted the KF8 writer into a standalone browser module;
  changed its input to YueDu Book Maker chapters, metadata, and JPEG covers;
  removed general-purpose EPUB parsing and MOBI6 output; added Web Worker
  execution, Chinese typography, and output validation.

The implementation also follows the Calibre MOBI/KF8 writer references noted by
the upstream project.

The complete project continues to be distributed under the GNU General Public
License v3.0. See [LICENSE](../LICENSE) for the full license text.
