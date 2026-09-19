# 阅读的海洋 · The sea of reading

> 一个帮你管好自己阅读记录的地方 —— 让你遨游在书籍的海洋里。

## 这是什么

一个纯前端的个人网站项目，用来存放自己的书单、阅读进度和读书笔记。

**它不提供任何书籍正文，也不做社交。** 只记录你自己产生的阅读数据。这条边界是经过需求研究后确定的，理由见 [`docs/research.md`](docs/research.md)。

项目目前处于**学习期**：一边按日程学 Git 和前端，一边把学到的东西落进这个仓库。所以现在打开它只会看到一个占位页——这是正常的，功能会一天天长出来。

## 功能

以下都是**计划中**，尚未实现（本期范围）：

- [ ] 书单管理 —— 想读 / 在读 / 已读三态标记
- [ ] 阅读进度 —— 记下每次读到哪一页
- [ ] 读书笔记 —— 摘抄、随想、按书归档
- [ ] 阅读统计 —— 已读数量、月度阅读量

**本期不做**：提供书籍正文、阅读器、社交功能、付费订阅、爬取第三方书籍数据、移动 App。完整清单和理由见 [`docs/research.md` 第 6 节](docs/research.md)。

已完成的部分见下方「当前进度」。

## 当前进度

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| Day 1 | 环境检查、本地仓库初始化、忽略规则配置 | 已完成 |
| Day 2 | 连接 GitHub、首次提交、`index.html` 占位页上线 | 已完成 |
| Day 3 | 需求研究（`docs/research.md`），确定产品边界 | 已完成 |
| Day 4 | PRD（`docs/PRD.md`） | 未开始 |
| Day 7 | MVP 页面 | 未开始 |
| Day 23 | 接入数据库配置（`.env` 届时才会用到） | 未开始 |

每日的完成情况记录在 [`journal/`](journal/) 目录下。

## 本地运行

纯静态页面，**没有任何依赖，也不需要构建工具**。

最简单的方式：直接双击 `index.html`，用浏览器打开。

如果想用本地服务（更接近线上环境）：

```bash
python -m http.server 8000
```

然后浏览器访问 <http://localhost:8000>。

也可以用 `npx serve`，但它需要联网下载工具，校园网环境下不一定顺利——上面的 Python 方式无需联网。

> 提示：本地的数据库文件、环境配置不会进仓库，已被 `.gitignore` 挡住。

## 目录结构

```
The sea of reading/
├── index.html          # 项目首页（Day 2 占位页）
├── README.md           # 本文件
├── .gitignore          # 敏感文件与依赖的忽略规则
├── GIT-CHECKLIST.md    # Git 上手清单：环境诊断、推送方案、日常命令
├── docs/               # 项目文档
│   └── research.md     # 需求研究（Day 3）：三个对标产品 + 本期不做清单
└── journal/            # 每日学习打卡日志
    ├── Day-02.md
    ├── Day-03.md
    └── assets/
        ├── Day-02-repo-home.png
        ├── Day-03-research-compare.jpg
        └── Day-03-research-not-doing.png
```

## 技术栈

目前只有原生三件套，**刻意不引入框架和外部 CDN**（校园网 + 代理环境下，外部资源不可靠）：

- **HTML + CSS** —— 全部写在 `index.html` 里，零外部依赖
- **JavaScript** —— 还没用上，Day 7 做 MVP 时开始

工程方面：

- 版本控制用 **Git**，托管在 **GitHub**
- 推送走 **SSH over 443**（校园网封了 22 端口，已在 `~/.ssh/config` 配好转发）

## 作者

张俊

- 个人账号：[@ZJ431](https://github.com/ZJ431)
- 组织：[XingHo-VibeCoding](https://github.com/XingHo-VibeCoding)
