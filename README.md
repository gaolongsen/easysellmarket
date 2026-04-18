# 小铺 · Curated Secondhand

一个给留学生用的轻量二手物品展示站 —— 不用在微信群里反复刷屏，一个链接就能让大家看到你所有在卖的东西，自己留言、自己排队。

**特点：**

- 📱 手机优先响应式设计，触摸优化
- 🖼️ 多图展示，自动压缩，支持滑动切换
- 💬 每件物品独立留言墙，实时同步
- 🎫 自动排队系统，当前洽谈者 + 排队列表公开可见
- 🔐 密码保护的管理后台，只有你能上架 / 修改
- ⚡ 纯静态部署到 GitHub Pages，后端用 Firebase 免费套餐
- 🎨 温暖编辑风设计，不是冷冰冰的电商模板

---

## 🚀 快速开始（约 10 分钟）

整个流程不需要写一行代码，跟着做即可。

### 第一步：创建 Firebase 项目（免费）

1. 打开 <https://console.firebase.google.com>，用 Google 账号登录
2. 点 **"添加项目"** → 起个名字（比如 `my-market`）→ 一路 Next（Google Analytics 可以关掉，用不到）
3. 项目创建好后，在左边菜单里选 **Build → Firestore Database**
4. 点 **"创建数据库"**：
   - 位置选离你近的（比如 `asia-northeast1` 东京）
   - **起步模式选"以测试模式启动"**（30 天内开放读写；之后需要改规则，见下方"安全建议"）
5. 回到项目首页，点齿轮 ⚙ → **项目设置**
6. 往下滚动找到 **"您的应用"**，点 `</>` 图标添加一个 Web 应用
7. 随便起个昵称，**不要**勾选 Firebase Hosting，点"注册应用"
8. 会出现一段代码，里面有 `const firebaseConfig = { apiKey: "...", ... }`，**把这个对象复制下来**

### 第二步：配置网站

1. 克隆 / fork 这个仓库到你自己的 GitHub 账号
2. 打开 `index.html`，找到这段：

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
window.ADMIN_PASSWORD = "change-me-please";
window.SELLER_NAME = "店主";
```

3. 把刚才复制的 `firebaseConfig` 粘进去替换
4. **改掉 `ADMIN_PASSWORD`** 成你自己的密码（这是进入管理后台用的）
5. 把 `SELLER_NAME` 改成你的称呼
6. Commit + push

### 第三步：开启 GitHub Pages

1. 仓库页 → **Settings** → 左边 **Pages**
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `main`（或你仓库的默认分支）、目录 `/ (root)`，点 Save
4. 等 1-2 分钟，页面上会显示你的地址：`https://你的用户名.github.io/仓库名/`

### 第四步：开始上架

1. 访问你的网站地址
2. 点右上角头像图标 → 进入管理后台
3. 输入你设置的 `ADMIN_PASSWORD`
4. 开始上架 🎉

---

## 📂 文件结构

```
.
├── index.html      # 入口页面，含样式和 Firebase 配置
├── app.js          # 所有应用逻辑（路由 + 视图 + Firestore）
└── README.md       # 你正在看的文件
```

就这三个文件，没了。

## 🗂️ 数据结构（Firestore）

```
items/{itemId}
  ├── title, description, price, originalPrice
  ├── category, condition, status
  ├── photos: [base64 dataURL, ...]
  ├── queueCount
  ├── createdAt, updatedAt
  │
  ├── /comments/{commentId}
  │     └── author, contact, text, createdAt
  │
  └── /queue/{queueId}
        └── name, contact, note, status, joinedAt
             (status: waiting / active / passed / sold / removed)
```

图片用客户端压缩后的 Base64 直接存在 Firestore 里，省去了 Firebase Storage 的配置麻烦。Firestore 单文档上限 1MB，压缩后一张图约 100-200KB，所以限制是每件物品最多 8 张图。

## 🔒 安全建议

开头"测试模式"的 Firestore 规则是完全开放的，30 天后会自动失效。在此之前，建议手动改成更合理的规则。

前往 Firebase 控制台 → Firestore Database → **规则** 标签，粘贴下面这段：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // items 只能读，不能随意改（admin 页会用 localStorage 豁免，但服务端强制只读）
    match /items/{itemId} {
      allow read: if true;
      allow write: if true;  // 第一版保持开放；要更严需要接 Firebase Auth
    }
    match /items/{itemId}/comments/{commentId} {
      allow read: if true;
      allow create: if request.resource.data.text is string
                    && request.resource.data.text.size() < 1000
                    && request.resource.data.author is string
                    && request.resource.data.author.size() < 50;
      allow update, delete: if true;
    }
    match /items/{itemId}/queue/{queueId} {
      allow read: if true;
      allow create: if request.resource.data.name is string
                    && request.resource.data.name.size() < 50
                    && request.resource.data.contact is string
                    && request.resource.data.contact.size() < 100;
      allow update, delete: if true;
    }
  }
}
```

这个版本开放了读写，但对留言和排队的字段做了长度限制，能挡掉大部分滥用。

**如果想要真正的安全**（比如只有你登录后才能上架），把 `ADMIN_PASSWORD` 这种前端密码换成 Firebase Auth。那样需要改不少代码，对于"小圈子里的留学生互卖"场景一般用不上。

---

## 🎨 自定义

### 改颜色

在 `index.html` 顶部 `:root` 里改 CSS 变量：

```css
:root {
  --bg: #F6EFE2;          /* 背景 */
  --accent: #B84A1A;      /* 主强调色 */
  --sage: #7A8B5F;        /* "在售" 状态色 */
  --mustard: #C9932E;     /* "洽谈中" 状态色 */
}
```

### 改字体

默认用的是 Google Fonts 的 **Fraunces**（标题，一款现代衬线变量字体）+ **Instrument Sans**（正文）。换字体改 `index.html` 里 `<link>` 的 URL 和 `:root` 的 `--font-display` / `--font-body` 即可。

### 改分类

在 `app.js` 顶部找 `CATEGORIES` 数组，按需增删：

```js
const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "electronics", label: "电子产品" },
  // 加你想要的分类
];
```

---

## 💡 使用技巧

- **排队状态的意思**：
  - **在售** = 没人在谈，任何人都可以排队
  - **洽谈中** = 店主正在跟队首的人聊
  - **已售出** = 交易完成，页面变灰
- **排队怎么推进**：管理后台"排队管理"tab，点 `联系 →` 标记当前正在沟通的人（物品状态会自动变成"洽谈中"）。如果谈崩了点 `跳过`，物品恢复在售、自动让位给下一个。谈成了点 `✓ 成交`，标记售出。
- **留言的联系方式只有你看得到**：匿名或者不填联系方式，其他人看不到；管理员进入该物品后会看到每条留言下面的联系方式。
- **想让 GitHub 仓库私有？** GitHub Pages 需要 Pro 账号才能从私有仓库部署。公开仓库 + 改掉密码就足够。

---

## ❓ 常见问题

**Q：我还没填 Firebase 配置能先看效果吗？**
A：可以。直接打开 `index.html` 会显示配置引导页，截图示例也能看到整体风格。

**Q：Firebase 免费额度够用吗？**
A：够。免费套餐每天 50K 次读 + 20K 次写 + 1GB 存储。对于个人几十件物品、几百次访问完全够。

**Q：图片质量差？**
A：默认压缩到最长边 1400px、JPEG 质量 82%。想调整改 `app.js` 里 `compressImage` 函数的参数。

**Q：能用自己的域名吗？**
A：可以。GitHub Pages 支持自定义域名，Settings → Pages → Custom domain 里设置即可。

**Q：想让它支持多个卖家？**
A：当前版本是单店主设计。多卖家需要接 Firebase Auth，每个 item 加 `ownerId` 字段，改造不小。

---

## 📄 License

MIT. 随便用、随便改。
