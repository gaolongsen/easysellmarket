# EasySellMarket

[English README](./README.md)

> 一个适合小型熟人圈使用的轻量二手发布站。
> 前端纯静态，后端用 Firebase Firestore，半天内就能配置上线。

## ✨ 这个项目适合什么场景

EasySellMarket 是一个面向小圈子交易场景的单页二手市场，适合班级群、邻里群、工作室、教会、小区群、朋友群这类“彼此基本认识”的环境。

如果你想要的是下面这种体验，它会比较合适：

- 📱 手机优先的二手发布页
- 🖼️ 支持图片上传，并在前端自动压缩
- 💬 商品留言区和排队系统
- 🛠️ 隐藏式管理员后台 `#/admin`
- 🔐 带序列码/邀请码的发布者入口 `#/publish`
- 🚀 可以直接部署到 GitHub Pages

## 🧰 技术栈

- 前端：原生 HTML、CSS、JavaScript
- 路由：Hash 路由
- 后端：Firebase Firestore
- 部署：GitHub Pages

## 🗂️ 项目结构

```text
.
|-- index.html          # 页面结构、样式、Firebase 配置、资源版本号
|-- app.js              # 应用逻辑、路由、Firestore 交互
|-- README.md           # 英文说明
`-- README.zh-CN.md     # 中文说明
```

## 🚀 快速开始

如果你想先把项目跑起来，按下面顺序操作就可以。

### 1. 创建 Firebase 项目

1. 打开 <https://console.firebase.google.com>
2. 创建一个新的 Firebase 项目
3. 启用 `Firestore Database`
4. 在项目设置里创建一个 Web App
5. 复制系统生成的 `firebaseConfig`

### 2. 打开 `index.html`，替换配置

找到配置区块，并改成你自己的参数：

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.ADMIN_PASSWORD = "change-me";
window.SELLER_NAME = "Your Name";
window.SELLER_WECHAT = "your-contact";
window.PUBLISHER_CODES = [
  { code: "EASY-SELL-001", label: "Example Publisher", enabled: true }
];
window.ASSET_VERSION = "2026-04-17-1";
```

### 3. 这些字段分别是做什么的

- `window.FIREBASE_CONFIG`：把网站连接到你的 Firebase 项目
- `window.ADMIN_PASSWORD`：进入 `#/admin` 后台时使用的密码
- `window.SELLER_NAME`：默认展示的卖家或店主名称
- `window.SELLER_WECHAT`：默认展示给用户的联系方式
- `window.PUBLISHER_CODES`：发布者序列码的兜底列表
- `window.ASSET_VERSION`：部署后用于刷新前端缓存的版本号

### 4. 本地运行

虽然直接打开 `index.html` 也可能能用，但更推荐本地静态服务：

```powershell
cd d:\GitHub\easysellmarket
python -m http.server 5500
```

然后访问：

```text
http://localhost:5500
```

### 5. 上线前做一次快速自检

建议至少确认下面这几项：

1. `#/` 首页可以正常打开并显示商品列表
2. `#/publish` 可以进入发布者登录流程
3. `#/admin` 可以用你设置的管理员密码进入
4. 新建一条测试商品后，Firestore 里能看到数据

## 🧭 页面路由

- `#/` 首页
- `#/item/<itemId>` 商品详情页
- `#/admin` 管理员后台
- `#/publish` 发布者登录与发布中心

## 👥 角色与权限

### 管理员

- 可以创建、编辑、删除所有商品
- 可以管理排队列表
- 可以管理发布者序列码
- 可以查看留言中的联系方式

### 发布者

- 必须使用有效序列码登录
- 必须填写展示名称和联系方式
- 只能发布到自己的序列码名下
- 只能编辑和删除自己发布的商品

## 🔑 序列码来源

发布者序列码支持两个来源：

1. `index.html` 里的 `window.PUBLISHER_CODES`
2. Firestore 中的 `publisherCodes` 集合

前者适合做默认值和兜底列表。
一旦你开始在管理员后台里维护序列码，Firestore 集合就会成为主要数据来源。

## 🔄 缓存刷新

为了尽量减少手机端，尤其是微信内置浏览器继续使用旧缓存的问题，站点会带着版本号去加载 `app.js`。

每次你改完前端并准备重新部署时，记得顺手更新 `index.html` 里的这一项：

```js
window.ASSET_VERSION = "2026-04-17-2";
```

这样客户端更容易重新请求最新的 `app.js`。

## 🧪 Firestore 数据结构

```text
items/{itemId}
  title, description, price, originalPrice
  category, condition, status
  photos[]
  ownerType
  publisherCode, publisherName, publisherContact
  queueCount
  createdAt, updatedAt

items/{itemId}/comments/{commentId}
  author, contact, text, createdAt

items/{itemId}/queue/{queueId}
  name, contact, note, status, joinedAt

publisherCodes/{codeId}
  code, label, enabled, createdAt, updatedAt
```

## 📌 正式使用前的提醒

- 这个项目本质上仍然是静态前端，不是强安全认证系统。
- 管理员密码和 Firebase 配置都会暴露在前端。
- 如果你要做更正式、更严格的权限控制，建议接入 Firebase Auth 和 Firestore Rules。

## ✅ 部署前检查清单

- 已创建 Firebase 项目
- 已启用 Firestore
- 已替换 `window.FIREBASE_CONFIG`
- 已修改 `window.ADMIN_PASSWORD`
- 已更新默认卖家联系方式
- 已成功创建测试商品
- 部署前已递增 `window.ASSET_VERSION`

## License

MIT
