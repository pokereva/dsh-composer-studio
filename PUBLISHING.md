# 发布指南 / Publishing

这份文档是给仓库作者看的，记录把 `dsh-composer-studio` 上传到 GitHub、可选地发到 npm 与插件市场的步骤。

## 0. 已完成的部分

- `LICENSE`（MIT，`Copyright (c) 2026 poker`）
- `.gitignore`（`node_modules/`、`*.log`、`*.tgz` 等）
- `package.json` 的 `license` / `keywords` / `repository` / `homepage` / `bugs` / `scripts` 字段
- 本地 git 仓库已初始化（分支 `main`），两条提交：

```
dd99a4b docs: MIT license, npm metadata, and click-only wording
1fa0060 feat: composer keys — Enter inserts a line break, sending is click-only
```

## 1. 先把占位符换掉

`package.json` 里有三处 `YOUR_GITHUB_USER`，替换成你的 GitHub 用户名（假设是 `poker`，仓库名 `dsh-composer-studio`）：

```bash
cd output/dsh-composer-studio
sed -i 's/YOUR_GITHUB_USER/poker/g' package.json
```

`LICENSE` 里的 `poker` 也确认一下是不是你要署的名字。

## 2. 在 GitHub 上建空仓库

网页操作：<https://github.com/new>

- Repository name: `dsh-composer-studio`
- Visibility: **Public**
- **不要**勾选 Add a README / .gitignore / license（本地已经有了，勾了会冲突）

## 3. 认证（这台机器目前没有任何凭据）

```bash
git config --global credential.helper           # 空 → 未配置
ls ~/.ssh                                        # 只有 known_hosts，没有私钥
env | grep -iE '^(GH_|GITHUB_)'                  # 空 → 没有令牌
gh --version                                     # command not found → 没有 gh CLI
```

二选一：

### 方案 A：HTTPS + Personal Access Token（最快）

1. <https://github.com/settings/tokens> → *Generate new token (classic)*
2. 只勾 `repo` 权限，有效期按需
3. 复制令牌，push 时把令牌当密码：

```bash
git remote add origin https://github.com/poker/dsh-composer-studio.git
git push -u origin main
# Username: poker
# Password: <粘贴 PAT，不是账号密码>
```

想让它记住：

```bash
git config --global credential.helper manager
```

### 方案 B：SSH key

```bash
ssh-keygen -t ed25519 -C "pokereva@163.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub          # 整段贴到 https://github.com/settings/keys
ssh -T git@github.com              # 出现 "Hi <user>!" 即成功

git remote add origin git@github.com:poker/dsh-composer-studio.git
git push -u origin main
```

## 4. 推送

```bash
cd output/dsh-composer-studio
git remote add origin <上一步的地址>
git push -u origin main
```

## 5. 打一个 Release（可选但推荐）

插件市场与 `dsh plugin add` 都支持直接装 tgz：

```bash
npm pack                            # 产出 dsh-composer-studio-2.0.0.tgz
```

把 tgz 传到 <https://github.com/poker/dsh-composer-studio/releases/new>，tag 写 `v2.0.0`。别人就能这样装：

```bash
dsh plugin --profile <profile> add https://github.com/poker/dsh-composer-studio/releases/download/v2.0.0/dsh-composer-studio-2.0.0.tgz
```

或直接从源码装：

```bash
dsh plugin --profile <profile> add github:poker/dsh-composer-studio
```

## 6. 发 npm（可选）

需要先解决作用域：`@local/*` 只在本机有意义，发布前把包名改成 `dsh-composer-studio` 或 `@你的用户名/dsh-composer-studio`，并同步改三处引用：

- `package.json` 的 `name`
- `cordis.patch.yml` 的 `name:`
- profile 的 `dsh.profile.bundles`

然后：

```bash
npm login
npm publish --access public
```

## 7. 进插件市场索引（可选）

生态里有几个自动抓取 `dsh-plugin` 话题的目录，例如：

- <https://github.com/like-study1/Oh-My-DSH>
- <https://github.com/leenkcool/Blue-Whale-Harness>

它们的共同做法是扫描 GitHub 上带 `dsh-plugin` topic 的仓库，所以只要：

1. 仓库 About 里加上 topic：`dsh-plugin`、`deepseek`、`harness`
2. README 开头写清楚插件做什么

就会被自动收录，不用手动提交 PR。

## 8. 发布前自检

```bash
node --check client.js        # 语法
node test/harness.cjs         # 11/11 passed
npm pack --dry-run            # 确认打包内容只含 index.js/client.js/patch/locale/icon
git status                    # 工作区干净
```
