# EasySellMarket

[English README](./README.md)

一个适合小型熟人圈使用的轻量二手发布站。项目是纯静态单页应用，可以部署到 GitHub Pages，后端使用 Firebase Firestore。

## 功能特点

- 手机优先的响应式界面
- 商品图片展示，前端自动压缩
- 商品留言与排队系统
- 隐藏式管理员后台 `#/admin`
- 序列码发布者入口 `#/publish`
- 管理员可启用、停用、删除发布者序列码
- 通过 `window.ASSET_VERSION` 做前端缓存刷新

## 技术栈

- 前端：原生 HTML、CSS、JavaScript
- 路由：hash 路由
- 后端：Firebase Firestore
- 部署：GitHub Pages

## 项目结构

```text
.
|-- index.html          # 页面结构、样式、Firebase 配置、资源版本号
|-- app.js              # 应用逻辑、路由、Firestore 交互
|-- README.md           # 英文版说明
`-- README.zh-CN.md     # 中文版说明
```

## 快速开始

### 1. 创建 Firebase 项目

1. 打开 <https://console.firebase.google.com>
2. 创建一个新项目
3. 启用 `Firestore Database`
4. 在项目设置中创建一个 Web App
5. 复制生成的 `firebaseConfig`

### 2. 配置网站

编辑 `index.html`，修改下面这些配置：

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
window.SELLER_NAME = "你的名字";
window.SELLER_WECHAT = "你的联系方式";
window.PUBLISHER_CODES = [
  { code: "EASY-SELL-001", label: "示例发布者", enabled: true }
];
window.ASSET_VERSION = "2026-04-17-1";
```

### 3. 本地预览

可以直接打开 `index.html`，但更推荐本地静态服务：

```powershell
cd d:\GitHub\easysellmarket
python -m http.server 5500
```

然后访问：

```text
http://localhost:5500
```

## 页面路由

- `#/` 首页
- `#/item/<itemId>` 商品详情页
- `#/admin` 管理员后台
- `#/publish` 发布者登录与发布中心

## 管理员与发布者权限

### 管理员

- 可以创建、编辑、删除所有商品
- 可以管理排队列表
- 可以管理发布者序列码
- 可以看到留言中的联系方式

### 发布者

- 必须使用有效序列码登录
- 必须填写称呼和联系方式
- 只能发布到自己的序列码名下
- 只能编辑和删除自己发布的商品

## 序列码管理

序列码支持两层来源：

1. `index.html` 中的 `window.PUBLISHER_CODES`
   作为默认兜底列表
2. Firestore 中的 `publisherCodes` 集合
   由管理员后台动态管理

当你开始在管理员后台管理序列码后，Firestore 列表会成为主要数据来源。

## 缓存刷新

为了尽量减少手机端，尤其是微信内置浏览器，继续使用旧缓存的问题，网站会带版本号加载 `app.js`。

每次你更新前端并准备部署时，请顺手修改 `index.html` 里的：

```js
window.ASSET_VERSION = "2026-04-17-2";
```

这样客户端会更容易重新请求最新的 `app.js`。

## Firestore 数据结构

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

## 说明

- 这个项目本质上仍然是静态前端，不是强安全认证系统
- 管理员密码和 Firebase 配置都在前端可见
- 如果要做真正严格的权限控制，建议接入 Firebase Auth 和 Firestore Rules

## License

MIT
