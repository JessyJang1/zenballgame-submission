# 施主请接球

《施主请接球》是改编自原创《我佛持拍》的 3D 网球解谜游戏。玩家追着一颗球闯入画中球场，打中莲心、击钟开门，再与墨影对拉，打出一条通往月台的山路。

- [试玩](https://zenballgame.jessyjang.com/)
- [参赛报告与 Aholo 资产库](https://zenballgame.jessyjang.com/report/)
- [带原声的完整通关演示](https://zenballgame.jessyjang.com/report/demo.mp4)

这是面向评审的游戏源码快照，对应线上候选入口 `index-Ib5NBvET.js`。包含游戏源码、回归测试、依赖锁文件和游戏实际使用的资源。

## 本地运行

使用 Node.js 24.x。在项目目录执行以下命令。

```sh
npm ci
npm run dev
```

打开 Vite 输出的本地网址，移动鼠标瞄准，按空格发球和挥拍。

```sh
npm test
npm run build
npm run preview
```

## Aholo Lux3D 的应用

| 资产 | Aholo 任务 | 在游戏里的作用 |
| --- | --- | --- |
| 唤山门石 | 8295863 | 第一拍击中后下沉，打开进山的路 |
| 莲瓣 | 8295893 生成，8390162 优化 | 球碰到花瓣才开莲，露出可击打的石钟 |
| 石钟 | 8211698 | 打中钟身才开山门 |
| 云径双山纹 | 8391653 | 两道山纹依次点亮，山路才展开 |
| 月门 | 8391649 | 球穿过实体孔道才升空成月 |
| 山门青瓦 | 8295884 | 提供球庭的建筑地标 |

更多实机图、任务记录及 Aholo Viewer 莲瓣对照见[参赛报告](https://zenballgame.jessyjang.com/report/#assets)。

本快照供参赛评审核验。仓库未授予项目原创代码、图像、声音与模型的通用开源许可。第三方资源见[来源说明](THIRD_PARTY_NOTICES.md)。
