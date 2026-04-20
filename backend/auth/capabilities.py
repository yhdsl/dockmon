"""
Capability Definitions for Group-Based Permissions (v2.3.0 refactor)

This module defines ALL_CAPABILITIES and their metadata for the RBAC system.
Capabilities are assigned to groups, users get permissions from their groups.

Usage:
    from auth.capabilities import ALL_CAPABILITIES, CAPABILITY_INFO
    from auth.capabilities import ADMIN_CAPABILITIES, OPERATOR_CAPABILITIES, READONLY_CAPABILITIES
"""



# =============================================================================
# Capability Definitions with Metadata
# =============================================================================

CAPABILITY_INFO: dict[str, dict[str, str]] = {
    # Hosts
    'hosts.manage': {
        'category': '主机',
        'name': '主机管理',
        'description': '添加、编辑和删除 Docker 主机',
    },
    'hosts.view': {
        'category': '主机',
        'name': '查看主机',
        'description': '查看主机列表和连接状态',
    },

    # Stacks
    'stacks.edit': {
        'category': '堆栈',
        'name': '编辑堆栈',
        'description': '创建、编辑和删除堆栈',
    },
    'stacks.deploy': {
        'category': '堆栈',
        'name': '部署堆栈',
        'description': '将现有堆栈部署到主机',
    },
    'stacks.view': {
        'category': '堆栈',
        'name': '查看堆栈',
        'description': '查看堆栈列表及内容',
    },
    'stacks.view_env': {
        'category': '堆栈',
        'name': '查看堆栈环境文件',
        'description': '查看 .env 文件内容 (可能包含敏感信息)',
    },

    # Containers
    'containers.operate': {
        'category': '容器',
        'name': '容器操作',
        'description': '启动、停止和重启容器',
    },
    'containers.shell': {
        'category': '容器',
        'name': 'Shell 访问',
        'description': '在容器中执行命令 (相当于 root 访问权限)',
    },
    'containers.update': {
        'category': '容器',
        'name': '更新容器',
        'description': '触发容器镜像更新',
    },
    'containers.view': {
        'category': '容器',
        'name': '查看容器',
        'description': '查看容器列表和详细信息',
    },
    'containers.logs': {
        'category': '容器',
        'name': '查看日志',
        'description': '查看容器的日志输出',
    },
    'containers.view_env': {
        'category': '容器',
        'name': '查看容器环境变量',
        'description': '查看容器环境变量 (可能包含敏感信息)',
    },

    # Health Checks
    'healthchecks.manage': {
        'category': '健康检查',
        'name': '管理健康检查',
        'description': '创建、编辑和删除基于 HTTP 的健康检查',
    },
    'healthchecks.test': {
        'category': '健康检查',
        'name': '测试健康检查',
        'description': '手动触发健康检查测试',
    },
    'healthchecks.view': {
        'category': '健康检查',
        'name': '查看健康检查',
        'description': '查看健康检查配置和结果',
    },

    # Batch Operations
    'batch.create': {
        'category': '批处理操作',
        'name': '创建批处理任务',
        'description': '创建容器批处理操作任务',
    },
    'batch.view': {
        'category': '批处理操作',
        'name': '查看批处理任务',
        'description': '查看批处理任务列表和状态',
    },

    # Update Policies
    'policies.manage': {
        'category': '更新策略',
        'name': '管理更新策略',
        'description': '创建、编辑和删除自动更新策略',
    },
    'policies.view': {
        'category': '更新策略',
        'name': '查看更新策略',
        'description': '查看自动更新策略配置',
    },

    # Alerts
    'alerts.manage': {
        'category': '告警',
        'name': '管理告警规则',
        'description': '创建、编辑和删除告警规则',
    },
    'alerts.view': {
        'category': '告警',
        'name': '查看告警',
        'description': '查看告警规则和历史记录',
    },

    # Notifications
    'notifications.manage': {
        'category': '通知',
        'name': '管理通知频道',
        'description': '创建、编辑和删除通知频道',
    },
    'notifications.view': {
        'category': '通知',
        'name': '查看通知频道',
        'description': '查看通知频道名称 (不包含配置)',
    },

    # Registry
    'registry.manage': {
        'category': '注册表凭证',
        'name': '管理注册表凭证',
        'description': '创建、编辑和删除注册表凭证',
    },
    'registry.view': {
        'category': '注册表凭证',
        'name': '查看注册表凭证',
        'description': '查看注册表凭证详细信息 (包含密码)',
    },

    # Agents
    'agents.manage': {
        'category': '代理',
        'name': '管理代理',
        'description': '注册代理并触发代理更新',
    },
    'agents.view': {
        'category': '代理',
        'name': '查看代理',
        'description': '查看代理状态和信息',
    },

    # Settings
    'settings.manage': {
        'category': '设置',
        'name': '管理设置',
        'description': '编辑全局设置',
    },

    # Users
    'users.manage': {
        'category': '用户',
        'name': '管理用户',
        'description': '创建、编辑和删除用户',
    },

    # OIDC
    'oidc.manage': {
        'category': 'OIDC',
        'name': '管理 OIDC',
        'description': '配置 OIDC 提供商设置和用户群组映射',
    },

    # Groups (new for v2.3.0 refactor)
    'groups.manage': {
        'category': '用户群组',
        'name': '管理用户群组',
        'description': '创建、编辑和删除用户群组及权限',
    },

    # Audit
    'audit.view': {
        'category': '审计',
        'name': '查看审计日志',
        'description': '查看安全审计日志',
    },

    # API Keys
    'apikeys.manage_other': {
        'category': 'API 密钥',
        'name': '管理 API 密钥',
        'description': '管理其他用户的 API 密钥',
    },

    # Tags
    'tags.manage': {
        'category': '标签',
        'name': '管理标签',
        'description': '创建、编辑和删除标签',
    },
    'tags.view': {
        'category': '标签',
        'name': '查看标签',
        'description': '查看标签列表',
    },

    # Events
    'events.view': {
        'category': '事件',
        'name': '查看事件',
        'description': '查看容器和系统的事件日志',
    },
}


# =============================================================================
# Capability Sets
# =============================================================================

# All capabilities (for reference and validation)
ALL_CAPABILITIES: set[str] = set(CAPABILITY_INFO.keys())


# Administrators group - all capabilities
ADMIN_CAPABILITIES: set[str] = ALL_CAPABILITIES.copy()


# Operators group - can use features but limited config access
OPERATOR_CAPABILITIES: set[str] = {
    'hosts.view',
    'stacks.deploy',
    'stacks.view',
    'stacks.view_env',
    'containers.operate',
    'containers.view',
    'containers.logs',
    'containers.view_env',
    'healthchecks.test',
    'healthchecks.view',
    'batch.create',
    'batch.view',
    'policies.view',
    'alerts.view',
    'notifications.view',
    'agents.view',
    'tags.manage',
    'tags.view',
    'events.view',
}


# Read Only group - view-only access
READONLY_CAPABILITIES: set[str] = {
    'hosts.view',
    'stacks.view',
    'containers.view',
    'containers.logs',
    'healthchecks.view',
    'batch.view',
    'policies.view',
    'alerts.view',
    'notifications.view',
    'agents.view',
    'tags.view',
    'events.view',
}


# =============================================================================
# Helper Functions
# =============================================================================

def get_categories() -> list[str]:
    """Get unique list of capability categories in display order."""
    seen: set[str] = set()
    categories: list[str] = []
    for info in CAPABILITY_INFO.values():
        category = info['category']
        if category not in seen:
            seen.add(category)
            categories.append(category)
    return categories


def get_capabilities_by_category() -> dict[str, list[str]]:
    """Get capabilities grouped by category."""
    result: dict[str, list[str]] = {}
    for capability, info in CAPABILITY_INFO.items():
        category = info['category']
        if category not in result:
            result[category] = []
        result[category].append(capability)
    return result


def is_valid_capability(capability: str) -> bool:
    """Check if a capability string is valid."""
    return capability in ALL_CAPABILITIES
