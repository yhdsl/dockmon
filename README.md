# DockMon - 非官方中文项目

一个功能全面的 Docker 容器监控与管理软件，提供实时容器或主机监控、智能重启、多渠道告警以及完整的事件日志管理。

本仓库为 [DockMon](https://github.com/darthnorse/dockmon) 项目的非官方简体中文翻译版本，在原版的基础上进行了如下的修改:

1. 完全支持简体中文，包括通知内容
2. 添加了 UTC+8 时区的支持
3. 修正原版 DockMon 不支持非英文标签的问题

![DockMon](https://img.shields.io/badge/DockMon-v2.3.2-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![License](https://img.shields.io/badge/license-BSL%201.1-blue.svg)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/darthnorse)

<p align="center">
  <img src="screenshots/dashboard.png" alt="DockMon Dashboard" width="800">
</p>

## 核心特性

- **多主机监控** - 支持监控任意数量的本地或远程 Docker 主机上的容器
- **基于代理的远程监控** - 由 Go 编写的轻量级代理服务，无需暴露 Docker 端口即可安全监控远程主机，支持以容器或 systemd 服务形式运行
- **实时仪表板** - 支持拖拽的可自定义仪表板组件，基于 WebSocket 实现实时更新
- **实时统计信息** - 实时展示 CPU 使用率、内存使用率以及网络 I/O
- **实时容器日志** - 支持同时查看多个容器的实时日志流
- **事件管理** - 提供完整的且实时更新的事件日志记录，支持过滤和搜索
- **智能重启** - 基于容器配置的重启策略自动恢复异常退出的容器，并支持自定义重试逻辑
- **告警功能** - 支持 Discord、Slack、Telegram、Pushover、Gotify 和 SMTP，允许自定义通知模板
- **容器标签** - 基于 Docker 标签自动生成容器标签，并支持自定义标签管理
- **批量操作** - 支持批量启动、停止、重启容器，并提供实时进度反馈
- **堆栈管理** - 支持创建、编辑 Docker Compose 堆栈并部署至本地或远程主机，支持从运行中的容器或主机文件系统导入现有堆栈，并提供实时部署进度及分层镜像拉取跟踪
- **自动更新** - 按计划检测并更新容器镜像版本
- **HTTP/HTTPS 健康检查** - 支持对容器自定义监控 URL 进行健康检查，并在失败时自动重启
- **维护黑窗** - 在计划维护期间抑制告警通知
- **多用户支持** - 基于角色的访问控制 (RBAC)，支持自定义用户组、细粒度权限管理以及用户控制
- **OIDC/SSO 集成** - 支持通过任意 OIDC 提供商 (如 Authentik、Keycloak、Okta、Entra ID、Auth0) 实现单点登录，支持用户组同步及可选的审批流程
- **API 密钥** - 提供基于用户组权限控制的 API 访问，支持 IP 限制及过期策略
- **安全设计** - 基于会话认证、限流机制、远程主机 mTLS，并使用 Alpine Linux 镜像构建

## 参考文档 (英文)

- **[Complete User Guide](https://github.com/darthnorse/dockmon/wiki)** - 完整用户文档
- **[Quick Start](https://github.com/darthnorse/dockmon/wiki/Quick-Start)** - 5 分钟快速入门
- **[Installation](https://github.com/darthnorse/dockmon/wiki/Installation)** - 支持 Docker、unRAID、Synology、QNAP 平台部署
- **[Configuration](https://github.com/darthnorse/dockmon/wiki/Notifications)** - 告警、通知以及系统设置
- **[Multi-User & OIDC](https://github.com/darthnorse/dockmon/wiki/Multi-User-and-OIDC)** - 用户、用户组以及 SSO 配置
- **[Security](https://github.com/darthnorse/dockmon/wiki/Security-Guide)** - 最佳安全实践以及 mTLS 配置
- **[Remote Monitoring](https://github.com/darthnorse/dockmon/wiki/Remote-Docker-Setup)** - 远程 Docker 主机监控配置
- **[Event Viewer](https://github.com/darthnorse/dockmon/wiki/Event-Viewer)** - 支持过滤的完整审计日志视图
- **[Container Logs](https://github.com/darthnorse/dockmon/wiki/Container-Logs)** - 实时多容器实时日志查看
- **[API Reference](https://github.com/darthnorse/dockmon/wiki/API-Reference)** - REST 与 WebSocket API 文档
- **[FAQ](https://github.com/darthnorse/dockmon/wiki/FAQ)** - 常见问题解答
- **[Troubleshooting](https://github.com/darthnorse/dockmon/wiki/Troubleshooting)** - 常见问题排查

## 官方支持与社区

- **[Discord 服务器](https://discord.gg/wEZxeet2N3)** - 加入社区、获取帮助、分享经验
- **[Report Issues](https://github.com/darthnorse/dockmon/issues)** - 发现了一个 Bug?
- **[Discussions](https://github.com/darthnorse/dockmon/discussions)** - 提问问题，交流想法
- **[Wiki](https://github.com/darthnorse/dockmon/wiki)** - 完整的使用文档 (英文)
- **[Star on GitHub](https://github.com/darthnorse/dockmon)** - 支持原项目!
- **[Buy Me A Coffee](https://buymeacoffee.com/darthnorse)** - 赞助原项目!

## 技术栈

### 后端
- **Python 3.13** with FastAPI and async/await
- **Alpine Linux 3.x** container base (reduced attack surface)
- **OpenSSL 3.x** for modern cryptography
- **SQLAlchemy 2.0** with Alembic migrations
- **Go 1.23** stats service for real-time metrics streaming

### 前端
- **React 18.3** with TypeScript (strict mode, zero `any`)
- **Vite** for fast development builds
- **TanStack Table** for data tables
- **React Grid Layout** for dashboard customization
- **Tailwind CSS** for styling

### 基础设施
- **Multi-stage Docker build** - Go stats + React frontend + Python backend
- **Supervisor** for process management
- **Nginx** reverse proxy with SSL/TLS
- **WebSocket** for real-time updates
- **Health checks** for all services

## Upgrading from v1 to v2

### Breaking Changes
- **Alert Rules**: Old alert rules must be recreated using the new alert system
- **mTLS Certificates**: Regenerate certificates due to Alpine's stricter OpenSSL 3.x requirements
- **Database Schema**: Automatic one-time migration from v1.1.3 to v2.0.0

### Data Preserved
- ✅ Hosts and their configurations
- ✅ Containers and container history
- ✅ Event logs and audit trail
- ✅ User accounts and preferences

### Post-Upgrade Steps
1. Regenerate mTLS certificates for remote hosts (see [mTLS Setup Guide](https://github.com/darthnorse/dockmon/wiki/Security-Guide#mtls-setup))
2. Recreate alert rules using the new alert system
3. Verify host connections after upgrade

See the [Migration Guide](https://github.com/darthnorse/dockmon/wiki/Migration-Guide) for detailed instructions.

## 贡献

Contributions are welcome! **No CLA required** - just submit a PR!

- Report bugs via [GitHub Issues](https://github.com/darthnorse/dockmon/issues)
- Suggest features in [Discussions](https://github.com/darthnorse/dockmon/discussions)
- Improve documentation (edit the [Wiki](https://github.com/darthnorse/dockmon/wiki))
- Submit pull requests (see [Contributing Guide](https://github.com/darthnorse/dockmon/wiki/Contributing))

By contributing, you agree your contributions are licensed under the same BSL 1.1 terms as the project.

## 开发

Want to contribute code or run DockMon in development mode?

See [Development Setup](https://github.com/darthnorse/dockmon/wiki/Development-Setup) for:
- Local development environment setup
- Architecture overview
- Running tests
- Building from source

## 许可证

**Business Source License 1.1** - see [LICENSE](LICENSE) file for full details.

### What this means:

✅ **You can use DockMon:**
- For internal use in your company (any size)
- For personal projects
- To monitor your clients' infrastructure as part of consulting/MSP services
- Fork, modify, and customize for your own use
- Contribute improvements back to the project

❌ **You cannot:**
- Offer DockMon as a SaaS product to third parties
- Embed DockMon in a commercial monitoring platform sold to others
- Provide DockMon hosting as a standalone commercial service

### Future Open Source:
After 2 years (Change Date: 2027-01-01), each version automatically converts to **Apache License 2.0**, becoming fully permissive open source with explicit patent grants.

### Commercial Licensing:
Need to use DockMon in a way not permitted by BSL? Contact us for commercial licensing:
- [Open an Issue](https://github.com/darthnorse/dockmon/issues)
- Describe your use case
- We'll work with you on licensing terms

### Why BSL?
BSL protects the project from direct commercial competition while remaining contributor-friendly:
- **No CLAs required** - standard GitHub workflow
- **Eventually becomes open source** - builds community trust
- **Allows all legitimate uses** - only blocks competitive SaaS offerings
- Used successfully by Sentry, CockroachDB, MariaDB, and other major projects

## 作者

Created by [darthnorse](https://github.com/darthnorse)

由 [YHDSL](https://github.com/yhdsl) 汉化并维护

## Acknowledgments

This project has been developed with **vibe coding** and **AI assistance** using Claude Code. The codebase includes clean, well-documented code with proper error handling, comprehensive testing considerations, modern async/await patterns, robust database design, and production-ready deployment configurations.

---

<p align="center">
  <strong>If DockMon helps you, please consider giving it a star or supporting the project!</strong>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/darthnorse" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
  </a>
</p>

<p align="center">
  <a href="https://github.com/darthnorse/dockmon/wiki">Documentation</a> •
  <a href="https://github.com/darthnorse/dockmon/issues">Issues</a> •
  <a href="https://github.com/darthnorse/dockmon/discussions">Discussions</a>
</p>
