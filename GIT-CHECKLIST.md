# Git 上手清单 · 阅读的海洋（The sea of reading）

> 面向 Git 初学者。每条都写明：**在哪执行 → 做什么 → 成功看到什么**。
> 项目目录（下面所有命令都在这里执行）：
> `C:\Users\张俊\WorkBuddy\my-project\The sea of reading`

---

## 一、环境检查结果（已完成）

| 项目 | 状态 |
|---|---|
| Git | ✅ 2.55.0.windows.3（`C:\Program Files\Git\`） |
| Node.js | ✅ v22.22.2 |
| npm | ✅ 10.9.7 |
| Python | ✅ 3.13.14 |
| 本地仓库 | ✅ 已初始化，分支 `main` |
| 远程仓库 origin | ✅ 已指向 `git@github.com:XingHo-VibeCoding/The-sea-of-reading.git`（SSH 方式，自动走 443 端口） |
| 提交身份 | ✅ `张俊 <1145282165@qq.com>` |
| `.gitignore` | ✅ 已就绪，规则已实测生效 |
| 首次提交 | ✅ 已完成（commit `db0de6d`） |
| 推送 | ✅ 已完成，2 个提交（`db0de6d`、`bfd7ddd`），本地与远端一致 |

> **实际采用的是方案 B（SSH）。** 下面两套方案都保留作为学习材料，
> 但你机器上已经配好了 SSH，日常直接用「第五节·每天三连」即可。

**结论：不需要安装任何东西。** 工具全部齐备，没有"缺失项"。

### ⚠️ 唯一的坑：一个软件在拦截你的 HTTPS

诊断过程：GitHub 的 TLS 证书，实际颁发者不是 DigiCert，而是
`CN=SteamTools Certificate, OU=Technical Department, O=BeyondDimension, C=CN`。

这是电脑上正在运行的 **Watt Toolkit（Steam++ v3.1.2025.0）** 干的——它的 `Steam++.Accelerator`
进程会对 github.com 做"加速代理"，即用自签证书接管连接。Windows 不信这套证书，于是报错：

```
schannel: next InitializeSecurityContext failed:
CRYPT_E_NO_REVOCATION_CHECK (0x80092012) - 吊销功能无法检查证书是否吊销
```

顺带查明：默认 SSH 22 端口被网络拒绝（校园网 DNS 是 `wuhee.whu.edu.cn`），但 **SSH 443 端口可用**。

---

## 二、推送方式（已采用方案 B / SSH，本节保留作学习材料）

### 方案 A：HTTPS（推荐，最简单）

**第 0 步 · 先关掉 Watt Toolkit**

| | |
|---|---|
| 在哪 | 屏幕右下角托盘区 |
| 做什么 | 找到 Watt Toolkit / Steam++ 图标 → 右键 → **退出**。必要时用任务管理器结束 `Steam++.Accelerator` |
| 成功看到什么 | 托盘里那个图标消失了 |

> 不关它就往下推，会一直卡在上面那个 `CRYPT_E_NO_REVOCATION_CHECK` 报错。

**第 1 步 · 推送**

```bash
cd "C:/Users/张俊/WorkBuddy/my-project/The sea of reading"
git push -u origin main
```

| | |
|---|---|
| 命令做什么 | `-u` 把本地 `main` 和远端 `main` 绑定，以后只需 `git push`；`-u` 只需用这一次 |
| 成功看到什么 | 弹出 GitHub 登录窗口 → 用浏览器登录后授权。接着终端输出类似：<br>`Enumerating objects: 4, done.`<br>`Writing objects: 100% (4/4), done.`<br>`To https://github.com/XingHo-VibeCoding/The-sea-of-reading.git`<br>` * [new branch]      main -> main` |

看到 `* [new branch] main -> main` 就是成功了。

---

### 方案 B：SSH（不想关 Watt Toolkit 就走这条）

**第 1 步 · 复制公钥**

```bash
cat ~/.ssh/id_ed25519.pub
```

输出一整行，从 `ssh-ed25519` 一直到结尾，全选复制。

**第 2 步 · 加到 GitHub**

| | |
|---|---|
| 在哪 | 浏览器 → github.com 右上角头像 → **Settings** → 左侧 **SSH and GPG keys** → **New SSH key** |
| 做什么 | Title 填 `我的笔记本`，Key 粘贴刚才那行，保存 |
| 成功看到什么 | 密钥列表里出现一条，指纹为<br>`SHA256:WKyqAf8+k5Hw4KC0pyY4Zricq42GvrUoUlvTNQNpxHc` |

**第 3 步 · 把 22 端口换成 443**（22 被网络挡了，443 实测通）

```bash
git remote set-url origin ssh://git@ssh.github.com:443/XingHo-VibeCoding/The-sea-of-reading.git
```

| | |
|---|---|
| 成功看到什么 | 无输出。用 `git remote -v` 确认，应显示两条 `ssh://git@ssh.github.com:443/...` |

**第 4 步 · 验证 SSH 通了**

```bash
ssh -T -p 443 git@ssh.github.com
```

看到 `Hi XingHo-VibeCoding! You've successfully authenticated, but GitHub does not provide shell access.` 就对了。

> 若还提示 `Permission denied (publickey)`，说明第 1~2 步的公钥没贴对，回去重来。

**第 5 步 · 推送**

```bash
git push -u origin main
```

成功输出同方案 A。

---

## 三、验证：确认敏感文件没上去

浏览器打开 `https://github.com/XingHo-VibeCoding/The-sea-of-reading`，确认：

- [x] 能看到 **`README.md`**、**`.gitignore`**、**`GIT-CHECKLIST.md`** 三个文件
- [x] 右上角显示分支 **`main`**、提交数 **2 Commits**
- [x] **看不到** `.env` / `secrets.json` / `*.key` / `*.db` / `node_modules/` 任何一样

命令行也能自查（比网页更可靠）：

```bash
git ls-files                      # 列出所有被跟踪的文件，应该只有 3 个
git check-ignore -v .env app.db   # 显示"是哪条规则把它挡住的"
```

---

## 四、`.gitignore` 已经挡住了什么

已按你的要求覆盖，并且**逐条实测过**——故意造了 8 个敏感文件，Git 一个都没看见：

- **环境变量**：`.env`、`.env.*`（保留 `!.env.example` 模板）
- **密钥 / 证书**：`*.pem` `*.key` `*.p12` `*.pfx` `*.keystore` `*secret*` `*credential*` `id_rsa` `id_ed25519` `*.token` `*.apikey`、`serviceAccount*.json`
- **含令牌的配置**：`.npmrc` `.pnpmrc` `.yarnrc.yml` `.pip.conf` `.gem/credentials`
- **依赖目录**：`node_modules/` `venv/` `.venv/` `__pycache__/` `site-packages/`
- **本地数据库**：`*.db` `*.sqlite*` `*.mdb` `*.accdb` `*.realm` `dump.rdb` `*.bak`，**含 SQLite 的 `-wal` / `-shm` 伴生文件**
- **其他**：`.prod.js` `.local.json` 等可能带密钥的命名变体、构建产物、日志、`.vercel` `.turbo`、编辑器与系统垃圾文件

### 两条规则有点"狠"，留意别误伤

`*.prod.js` 和 `*.local.json` 为了保险起见写得很宽。如果你以后有**真的要提交**的同名文件，
用强制添加，或把规则改窄：

```bash
git add -f src/config.prod.js     # 绕过忽略规则，强制加入
```

---

## 五、以后每天就这三连

```bash
git add .                              # 把改动放进暂存区
git commit -m "说明你改了什么"           # 存成一版快照
git push                               # 推到 GitHub
```

中间随时 `git status` 看当前状态，`git log --oneline` 看历史。

### 后悔药

```bash
git reset --soft HEAD~1    # 撤销最后一次 commit，改动内容还在
git restore --staged .     # 把暂存区的东西退回来（还没 commit 时用）
```

---

## 六、问答

**Q：提交时看到 `LF will be replaced by CRLF` 警告，是不是出问题了？**
A：不是。你开了 `core.autocrlf=true`（Windows 上的标准做法），Git 在自动统一换行符，正常现象。

**Q：我就是不想关 Watt Toolkit，有办法吗？**
A：有，但**不推荐长期用**——这条命令关掉证书校验，会让你对所有中间人攻击敞开大门：

```bash
GIT_SSL_NO_VERIFY=1 git push -u origin main
```

只作为临时救急。长期还是建议：推 GitHub 时关掉 Watt Toolkit，或者干脆走方案 B 的 SSH。

**Q：SSH 以后还要再配一次吗？**
A：不用，一次配好长期有效。现状：
- 公钥已登记到 GitHub 个人账号 **`ZJ431`**（不是组织账号 `XingHo-VibeCoding`，组织账号存不了个人 SSH 公钥）；
- `~/.ssh/config` 里已配好 `github.com → ssh.github.com:443` 转发（校园网封了 22 端口，必须走 443）；
- 远程地址已切成 `git@github.com:...`，**Watt Toolkit 开着也不影响推送**，不用再关它。

**Q：`.env.example` 是什么？**
A：给队友看的"配置模板"，只写键名不写真值（`DB_HOST=`、`API_KEY=`），可以放心提交；
真正的 `.env` 被忽略。将来要用了自己新建。
