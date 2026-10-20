# 内置 BGM（配套包，不随 skill 分发）

曲子是一个**单独的配套包**：「Claude 小曲（长版）」，177.5 秒，约 112.7 BPM。skill 本身不含音频，这里只有 `music.json`（文件名、sha256、可选下载地址）和 `scripts/bgm.py`（检测 / 安装 / 下载）。

## 取曲逻辑（给 Claude 看）

1. 先跑 `python <skill>/scripts/bgm.py --check`。
2. `available: false` → **不要向用户提这首曲子**，按“用户没提音乐”的常规流程走（问用户有没有想用的曲子 / 只用音效 / 用 `sfx.py --bed` 垫底）。
3. `available: true` 且用户没指定音乐 → 先问用户是否使用；用户指定了别的曲子 → 只用用户的。
4. `music.json` 里 `url` 非空、本机没有时，用户想用的话可跑 `bgm.py --fetch` 下载（会校验 sha256）。

## 用户怎么装配套包

拿到配套包（zip 或文件夹）后：

```bash
python <skill>/scripts/bgm.py --install <配套包.zip 或文件夹>
```

会装到 `~/.claude/skill-data/Lead-知识讲解动画/music/`（skill 升级时不会丢）。也可以手动把 mp3 和 beats.json 放进本目录。

## 曲子信息（装好后）

- 节拍表随配套包提供；drop 候选 ≈ 17.0 / 93.5 / 160.0 秒（用耳朵核对）。开头 17 秒前适合冷开场 + 金句，17 秒的 drop 留给片名卡或第一个大转场。
- 音量偏满（峰值 0 dB，均值约 -9.5 dB）：`--music-db -6` 起步，重音处用 `--music-dips` 压一下。
- 曲长 177.5 秒，`mix.py` 不循环；成片 >170 秒时结尾没有音乐，要告诉用户。

```bash
python <skill>/scripts/timeline.py work/lines.json --film film/ --beats <bgm.py --check 输出的 beats 路径>
python <skill>/scripts/mix.py --cues work/cues.json --sfx-dir work/sfx --duration <总秒数> --out work/mix.wav \
       --music <bgm.py --check 输出的 mp3 路径> --music-db -6
```

交付说明里写明“BGM：Claude 小曲（配套包）”。
