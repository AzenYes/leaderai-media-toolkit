import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(8);
// 本机已有 headless shell 时直接复用（避免下载卡住）；不存在时由 Remotion 自行下载
import fs from "fs";
import os from "os";
import path from "path";
const localShell = path.join(os.homedir(), ".cache/puppeteer/chrome-headless-shell/win64-142.0.7444.175/chrome-headless-shell-win64/chrome-headless-shell.exe");
if (fs.existsSync(localShell)) Config.setBrowserExecutable(localShell);
