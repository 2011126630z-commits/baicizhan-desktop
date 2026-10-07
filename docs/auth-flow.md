# 百词斩网页登录流程分析（auth-flow）

> 记录 2026-10-08 对本项目登录窗口所走**官方网页正常流程**的实测结果。
> 所有 OAuth URL 均来自官方服务器 302 响应原样捕获（客户端不构造、不修改任何 OAuth 参数）。
> **本文档不含任何 Cookie value / 密码 / Token。**

## 一、登录页面

| 项目 | 实测结果 |
| --- | --- |
| 登录页 URL | `https://www.baicizhan.com/login` |
| 页面标题 | 登录百词斩 - baicizhan.com |
| 页面存在 | ✅ 存在（官网营销首页无链接指向它，但路由有效） |
| 表单 | `POST /login`（表单 action=/login，method=POST，同域） |
| 表单字段 | `utf8`、`authenticity_token`（Rails CSRF）、`email`、`raw_pwd`、`remember_me` |
| 服务端状态 | ✅ 在线：提交测试账号返回业务错误 **「无效用户名或密码」**（证明服务端在处理登录请求，而非静态旧页面） |
| 第三方登录入口 | 微博 `/auth/weibo`、微信 `/auth/weixin`、人人 `/auth/renren` |
| 欢迎页 | `https://www.baicizhan.com/hello`（存在："已有账号? 点此登录"） |

## 二、微信 OAuth 完整链路（2026-10-08 实测）

### 2.1 重定向链（标准浏览器捕获）

```
GET https://www.baicizhan.com/auth/weixin
  → 302 Location: https://open.weixin.qq.com/connect/qrconnect
      ?appid=wx3eaeff9db2a3c4e9
      &redirect_uri=http%3A%2F%2Fbaicizhan.com%2Fauth%2Fweixin%2Fcallback
      &response_type=code
      &scope=snsapi_login
      &state=<每次随机 40 位 hex>
      #wechat_redirect
  → 微信页面显示：「抱歉，出错了 / redirect_uri 参数错误」
```

### 2.2 UA 对照（证明客户端未修改 URL）

| 请求方 | 返回的 OAuth URL |
| --- | --- |
| curl 默认 UA | 302 → 上述 URL（redirect_uri 单次编码 `%3A%2F%2F`） |
| WebView2/Edge UA | 302 → **完全一致**（仅 state 随机） |
| 标准浏览器导航 | 同上 |

**结论**：OAuth URL 由百词斩服务端生成，任何 UA 下相同；客户端（Tauri/WebView2）**不存在**
`redirect_uri` 替换、二次编码或 URL 重写（项目全量搜索确认无相关代码）。

### 2.3 根因

- 微信 OAuth 要求 `redirect_uri` 与**开放平台后台登记值精确匹配**；
- 线上生成值为 `http://baicizhan.com/auth/weixin/callback`（**http 协议 + 裸域**）；
- 实测 `http(s)://baicizhan.com/...` 均 301 到 `http://www.baicizhan.com/...`（线上结构已变）；
- **标准浏览器访问官方页面点击微信登录，同样出现「redirect_uri 参数错误」**。

**根因 = 百词斩官方微信开放平台回调域配置与当前线上实际不符（服务端侧），客户端无法也不应修复。**

## 三、Cookie 与身份验证策略

### 3.1 会话 Cookie（仅记录元数据，不含值）

登录成功后由官方 `Set-Cookie` 产生；本项目只保存以下字段并在**发送前**按规则匹配：

| 字段 | 说明 |
| --- | --- |
| name | Cookie 名称（如会话标识名） |
| domain | 必须属于 `baicizhan.com` 或其子域，否则采集阶段即丢弃 |
| path | 目标路径前缀匹配 |
| secure | 记录（所有出站请求均为 https） |
| expires | 过期后不发送 |
| httpOnly | 记录（不用于前端） |

### 3.2 双白名单（严格独立）

| 白名单 | 用途 | 规则 |
| --- | --- | --- |
| AUTH_NAVIGATION_ALLOWLIST | 登录窗口允许导航的认证域 | 官方域 + 已知 OAuth 提供方（微信/微博/人人）；其他域拦截并记录日志 |
| BAICIZHAN_COOKIE_ALLOWLIST | 百词斩 Cookie 可发送的目标 | **仅** `baicizhan.com` 及 `*.baicizhan.com`（`is_allowed_official_host`）；第三方 OAuth 域 NEVER |

### 3.3 SessionProbe（登录成功后执行）

1. 携带会话访问官方页面；
2. 检查是否被重定向到登录入口（会话失效信号）；
3. 检查登录/未登录特征标记；
4. 找不到可靠证据 → `unverified`（「会话待验证」），**绝不显示为已登录**。

> 待用户在官方页面完成一次真实登录后，本节将补充实测的 Cookie 元数据与身份标记结果。

## 四、结论速览

| 项目 | 状态 |
| --- | --- |
| 邮箱登录服务端 | ✅ 在线（待用户真实凭据完成端到端验证） |
| 微信登录 | ❌ 官方 OAuth 配置问题（redirect_uri 参数错误，标准浏览器同样复现） |
| 客户端 OAuth 修改 | ✅ 无（全项目搜索 + UA 对照双重确认） |
| 导航白名单 | ✅ 已实现（AUTH_NAVIGATION_ALLOWLIST，单元测试覆盖） |
| Cookie 白名单 | ✅ 独立实现（单元测试覆盖 evil 域边界） |
