# Tminihu 站点 1:1 复刻

源站：<https://tminihu.cloud/>（个人 AI 课程主页）
复刻范围：**首页全部区块 + 全部交互**，纯静态、无构建步骤。

## 运行

直接双击 `index.html` 即可，或起一个本地静态服务（推荐，字体/缓存行为更接近线上）：

```bash
# 方式一
python -m http.server 4173
# 方式二
npx serve .
```

然后访问 <http://127.0.0.1:4173/>。

## 目录结构

```
tminihu-clone/
├── index.html          # 页面结构（与源站同结构、同类名、真实文案）
├── css/
│   ├── main.css        # 设计令牌 + 全部组件 + 响应式 + 减弱动效
│   └── syllabus.css    # 课程大纲区（.syl-*）
├── js/
│   ├── main.js         # 全部交互（原生 JS，约 700 行，逐段注释）
│   └── vendor/         # gsap.min.js / ScrollTrigger.min.js（本地托管）
├── fonts/
│   ├── fonts.css       # @font-face（按页面字符子集生成）
│   └── *.woff2         # 29 个字体文件，共 1.7 MB
├── assets/             # 真实站点图片（头像、证书、教学现场、二维码）
└── docs/research/tminihu/  # 抓取留档：源 HTML/CSS/JS、截图、抓图脚本
```

## 源站 → 本地映射

| 源站 | 本地 |
| --- | --- |
| `https://tminihu.cloud/` | `index.html` |
| `/assets/interactions-Do64XS_A.css` | `css/main.css` |
| `/assets/main-Cih-ZuUy.css` | `css/syllabus.css` |
| `/assets/main-ChHpFIqg.js` + `interactions-*.js` | `js/main.js`（重写） |
| Google Fonts CDN | `fonts/`（按页面字符子集自托管） |
| `/user.jpg` `/certificate.jpg` `/qr-*.png` `/teaching-*.jpg` `/2026*.jpg` | `assets/` 同名 |

## 已复刻的交互

1. 深/浅色主题切换（`localStorage` 记忆）
2. 顶栏滚动态 + 顶部渐变滚动进度条
3. 锚点平滑滚动
4. 鼠标追光（跟随 + 随滚动衰减）
5. 神经网络 Canvas 背景（漂移、鼠标引力、点击涟漪、滚动视差、随主题换色、离屏暂停）
6. 磁吸按钮（`.magnetic`）
7. 名片卡 3D 倾斜
8. 课程卡 / 能力卡 hover 追光（`--sx/--sy`）
9. 导航当前区块高亮
10. Hero 入场时间线（逐行上移 → 副标题 → 标签条）
11. 全站滚动揭示动画（进入播放、回滚反向）
12. 成长轨迹左侧标题 pin
13. 技术栈 chips 交错入场
14. 数字统计滚动计数
15. 证书灯箱（点击/Esc 关闭）
16. 教学现场相册灯箱（前后切换、方向键、触摸滑动、计数）
17. 微信号复制（含降级方案）
18. 大纲三标签页（含方向键/Home/End 键盘操作）
19. Hero "Enter" 提示离屏淡出
20. `prefers-reduced-motion` 全量降级

## 验证记录

- 桌面 1440×1000、移动 390×844：两站 `scrollHeight` 完全一致（13339 / 20451px），10 个区块的滚动锚点逐像素对齐。
- 首屏、关于、课程、大纲、路线、教学现场、统计、轨迹、认证、联系 逐区块截图比对，画面一致；教学现场/轨迹/认证/联系四张截图与源站文件内容相同。
- 浅色主题首屏一致。
- 交互实测通过：标签页切换、相册灯箱（计数 3/6、标题正确）、证书灯箱、复制按钮（"已复制!"）、主题切换 + 持久化。
- 控制台无 JS 报错，无横向溢出。

## 已知差异

1. **子页面未克隆**：`agent-guide.html`（27 章使用手册，约 8.7 万字）与 `roadmap.html` 仍指向源站，主页中相关链接已保留 `target="_blank"`。
2. 关于区名片卡高度比源站 ±0（实测一致），但字体度量在极端窗口下可能有 ±1px 级差异。
3. 移动端布局视口最小宽度 410px（源站同样如此，非本次引入）。
4. 字体为**按当前页面文案**生成的子集：若后续新增生僻字，会回落到系统字体。需要扩充时重新跑 `docs/research/tminihu/fetch-fonts.js`。

## 合规说明

仅用于学习与设计拆解（视觉/交互重建），页面内容、照片、二维码及个人联系方式版权归原站作者所有，请勿用于上线冒名或商业用途。
