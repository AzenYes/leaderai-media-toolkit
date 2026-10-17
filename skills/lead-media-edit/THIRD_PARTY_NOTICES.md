# 第三方资源与依赖

本仓库的 MIT 许可覆盖项目原创部分。下列第三方内容保留其原有许可。

## 随仓库分发：world-atlas 地图数据

- 文件：`motion-template/examples/格陵兰没那么大/world.json`
- 来源：[world-atlas 2 / countries-50m.json](https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json)
- 上游：[topojson/world-atlas](https://github.com/topojson/world-atlas)
- 许可：[ISC](https://github.com/topojson/world-atlas/blob/master/LICENSE)
- 发布时已核对随附数据与上述 `countries-50m.json` 的 JSON 内容一致。

上游许可原文：

```text
Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## 随仓库分发：完整字体

字体位于 `assets/fonts/`。此目录随剪辑 skill 一起安装，含 11 个完整字体文件，未进行子集化：

| 字体 | 文件 | 上游 | 随附完整许可 |
| --- | --- | --- | --- |
| IBM Plex Sans SC | Thin、ExtraLight、Light、Regular、Text、Medium、SemiBold、Bold（8 个 OTF） | [IBM/plex](https://github.com/IBM/plex) | [OFL-IBM-Plex.txt](assets/fonts/OFL-IBM-Plex.txt) |
| Inter | Medium、SemiBold（2 个 TTF） | [rsms/inter](https://github.com/rsms/inter) | [OFL-Inter.txt](assets/fonts/OFL-Inter.txt) |
| Noto Serif SC | NotoSerifSC-VF.ttf（1 个可变 TTF） | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | [OFL-Noto-Serif.txt](assets/fonts/OFL-Noto-Serif.txt) |

以上字体采用 SIL Open Font License 1.1，不适用本项目 MIT。完整许可文件包含字体内部的版权声明及上游许可原文。再分发字体或子集时保留对应许可与版权声明，并遵守 Reserved Font Name 条件。

## 运行时另行安装或获取

- [Remotion](https://www.remotion.dev/docs/license)：按上游许可及适用商业条款使用。
- [FFmpeg](https://ffmpeg.org/legal.html)：按实际使用构建及编解码器的许可使用。
- Python 和 npm 依赖：按其各自发布包中的许可证使用。

这些依赖不因被工具包引用而改为 MIT。
