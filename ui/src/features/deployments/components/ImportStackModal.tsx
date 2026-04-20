/**
 * Import Stack Modal
 *
 * Allows users to import an existing Docker Compose stack into DockMon.
 * Auto-detects which host(s) have the stack running.
 *
 * Two import methods:
 * 1. Paste/Upload - User provides compose YAML content directly
 * 2. Browse Host - Scan agent host directories for compose files
 *
 * Flow:
 * 1. User selects import method (tabs)
 * 2. For paste: User pastes/uploads compose YAML
 * 3. For browse: User selects host, scans directories, picks a compose file
 * 4. If compose has 'name:' field -> auto-detect hosts and import
 * 5. If no 'name:' field -> show dropdown of known stacks from container labels
 * 6. On success -> show which hosts got deployment records
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiClient } from '@/lib/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useImportDeployment,
  useScanComposeDirs,
  useReadComposeFile,
  useRunningProjects,
  useGenerateFromContainers,
} from '../hooks/useDeployments'
import { useHosts } from '@/features/hosts/hooks/useHosts'
import { useAllContainers } from '@/lib/stats/StatsProvider'
import type {
  Deployment,
  KnownStack,
  ImportDeploymentRequest,
  ComposeFileInfo,
  RunningProject,
} from '../types'
import {
  CheckCircle2,
  Upload,
  FolderSearch,
  Loader2,
  FileCode,
  Container,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'

type ImportStep = 'input' | 'select-name' | 'stack-exists' | 'success'
type ImportMethod = 'paste' | 'browse' | 'running'

interface ImportStackModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (deployments: Deployment[]) => void
}

export function ImportStackModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportStackModalProps) {
  const { hasCapability } = useAuth()
  const canEdit = hasCapability('stacks.edit')
  const canDeploy = hasCapability('stacks.deploy')

  // Step and method state
  const [step, setStep] = useState<ImportStep>('input')
  const [method, setMethod] = useState<ImportMethod>('paste')

  // Paste/Upload state
  const [composeContent, setComposeContent] = useState('')
  const [envContent, setEnvContent] = useState('')
  const [showEnvField, setShowEnvField] = useState(false)

  // Browse host state
  const [selectedHostId, setSelectedHostId] = useState('')
  const [additionalPaths, setAdditionalPaths] = useState('')
  const [composeFiles, setComposeFiles] = useState<ComposeFileInfo[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set())

  // Batch import state
  const [isBatchImporting, setIsBatchImporting] = useState(false)
  const [batchImportProgress, setBatchImportProgress] = useState({ current: 0, total: 0 })

  // From running state
  const [selectedRunningProject, setSelectedRunningProject] = useState<RunningProject | null>(null)
  const [generatedCompose, setGeneratedCompose] = useState<string | null>(null)
  const [generatedWarnings, setGeneratedWarnings] = useState<string[]>([])

  // Common state
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [knownStacks, setKnownStacks] = useState<KnownStack[]>([])
  const [existingStackName, setExistingStackName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdDeployments, setCreatedDeployments] = useState<Deployment[]>([])

  // Hooks
  const importDeployment = useImportDeployment()
  const scanComposeDirs = useScanComposeDirs()
  const readComposeFile = useReadComposeFile()
  const generateFromContainers = useGenerateFromContainers()
  const { data: runningProjects, isLoading: isLoadingProjects } = useRunningProjects()
  const { data: hosts } = useHosts()

  // Get containers for selected host to match service names to project names
  const hostContainers = useAllContainers(selectedHostId || undefined)

  // Helper to check if a running project is currently selected
  function isProjectSelected(project: RunningProject): boolean {
    return selectedRunningProject?.project_name === project.project_name &&
           selectedRunningProject?.host_id === project.host_id
  }

  // Filter to show hosts that support directory scanning (local + agent)
  // Remote/mTLS hosts don't have filesystem access
  const scannableHosts = hosts?.filter((h) =>
    h.connection_type === 'agent' || h.connection_type === 'local'
  ) || []

  // Get selected host info
  const selectedHost = scannableHosts.find((h) => h.id === selectedHostId)
  const isLocalHost = selectedHost?.connection_type === 'local'
  const isAgentHost = selectedHost?.connection_type === 'agent'

  // Fetch agent info when an agent host is selected (to check if containerized)
  const { data: agentInfo } = useQuery({
    queryKey: ['host-agent', selectedHostId],
    queryFn: () =>
      apiClient.get<{ is_container_mode: boolean }>(`/hosts/${selectedHostId}/agent`),
    enabled: !!selectedHostId && isAgentHost,
  })

  // Generate dynamic help text based on selected host
  const getScanHelpText = (): string => {
    if (!selectedHostId) {
      return '请选择一个主机以扫描 Compose 文件。'
    }
    if (isLocalHost) {
      return '正在扫描 localhost 。请将 /opt 或 /srv 等路径挂载到 DockMon 容器中，以便扫描功能正常工作。'
    }
    if (!isAgentHost) {
      return '请选择一个主机以扫描 Compose 文件。'
    }
    if (agentInfo?.is_container_mode) {
      return '代理正在 Docker 容器中运行。请将路径挂载到代理所在的容器中，以使扫描功能正常工作。'
    }
    return '代理正在作为系统服务运行。文件扫描功能可用。'
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      setComposeContent(e.target?.result as string)
    }
    reader.readAsText(file)
  }

  // Build a map of service name -> project name from container tags
  // Tags look like "compose:projectname" for containers created by docker compose
  const getProjectNameFromContainers = (services: string[]): string | null => {
    for (const serviceName of services) {
      // Find a container whose name matches the service name
      const container = hostContainers.find((c) => c.name === serviceName)
      if (container?.tags) {
        // Look for a "compose:X" tag
        const composeTag = container.tags.find((t) => t.startsWith('compose:'))
        if (composeTag) {
          return composeTag.replace('compose:', '')
        }
      }
    }
    return null
  }

  const handleScanHost = async () => {
    if (!selectedHostId) {
      setError('请选择一个主机')
      return
    }

    setError(null)
    setComposeFiles([])
    setSelectedFilePath('')
    setSelectedFilePaths(new Set())

    // Parse additional paths (comma or newline separated)
    const extraPaths = additionalPaths
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    try {
      const scanParams: { hostId: string; request?: { paths: string[] } } = {
        hostId: selectedHostId,
      }
      if (extraPaths.length > 0) {
        scanParams.request = { paths: extraPaths }
      }
      const result = await scanComposeDirs.mutateAsync(scanParams)

      if (result.success) {
        // Enrich compose files with project names from running containers
        // Container labels are the source of truth for project names
        const enrichedFiles = result.compose_files.map((file) => {
          if (file.services.length > 0) {
            const projectFromContainer = getProjectNameFromContainers(file.services)
            if (projectFromContainer) {
              return { ...file, project_name: projectFromContainer }
            }
          }
          return file
        })

        setComposeFiles(enrichedFiles)
        if (enrichedFiles.length === 0) {
          setError('未能在扫描的路径中找到 Compose 文件')
        }
      } else {
        setError(result.error || '扫描失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '扫描失败'
      setError(message)
    }
  }

  const handleSelectComposeFile = async (path: string) => {
    setSelectedFilePath(path)
    setError(null)

    const file = composeFiles.find((f) => f.path === path)
    if (!file) return

    // Auto-fetch the compose file content
    try {
      const result = await readComposeFile.mutateAsync({
        hostId: selectedHostId,
        path: path,
      })

      if (result.success) {
        setComposeContent(result.content || '')
        if (result.env_content) {
          setEnvContent(result.env_content)
          setShowEnvField(true)
        }
      } else {
        setError(result.error || '无法读取文件')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法读取文件'
      setError(message)
    }
  }

  // Toggle file selection for batch import
  const toggleFileSelection = useCallback((path: string, checked: boolean) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(path)
      } else {
        next.delete(path)
      }
      return next
    })
  }, [])

  // Select/deselect all files
  const toggleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedFilePaths(new Set(composeFiles.map((f) => f.path)))
    } else {
      setSelectedFilePaths(new Set())
    }
  }, [composeFiles])

  // Batch import selected files
  const handleBatchImport = async () => {
    if (selectedFilePaths.size === 0) {
      setError('请至少选择一个文件以导入')
      return
    }

    setError(null)
    setIsBatchImporting(true)
    setBatchImportProgress({ current: 0, total: selectedFilePaths.size })

    const allDeployments: Deployment[] = []
    const errors: string[] = []
    const paths = Array.from(selectedFilePaths)

    for (const path of paths) {
      setBatchImportProgress((prev) => ({ ...prev, current: prev.current + 1 }))

      // Get file info from scan results (outside try block for access in catch)
      const file = composeFiles.find((f) => f.path === path)
      const displayName = file?.project_name || path

      try {
        // Read the compose file
        const readResult = await readComposeFile.mutateAsync({
          hostId: selectedHostId,
          path: path,
        })

        if (!readResult.success || !readResult.content) {
          errors.push(`${displayName}: ${readResult.error || '读取文件时失败'}`)
          continue
        }

        // Import the stack - use project_name from scan results for stacks without name: field
        const request: ImportDeploymentRequest = {
          compose_content: readResult.content,
        }
        // Always pass host_id for fallback import support
        if (selectedHostId) {
          request.host_id = selectedHostId
        }
        // Pass the project name from scan (directory-based or from compose file)
        if (file?.project_name) {
          request.project_name = file.project_name
        }
        if (readResult.env_content) {
          request.env_content = readResult.env_content
        }

        const result = await importDeployment.mutateAsync(request)

        if (result.success && result.deployments_created) {
          allDeployments.push(...result.deployments_created)
        } else if (result.requires_name_selection) {
          // This shouldn't happen now since we pass project_name, but handle just in case
          errors.push(`${displayName}: 无法确定堆栈名称`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '导入失败'
        errors.push(`${displayName}: ${message}`)
      }
    }

    setIsBatchImporting(false)

    if (allDeployments.length > 0) {
      setCreatedDeployments(allDeployments)
      if (errors.length > 0) {
        setError(`已导入 ${allDeployments.length} 个堆栈。但存在错误: ${errors.join('; ')}`)
      }
      setStep('success')
      onSuccess?.(allDeployments)
    } else if (errors.length > 0) {
      setError(errors.join('; '))
    }
  }

  const handleImport = async (options?: {
    projectName?: string
    hostId?: string
    overwriteStack?: boolean
    useExistingStack?: boolean
    composeContentOverride?: string
  }) => {
    // Use override if provided (for running mode where state update is async)
    const contentToImport = options?.composeContentOverride || composeContent
    if (!contentToImport.trim()) {
      setError('请提供 Compose 文件文本')
      return
    }

    setError(null)

    try {
      // Build request - only include optional fields when they have values
      const request: ImportDeploymentRequest = {
        compose_content: contentToImport,
      }
      if (envContent) request.env_content = envContent
      if (options?.projectName) request.project_name = options.projectName
      if (options?.overwriteStack) request.overwrite_stack = true
      if (options?.useExistingStack) request.use_existing_stack = true

      // Pass host_id from options (running mode) or selected host (browse mode)
      if (options?.hostId) {
        request.host_id = options.hostId
      } else if (method === 'browse' && selectedHostId) {
        request.host_id = selectedHostId
        // Also pass project_name from the selected file if available
        if (selectedFilePath && !options?.projectName) {
          const file = composeFiles.find((f) => f.path === selectedFilePath)
          if (file?.project_name) {
            request.project_name = file.project_name
          }
        }
      }

      const result = await importDeployment.mutateAsync(request)

      if (result.stack_exists && result.existing_stack_name) {
        // Stack already exists - ask user what to do
        setExistingStackName(result.existing_stack_name)
        setStep('stack-exists')
      } else if (result.requires_name_selection) {
        // Compose file has no name: field - show selection UI
        setKnownStacks(result.known_stacks || [])
        setStep('select-name')
      } else if (result.success) {
        // Auto-detected and imported successfully
        setCreatedDeployments(result.deployments_created)
        setStep('success')
        onSuccess?.(result.deployments_created)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败'
      setError(message)
    }
  }

  const handleSelectName = async () => {
    if (!selectedProjectName) {
      setError('请选择一个堆栈名称')
      return
    }
    await handleImport({ projectName: selectedProjectName })
  }

  // Handle selecting a running project and generating compose
  const handleSelectRunningProject = async (project: RunningProject) => {
    setSelectedRunningProject(project)
    setGeneratedCompose(null)
    setGeneratedWarnings([])
    setError(null)

    try {
      const result = await generateFromContainers.mutateAsync({
        project_name: project.project_name,
        host_id: project.host_id,
      })

      setGeneratedCompose(result.compose_yaml)
      setGeneratedWarnings(result.warnings)
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法创建 Compose 文件'
      setError(message)
    }
  }

  // Handle importing the generated compose
  const handleImportFromRunning = async () => {
    if (!selectedRunningProject || !generatedCompose) {
      setError('请先选择一个正在运行的项目')
      return
    }

    // Store compose content for stack-exists flow (may need it later)
    setComposeContent(generatedCompose)

    // Pass content directly to avoid async state timing issues
    await handleImport({
      projectName: selectedRunningProject.project_name,
      hostId: selectedRunningProject.host_id,
      composeContentOverride: generatedCompose,
    })
  }

  const handleClose = () => {
    // Reset form when closing
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setStep('input')
    setMethod('paste')
    setComposeContent('')
    setEnvContent('')
    setShowEnvField(false)
    setSelectedHostId('')
    setAdditionalPaths('')
    setComposeFiles([])
    setSelectedFilePath('')
    setSelectedFilePaths(new Set())
    setIsBatchImporting(false)
    setBatchImportProgress({ current: 0, total: 0 })
    setSelectedRunningProject(null)
    setGeneratedCompose(null)
    setGeneratedWarnings([])
    setSelectedProjectName('')
    setKnownStacks([])
    setExistingStackName(null)
    setError(null)
    setCreatedDeployments([])
  }

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入已有堆栈</DialogTitle>
          <DialogDescription>
            导入现有的 Docker Compose 堆栈到 DockMon 中。
            DockMon 将自动检测哪些主机正在运行该堆栈。
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <fieldset disabled={!canDeploy} className="space-y-4 disabled:opacity-60">
            {/* Method Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setMethod('paste')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  method === 'paste'
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Upload className="h-4 w-4" />
                粘贴 / 上传
              </button>
              <button
                onClick={() => setMethod('browse')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  method === 'browse'
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FolderSearch className="h-4 w-4" />
                主机扫描
              </button>
              <button
                onClick={() => setMethod('running')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  method === 'running'
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Container className="h-4 w-4" />
                已有项目
              </button>
            </div>

            {/* Paste/Upload Content */}
            {method === 'paste' && (
              <>
                {/* Compose Content */}
                <div>
                  <Label htmlFor="compose-content">Compose 文件</Label>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        上传文件
                        <input
                          type="file"
                          accept=".yaml,.yml"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </Button>
                  </div>
                  <Textarea
                    id="compose-content"
                    value={composeContent}
                    onChange={(e) => setComposeContent(e.target.value)}
                    onKeyDown={(e) => {
                      // Allow Tab key to insert spaces instead of moving focus (Issue #126)
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const target = e.target as HTMLTextAreaElement
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        const newValue = composeContent.substring(0, start) + '  ' + composeContent.substring(end)
                        setComposeContent(newValue)
                        requestAnimationFrame(() => {
                          target.selectionStart = target.selectionEnd = start + 2
                        })
                      }
                    }}
                    placeholder="在此处粘贴 docker-compose.yml 的文本内容..."
                    className="font-mono text-sm h-48"
                  />
                </div>

                {/* Optional .env Content */}
                <div>
                  {!showEnvField ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEnvField(true)}
                      className="text-muted-foreground"
                    >
                      + 添加 .env 文本内容 (可选)
                    </Button>
                  ) : (
                    <>
                      <Label htmlFor="env-content">
                        .env 文本内容 (可选)
                      </Label>
                      <Textarea
                        id="env-content"
                        value={envContent}
                        onChange={(e) => setEnvContent(e.target.value)}
                        placeholder="KEY=value"
                        className="font-mono text-sm h-24"
                      />
                    </>
                  )}
                </div>
              </>
            )}

            {/* Browse Host Content */}
            {method === 'browse' && (
              <>
                {/* Host Selection */}
                <div>
                  <Label htmlFor="host-select">选择代理主机</Label>
                  <Select
                    value={selectedHostId}
                    onValueChange={setSelectedHostId}
                  >
                    <SelectTrigger id="host-select">
                      <SelectValue placeholder="选择待扫描的主机...">
                        {selectedHostId
                          ? scannableHosts.find((h) => h.id === selectedHostId)?.name || selectedHostId
                          : '选择待扫描的主机...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {scannableHosts.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          没有可用的代理主机
                        </div>
                      ) : (
                        scannableHosts.map((host) => (
                          <SelectItem key={host.id} value={host.id}>
                            {host.name || host.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Paths (optional) */}
                <div>
                  <Label htmlFor="additional-paths">
                    附加路径 (可选)
                  </Label>
                  <Input
                    id="additional-paths"
                    value={additionalPaths}
                    onChange={(e) => setAdditionalPaths(e.target.value)}
                    placeholder="/custom/path, /another/path"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    除默认路径外需要扫描的额外路径 (多个路径时以英文逗号分隔)
                  </p>
                </div>

                {/* Scan Button */}
                <Button
                  onClick={handleScanHost}
                  disabled={!selectedHostId || scanComposeDirs.isPending}
                  className="w-full gap-2"
                >
                  {scanComposeDirs.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      扫描中...
                    </>
                  ) : (
                    <>
                      <FolderSearch className="h-4 w-4" />
                      扫描 Compose 文件
                    </>
                  )}
                </Button>

                {scannableHosts.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      目录扫描需要提供包含代理的主机。
                      目前暂无已连接的代理主机。
                      请前往 "粘贴/上传" 选项卡手动导入。
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {getScanHelpText()}
                  </p>
                )}

                {/* Compose Files List */}
                {composeFiles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>已发现的 Compose 文件</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={selectedFilePaths.size === composeFiles.length && composeFiles.length > 0}
                          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                          disabled={isBatchImporting}
                        />
                        <label
                          htmlFor="select-all"
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          选择全部 ({composeFiles.length})
                        </label>
                      </div>
                    </div>
                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                      {composeFiles.map((file) => (
                        <div
                          key={file.path}
                          className={cn(
                            'flex items-start gap-3 p-3 hover:bg-muted transition-colors',
                            selectedFilePaths.has(file.path) ? 'bg-muted/50' : ''
                          )}
                        >
                          <Checkbox
                            checked={selectedFilePaths.has(file.path)}
                            onCheckedChange={(checked) => toggleFileSelection(file.path, checked === true)}
                            disabled={isBatchImporting}
                            className="mt-1"
                          />
                          <button
                            onClick={() => handleSelectComposeFile(file.path)}
                            disabled={readComposeFile.isPending || isBatchImporting}
                            className="flex-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-start gap-3">
                              {readComposeFile.isPending && selectedFilePath === file.path ? (
                                <Loader2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 animate-spin" />
                              ) : (
                                <FileCode className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">
                                  {file.project_name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {file.path}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {file.services.length} service(s):{' '}
                                  {file.services.slice(0, 3).join(', ')}
                                  {file.services.length > 3 && '...'}
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compose Content for selected file */}
                {selectedFilePath && composeContent && (
                  <div>
                    <Label htmlFor="browse-compose-content">
                      Compose 文件内容
                    </Label>
                    <Textarea
                      id="browse-compose-content"
                      value={composeContent}
                      onChange={(e) => setComposeContent(e.target.value)}
                      placeholder="Compose 文件内容..."
                      className="font-mono text-sm h-32"
                    />
                  </div>
                )}
              </>
            )}

            {/* From Running Content */}
            {method === 'running' && (
              <>
                <p className="text-sm text-muted-foreground">
                  选择一个正在运行的基于 Docker Compose 创建的项目以导入至 DockMon 堆栈管理。
                  Compose 文件将根据容器当前的状态自动生成。
                </p>

                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : runningProjects && runningProjects.length > 0 ? (
                  <div className="space-y-4">
                    <Label>正在运行的项目</Label>
                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                      {runningProjects.map((project) => {
                        const isSelected = isProjectSelected(project)
                        const isLoading = generateFromContainers.isPending && isSelected
                        const IconComponent = isLoading ? Loader2 : Container
                        return (
                          <button
                            key={`${project.project_name}-${project.host_id}`}
                            onClick={() => handleSelectRunningProject(project)}
                            disabled={generateFromContainers.isPending}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                              isSelected && 'bg-primary/5 border-l-2 border-l-primary'
                            )}
                          >
                            <IconComponent
                              className={cn(
                                'h-5 w-5 text-muted-foreground mt-0.5 shrink-0',
                                isLoading && 'animate-spin'
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm">{project.project_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {project.host_name || project.host_id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {project.container_count} 个容器:{' '}
                                {project.services.slice(0, 3).join(', ')}
                                {project.services.length > 3 && '...'}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      未能发现正在运行的基于 Docker Compose 创建的项目。
                      请确保存在使用标准 Compose 标签 (com.docker.compose.project) 部署的项目，并且正在运行。
                    </AlertDescription>
                  </Alert>
                )}

                {/* Generated Compose Preview */}
                {selectedRunningProject && generatedCompose && (
                  <div className="space-y-2">
                    <Label>生成的 compose.yaml</Label>
                    {generatedWarnings.length > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-500 space-y-1">
                        {generatedWarnings.map((warning, i) => (
                          <p key={i}>注意: {warning}</p>
                        ))}
                      </div>
                    )}
                    <Textarea
                      value={generatedCompose}
                      onChange={(e) => setGeneratedCompose(e.target.value)}
                      className="font-mono text-xs h-[200px] resize-none"
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={importDeployment.isPending || isBatchImporting}
              >
                取消
              </Button>
              {/* Batch import button - shown when files are selected in browse mode */}
              {method === 'browse' && selectedFilePaths.size > 0 && (
                <Button
                  onClick={handleBatchImport}
                  disabled={isBatchImporting}
                >
                  {isBatchImporting
                    ? `导入中 (${batchImportProgress.current}/${batchImportProgress.total})...`
                    : `已导入选择项 (${selectedFilePaths.size})`}
                </Button>
              )}
              {/* Single import button - shown in paste mode or when no files selected in browse mode */}
              {(method === 'paste' || (method === 'browse' && selectedFilePaths.size === 0)) && (
                <Button
                  onClick={() => handleImport()}
                  disabled={importDeployment.isPending || !composeContent.trim()}
                >
                  {importDeployment.isPending ? '导入中...' : '导入堆栈'}
                </Button>
              )}
              {/* Import from running button */}
              {method === 'running' && (
                <Button
                  onClick={handleImportFromRunning}
                  disabled={importDeployment.isPending || !selectedRunningProject || !generatedCompose || !canEdit}
                >
                  {importDeployment.isPending ? '导入中...' : '导入堆栈'}
                </Button>
              )}
            </DialogFooter>
          </fieldset>
        )}

        {step === 'select-name' && (
          <fieldset disabled={!canDeploy} className="space-y-4 disabled:opacity-60">
            <Alert>
              <AlertDescription>
                该 Compose 文件缺失{' '}
                <code className="bg-muted px-1 rounded">name:</code> 字段。
                请选择该 Compose 文件所属的堆栈:
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="stack-select">选择堆栈</Label>
              <Select
                value={selectedProjectName}
                onValueChange={setSelectedProjectName}
              >
                <SelectTrigger id="stack-select">
                  <SelectValue placeholder="请选择一个堆栈..." />
                </SelectTrigger>
                <SelectContent>
                  {knownStacks.map((stack) => (
                    <SelectItem key={stack.name} value={stack.name}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{stack.name}</span>
                        <span className="text-xs text-muted-foreground">
                          主机 {stack.host_names.join(', ')} 中包含 {stack.container_count} 个容器
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {knownStacks.length === 0 && (
              <Alert>
                <AlertDescription>
                  未找到可用的堆栈。请确保存在使用标准的 Compose 标签部署并正在运行的 Docker Compose 堆栈。
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                disabled={importDeployment.isPending}
              >
                返回
              </Button>
              <Button
                onClick={handleSelectName}
                disabled={importDeployment.isPending || !selectedProjectName}
              >
                {importDeployment.isPending ? '导入中...' : '导入堆栈'}
              </Button>
            </DialogFooter>
          </fieldset>
        )}

        {step === 'stack-exists' && existingStackName && (
          <fieldset disabled={!canDeploy} className="space-y-4 disabled:opacity-60">
            <Alert>
              <AlertDescription>
                一个名为 <strong>"{existingStackName}"</strong> 的堆栈已存在于文件系统中。
                你希望如何处理?
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3 gap-3"
                onClick={() => handleImport({
                  useExistingStack: true,
                  // Preserve context from running mode if applicable
                  ...(selectedRunningProject && {
                    hostId: selectedRunningProject.host_id,
                    projectName: selectedRunningProject.project_name,
                  }),
                })}
                disabled={importDeployment.isPending}
              >
                {importDeployment.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
                <div className="text-left">
                  <div className="font-medium">使用现有的堆栈内容</div>
                  <div className="text-sm text-muted-foreground">
                    使用文件系统中的 compose.yaml 文件
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3 gap-3"
                onClick={() => handleImport({
                  overwriteStack: true,
                  // Preserve context from running mode if applicable
                  ...(selectedRunningProject && {
                    hostId: selectedRunningProject.host_id,
                    projectName: selectedRunningProject.project_name,
                  }),
                  // Pass compose content directly for running mode (async state timing)
                  ...(generatedCompose && { composeContentOverride: generatedCompose }),
                })}
                disabled={importDeployment.isPending}
              >
                {importDeployment.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
                <div className="text-left">
                  <div className="font-medium">使用新内容覆盖</div>
                  <div className="text-sm text-muted-foreground">
                    使用导入的内容替换现有的堆栈文件内容
                  </div>
                </div>
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                disabled={importDeployment.isPending}
              >
                返回
              </Button>
            </DialogFooter>
          </fieldset>
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                已成功导入 {createdDeployments.length} 个堆栈
              </AlertDescription>
            </Alert>

            <ul className="list-disc list-inside space-y-1">
              {createdDeployments.map((d) => (
                <li key={d.id}>
                  <span className="font-medium">{d.stack_name}</span> (位于主机{' '}
                  {d.host_name || d.host_id})
                </li>
              ))}
            </ul>

            <DialogFooter>
              <Button onClick={handleClose}>完成</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
