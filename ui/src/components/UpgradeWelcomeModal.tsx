import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { RemoveScroll } from 'react-remove-scroll';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useAppVersion } from '@/lib/contexts/AppVersionContext';

interface UpgradeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeWelcomeModal({
  open,
  onClose
}: UpgradeWelcomeModalProps) {
  const { version } = useAppVersion();
  const githubReleasesUrl = `https://github.com/yhdsl/dockmon/releases/tag/v${version}`;
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    try {
      setDismissing(true);
      await apiClient.post('/upgrade-notice/dismiss', {});
      onClose();
    } catch (error) {
      console.error('Failed to dismiss upgrade notice:', error);
    } finally {
      setDismissing(false);
    }
  };

  if (!open) return null;

  return (
    <RemoveScroll>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleDismiss}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border bg-background shadow-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-semibold">欢迎使用 DockMon v2!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              一次全面的重写，带来众多全新且强大的新功能
            </p>
          </div>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <p className="text-base">
              DockMon v2 是一次全面重写的更新版本，包含了我们从 v1 版本中学到的一切，并使其变得更加出色！
            </p>

            {/* Highlights */}
            <div>
              <h4 className="font-semibold text-base mb-3">新增内容</h4>
              <div className="grid gap-2">
                {[
                  '可自定义的仪表板，支持小组件拖放',
                  '支持添加容器标签，以实现更好的容器管理',
                  '批量启动/停止/重启多个容器',
                  '支持按计划自动更新容器',
                  '支持 HTTP/HTTPS 健康检查，并在失败时自动重启',
                  '增强的监控指标与监控方式',
                  '基于 React 的现代化界面',
                  '改进的安全性 (Alpine Linux，OpenSSL 3.x)',
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6" />

            {/* Breaking Change Warning */}
            <div className="rounded-lg border-l-4 border-danger bg-danger/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-danger mb-2">
                    需要采取的行动: 迁移后的检查清单
                  </h4>
                  <div className="space-y-4 text-sm">
                    <p>
                      你的主机、容器和事件历史已被迁移，但 v2 版本中存在一些破坏性变更，需要你手动采取相应的操作: 
                    </p>

                    <div>
                      <div className="font-semibold mb-2">1. 告警规则 (如适用)</div>
                      <p className="mb-2">
                        v2 版本设计了全新的告警系统。你原有的告警规则未被迁移，需要在新的告警界面中重新手动创建。
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold mb-2">2. mTLS 证书 (如适用)</div>
                      <p className="mb-2">
                        如果你有启用了 mTLS 证书的远程 Docker 主机，由于 Alpine 更为严格的安全要求，你需要重新手动生成证书。
                      </p>
                      <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li>
                          在每个远程主机上，下载更新后的脚本: 
                          <div className="mt-1 bg-background/50 p-2 rounded font-mono text-xs overflow-x-auto">
                            curl -O https://raw.githubusercontent.com/yhdsl/dockmon/main/scripts/setup-docker-mtls.sh
                          </div>
                        </li>
                        <li>
                          将其设为可执行并运行: 
                          <div className="mt-1 bg-background/50 p-2 rounded font-mono text-xs overflow-x-auto">
                            chmod +x setup-docker-mtls.sh && ./setup-docker-mtls.sh
                          </div>
                        </li>
                        <li>重启远程主机上的 Docker</li>
                        <li>
                          在 DockMon 中，编辑每个启用了 mTLS 证书的主机，并按照 mTLS 脚本中的说明复制/粘贴新的证书 (ca.pem, cert.pem, key.pem)
                        </li>
                      </ol>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="mt-2"
                    >
                      <a href={githubReleasesUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        在此查看详细的迁移指南
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-md">
              <p>
                我们也并不喜欢破坏性的变更，但这是为了提供更好的安全性并支持未来新功能所必需的。感谢你的理解！
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" asChild>
            <a href={githubReleasesUrl} target="_blank" rel="noopener noreferrer">
              查看完整的发布说明
            </a>
          </Button>
          <Button onClick={handleDismiss} disabled={dismissing}>
            {dismissing ? '正在关闭中...' : "已了解，不再显示"}
          </Button>
        </div>
      </div>
    </div>
    </RemoveScroll>
  );
}
