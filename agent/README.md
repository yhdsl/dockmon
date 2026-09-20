# DockMon 代理 (DockMon Agent)

DockMon 代理 (DockMon Agent) 是一个基于 Go 编写的极其轻量的代理服务，可以通过 WebSocket 将远程 Docker 主机连接到你的 DockMon 实例。无需暴露 Docker 守护进程端口或者配置 mTLS 证书。

## 特色功能

- **仅出站连接** - 代理将主动连接到 DockMon，无需开放入站端口
- **容器管理** - 允许启动、停止、重启、删除和更新容器
- **实时事件** - 将完整的容器事件实时传输到 DockMon
- **自动重连** - 自动重连，重试时间按照指数函数递增 (1s → 60s)
- **自动更新** - 代理可以远程自动更新
- **多架构支持** - 支持 amd64 和 arm64

## 快速开始

### 前置条件

- 远程主机已安装 Docker
- 已配置能够访问你的 DockMon 实例的网络连接
- 来自 DockMon 的注册令牌

### 安装步骤

1. 在 DockMon UI 中获取注册令牌 (仪表盘 → 主机 → 添加主机 → 代理管理)

2. 运行代理容器:

```bash
docker run -d \
  --name dockmon-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dockmon-agent-data:/data \
  -v /proc:/host/proc:ro \
  -v /:/hostfs:ro \
  -e DOCKMON_URL=wss://your-dockmon-instance.com \
  -e REGISTRATION_TOKEN=your-token-here \
  ghcr.io/yhdsl/dockmon-agent:2.2.0
```

或者使用如下 Docker Compose 文件:

```yaml
services:
  dockmon-agent:
    image: ghcr.io/darthnorse/dockmon-agent:latest
    container_name: dockmon-agent
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - dockmon-agent-data:/data
      - /proc:/host/proc:ro
      - /:/hostfs:ro
    environment:
      - DOCKMON_URL=wss://your-dockmon-instance.com
      - REGISTRATION_TOKEN=your-token-here

volumes:
  dockmon-agent-data:
```

**重要提示**: 命令中创建的 `-v dockmon-agent-data:/data` 命名卷是**必须**的，将用于:
- 在重启期间持久化存储认证令牌
- 启用远程自动更新功能 (允许代理原地自更新)

请**不要**使用绑定挂载或者忽略该命名卷，否则会导致代理令牌持久化和自动更新功能失效。

`-v /proc:/host/proc:ro` 能让容器化的代理读取真实主机 CPU 和内存数据。

如果不进行挂载，代理只能报告容器自身的统计数据，针对主机范围指标的告警规则将永远无法触发，

并且代理会在启动时记录一条警告日志。

系统代理会直接读取 `/proc`，因此不需要挂载此文件。

`-v /:/hostfs:ro` 能让容器化的代理测量主机磁盘使用情况 (`disk_percent`，即 &quot;磁盘剩余空间不足&quot; 规则)。

代理会测量 Docker 数据根目录 (默认是 `/var/lib/docker`) 的文件系统，

如果无法确定，则回退到主机根文件系统；

示例中的 `disk_source` 会说明实际使用的是哪个文件系统。

这同样需要挂载 `/host/proc`，因为磁盘数据依赖于同一个主机的采样数据。

如果没有挂载，代理将不会报告任何磁盘数据 (绝不会报告为 0)，并且会在启动时记录一条警告日志。

需要注意的是，这会将整个主机文件系统以只读的方式暴露给代理容器。

而且在 5.12 之前的内核上，`:ro` 标志不会传递到子挂载 (submounts) 中；

如果已使用 Docker 25+，并且内核支持，则可以改用：

`--mount type=bind,src=/,dst=/hostfs,readonly,bind-recursive=readonly`

3. 代理将自动注册到指定 DockMon 实例，并出现在主机列表中

## 代理配置

允许通过环境变量进行额外的配置:

### 必须的选项

- `DOCKMON_URL` - DockMon 实例的 WebSocket 地址 (wss://...)
- `REGISTRATION_TOKEN` - 一次性注册令牌 (仅首次运行时需要)
- `PERMANENT_TOKEN` - 永久令牌 (首次注册后使用)

### 可选的选项

- `AGENT_NAME` - 在 DockMon UI 中显示的代理名称。会在注册时以及每次重新连接时覆盖自动检测到的主机名。当多个主机共享相同的操作系统主机名 (例如克隆的虚拟机或者 LXC 模板) 且你不希望修改底层服务器名称时非常有用。未设置时，将依次回退为 Docker 守护进程主机名 → 操作系统主机名 → 引擎 ID。
- `FORCE_UNIQUE_REGISTRATION` - 设置为真 (`true`, `1`, `t`, `T`, `TRUE`, `True` — 或者任何 Go 的 `strconv.ParseBool` 所能接受的值) 时，即使 Docker 的 `engine_id` 与已注册主机相同，也会将该代理注册为一个独立的主机。适用于克隆的虚拟机或 LXC 模板共享 `/var/lib/docker/engine-id` 的场景。**需要同时设置 `AGENT_NAME`** (代理在启动时、systemd 安装脚本在安装时以及 DockMon 后端在注册时都会强制校验)。此设置会跳过 DockMon 从现有 remote-mTLS 主机的自动迁移行为。默认值为 `false`。
- `DOCKER_HOST` - Docker 套接字路径 (默认: `unix:///var/run/docker.sock`)
- `DOCKER_CERT_PATH` - Docker TLS 证书路径 (仅启用 TLS 时使用)
- `DOCKER_TLS_VERIFY` -  启用 Docker TLS 校验 (默认: `false`)
- `RECONNECT_INITIAL` - 初始重连的延迟时长 (默认: `1s`)
- `RECONNECT_MAX` - 最大重连的延迟时长 (默认: `60s`)
- `LOG_LEVEL` - 日志记录等级: debug, info, warn, error (默认: `info`)
- `LOG_JSON` - 以 JSON 格式输出日志 (默认: `true`)

## 组件架构

代理由以下关键组件构成:

- **WebSocket 客户端** - 维持与 DockMon 的连接并自动重连
- **Docker 客户端** - 封装 Docker API 以执行容器操作
- **协议处理器** -编解码 WebSocket 消息
- **事件流模块** - 将 Docker 事件流发送到 DockMon
- **更新处理器** - 管理代理的自动更新功能

## 如何开发

### 本地构建

```bash
cd agent
go mod download
go build -o dockmon-agent ./cmd/agent
```

### 本地运行

```bash
export DOCKMON_URL=ws://localhost:8000
export REGISTRATION_TOKEN=your-token
export LOG_LEVEL=debug
export LOG_JSON=false

./dockmon-agent
```

### 构建 Docker 镜像

```bash
docker build -t dockmon-agent:dev \
  --build-arg VERSION=dev \
  --build-arg COMMIT=$(git rev-parse --short HEAD) \
  .
```

## 安全事项

- 代理以非 root 用户权限运行 (uid 1000)
- 仅建立出站类型的 WebSocket 连接 (无开放端口)
- 在生产环境内必须使用 TLS
- 需要访问 Docker 套接字 (固有的安全风险)
- 注册令牌为一次性使用
- 永久令牌将存储在 `/data` 卷内 (请妥善保护)
- 自更新功能会校验镜像并保证容器 ID 稳定
- 更新由 DockMon 发起的已认证的 WebSocket 命令触发

## 故障排查

### 无法连接至代理

1. 请检查 `DOCKMON_URL` 是否正确 (HTTPS 下使用 wss://，而 HTTP 使用 ws://)
2. 验证网络的连通性: `curl -v <DOCKMON_URL>`
3. 请检查注册令牌是否有效
4. 查看代理的日志: `docker logs dockmon-agent`

### 容器操作失败

1. 请确认已挂载 Docker 套接字: `docker exec dockmon-agent ls -l /var/run/docker.sock`
2. 请检查代理是否具有 Docker 套接字权限
3. 审阅 DockMon 后端的日志以获取详细的错误信息

### 代理频繁断开

1. 请检查网络的稳定性
2. 审阅重连相关的日志
3. 确认 DockMon 正在运行且运行状态健康
4. 请检查是否存在防火墙或代理软件干扰

## 版本历史

- **2.2.0** - Initial release
  - WebSocket communication
  - Container operations (start, stop, restart, delete, update)
  - Event streaming
  - Self-update capability
  - Multi-architecture support

## 许可证

与 DockMon 主项目的许可证相同
