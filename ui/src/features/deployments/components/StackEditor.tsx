/**
 * Stack Editor Component (v2.2.8+)
 *
 * Right panel for viewing and editing stack content:
 * - View/edit compose.yaml and .env files
 * - Rename stacks (inline editing)
 * - Clone and delete stacks
 * - Deploy stacks to hosts
 *
 * Used in the two-column master-detail layout on the Stacks page.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Copy,
  Trash2,
  Pencil,
  Check,
  X,
  FolderOpen,
  Rocket,
  RefreshCw,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  useStack,
  useCreateStack,
  useUpdateStack,
  useRenameStack,
  useDeleteStack,
  useCopyStack,
} from '../hooks/useStacks'
import { useStackAction } from '../hooks/useDeployments'
import type { StackAction } from '../hooks/useDeployments'
import { ConfigurationEditor, ConfigurationEditorHandle } from './ConfigurationEditor'
import { DeploymentProgress } from './DeploymentProgress'
import { validateStackName, MAX_STACK_NAME_LENGTH } from '../types'
import type { DeployedHost } from '../types'
import { handleApiError, getErrorMessage } from '../utils'
import { useAuth } from '@/features/auth/AuthContext'

// Base path for stack storage (matches backend STACKS_DIR)
const STACKS_BASE_PATH = '/app/data/stacks'

type DialogType = 'delete' | 'copy' | 'save-changes' | 'remove-confirm' | null

interface PendingActionState {
  action: StackAction
  removeVolumes: boolean
}

interface StackEditorProps {
  selectedStackName: string | null
  hosts: Array<{ id: string; name: string }>
  deployedTo?: DeployedHost[] | undefined
  onStackChange: (name: string | null) => void
}

export function StackEditor({
  selectedStackName,
  hosts,
  deployedTo,
  onStackChange,
}: StackEditorProps) {
  const { hasCapability } = useAuth()
  const canEdit = hasCapability('stacks.edit')
  const canDeploy = hasCapability('stacks.deploy')
  const canViewEnv = hasCapability('stacks.view_env')

  // Data hooks
  const createStack = useCreateStack()
  const updateStack = useUpdateStack()
  const renameStack = useRenameStack()
  const deleteStack = useDeleteStack()
  const copyStack = useCopyStack()
  const stackAction = useStackAction()

  // Fetch selected stack content
  const { data: selectedStack, isLoading: stackLoading } = useStack(selectedStackName)

  // Editor state
  const [stackName, setStackName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [composeYaml, setComposeYaml] = useState('')
  const [envContent, setEnvContent] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)

  // Track original content for change detection
  const [originalCompose, setOriginalCompose] = useState('')
  const [originalEnv, setOriginalEnv] = useState('')

  // Deploy state
  const [hostId, setHostId] = useState('')

  // Deployment progress state
  const [isDeploying, setIsDeploying] = useState(false)
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null)
  const [deployingHostName, setDeployingHostName] = useState('')
  const [activeAction, setActiveAction] = useState<StackAction>('up')

  // Dialog state
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)
  const [copyDestName, setCopyDestName] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'env'>('compose')

  // Reset to compose if env tab becomes unavailable
  useEffect(() => {
    if (activeTab === 'env' && !canViewEnv) {
      setActiveTab('compose')
    }
  }, [activeTab, canViewEnv])

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Ref to ConfigurationEditor for YAML validation
  const configEditorRef = useRef<ConfigurationEditorHandle>(null)

  // Create mode (no stack selected)
  const isCreateMode = selectedStackName === '__new__'

  // Derived state
  const hasContentChanges = composeYaml !== originalCompose || envContent !== originalEnv
  const hasNameChange = stackName !== originalName && !isCreateMode
  const hasChanges = hasContentChanges || hasNameChange
  const isSubmitting =
    createStack.isPending ||
    updateStack.isPending ||
    renameStack.isPending ||
    deleteStack.isPending ||
    copyStack.isPending ||
    stackAction.isPending

  // Sort hosts alphabetically
  const sortedHosts = useMemo(
    () => [...hosts].sort((a, b) => a.name.localeCompare(b.name)),
    [hosts]
  )

  // Check if selected host already has this stack deployed
  const isRedeploy = useMemo(
    () => hostId && deployedTo?.some((h) => h.host_id === hostId),
    [hostId, deployedTo]
  )

  // Reset form state
  const resetForm = useCallback(() => {
    setStackName('')
    setOriginalName('')
    setComposeYaml('')
    setEnvContent('')
    setOriginalCompose('')
    setOriginalEnv('')
    setHostId('')
    setErrors({})
    setIsEditingName(false)
    setActiveDialog(null)
    setCopyDestName('')
    setActiveTab('compose')
  }, [])

  // Reset when selection changes to null
  useEffect(() => {
    if (!selectedStackName) {
      resetForm()
    }
  }, [selectedStackName, resetForm])

  // Load stack content when selected
  useEffect(() => {
    if (selectedStack) {
      const compose = selectedStack.compose_yaml || ''
      const env = selectedStack.env_content || ''
      setStackName(selectedStack.name)
      setOriginalName(selectedStack.name)
      setComposeYaml(compose)
      setEnvContent(env)
      setOriginalCompose(compose)
      setOriginalEnv(env)
      setErrors({})
      setIsEditingName(false)
    }
  }, [selectedStack])

  // Reset form when switching to create mode
  useEffect(() => {
    if (isCreateMode) {
      resetForm()
    }
  }, [isCreateMode, resetForm])

  // Set default host if only one available
  useEffect(() => {
    if (hosts.length === 1 && !hostId && hosts[0]) {
      setHostId(hosts[0].id)
    }
  }, [hosts, hostId])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (isCreateMode || isEditingName) {
      const nameError = validateStackName(stackName)
      if (nameError) {
        newErrors.name = nameError
      }
    }

    if (!composeYaml.trim()) {
      newErrors.compose = 'Compose YAML 文本为必填项'
    }

    // Validate YAML syntax
    if (configEditorRef.current && composeYaml.trim()) {
      const validation = configEditorRef.current.validate()
      if (!validation.valid) {
        newErrors.compose = validation.error || '无效的 YAML 格式'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async (): Promise<boolean> => {
    if (!validateForm()) return false

    try {
      if (isCreateMode) {
        await createStack.mutateAsync({
          name: stackName.trim(),
          compose_yaml: composeYaml,
          env_content: envContent.trim() || null,
        })
        toast.success(`已成功创建堆栈 "${stackName}"`)
        onStackChange(stackName.trim())
      } else if (selectedStackName) {
        if (hasNameChange) {
          await renameStack.mutateAsync({
            name: originalName,
            new_name: stackName.trim(),
          })
        }

        const targetName = hasNameChange ? stackName.trim() : selectedStackName
        await updateStack.mutateAsync({
          name: targetName,
          compose_yaml: composeYaml,
          env_content: envContent.trim() || null,
        })

        toast.success('堆栈已保存')
        if (hasNameChange) {
          onStackChange(stackName.trim())
        }
      }

      setOriginalName(stackName.trim())
      setOriginalCompose(composeYaml)
      setOriginalEnv(envContent)
      setIsEditingName(false)
      return true
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error)
      if (errorMessage.includes('already exists')) {
        setErrors({ name: '已存在同名的堆栈' })
      } else {
        handleApiError(error, '保存')
      }
      return false
    }
  }

  // Delete stack
  const handleDelete = async () => {
    if (!selectedStackName || selectedStackName === '__new__') return

    try {
      await deleteStack.mutateAsync(selectedStackName)
      toast.success(`已成功删除堆栈 "${selectedStackName}"`)
      onStackChange(null)
      resetForm()
    } catch (error: unknown) {
      handleApiError(error, '删除')
    } finally {
      setActiveDialog(null)
    }
  }

  // Copy stack
  const handleCopy = async () => {
    if (!selectedStackName || !copyDestName.trim()) return

    const validationError = validateStackName(copyDestName.trim())
    if (validationError) {
      toast.error(validationError)
      return
    }

    try {
      await copyStack.mutateAsync({
        name: selectedStackName,
        dest_name: copyDestName.trim(),
      })
      toast.success(`堆栈已克隆为 "${copyDestName}"`)
      onStackChange(copyDestName.trim())
    } catch (error: unknown) {
      handleApiError(error, '克隆')
    } finally {
      setActiveDialog(null)
      setCopyDestName('')
    }
  }

  // Execute stack action and switch to progress view
  const executeDeployment = async (
    deployStackName: string,
    action: StackAction = 'up',
    removeVolumes = false,
  ) => {
    const host = sortedHosts.find((h) => h.id === hostId)
    const hostName = host?.name || hostId.slice(0, 8)

    try {
      const result = await stackAction.mutateAsync({
        stack_name: deployStackName,
        host_id: hostId,
        action,
        remove_volumes: removeVolumes,
      })

      setActiveAction(action)
      setActiveDeploymentId(result.deployment_id)
      setDeployingHostName(hostName)
      setIsDeploying(true)
    } catch (error: unknown) {
      const actionLabel = { down: '停止', restart: '重启', up: '部署' }[action]
      handleApiError(error, actionLabel)
    }
  }

  // Execute a stack action with unsaved-changes check and remove confirmation
  const handleAction = async (action: StackAction = 'up', removeVolumes = false) => {
    if (!selectedStackName || selectedStackName === '__new__' || !hostId) return

    if (hasChanges) {
      setPendingAction({ action, removeVolumes })
      setActiveDialog('save-changes')
      return
    }

    // Destructive remove always requires confirmation
    if (removeVolumes) {
      setActiveDialog('remove-confirm')
      return
    }

    await executeDeployment(selectedStackName, action, removeVolumes)
  }

  // Deploy stack (convenience for deploy button)
  const handleDeploy = () => handleAction('up')

  // Save changes, then either show remove-confirm dialog or execute the pending action
  const handleSaveAndDeploy = async () => {
    const actionToExecute = pendingAction ?? { action: 'up' as StackAction, removeVolumes: false }
    setActiveDialog(null)
    setPendingAction(null)
    const saved = await handleSave()
    if (!saved || !selectedStackName || !hostId) return
    // Destructive remove requires confirmation even after saving
    if (actionToExecute.removeVolumes) {
      setActiveDialog('remove-confirm')
      return
    }
    const deployStackName = hasNameChange ? stackName.trim() : selectedStackName
    await executeDeployment(deployStackName, actionToExecute.action, actionToExecute.removeVolumes)
  }

  // Name editing handlers
  const startEditingName = () => setIsEditingName(true)

  const cancelEditingName = () => {
    setStackName(originalName)
    setIsEditingName(false)
    setErrors({})
  }

  const confirmNameEdit = () => {
    const error = validateStackName(stackName)
    if (error) {
      setErrors({ name: error })
      return
    }
    setIsEditingName(false)
  }

  // Open clone dialog
  const handleOpenCloneDialog = () => {
    setCopyDestName(`${selectedStackName}-copy`)
    setActiveDialog('copy')
  }

  // Reset deployment progress state (used by both back and complete actions)
  const resetDeploymentState = () => {
    setIsDeploying(false)
    setActiveDeploymentId(null)
    setDeployingHostName('')
    setActiveAction('up')
  }

  // Determine save button text
  const getSaveButtonText = (): string => {
    if (isSubmitting) return '保存中...'
    if (isCreateMode) return '创建堆栈'
    return '保存'
  }

  // No stack selected - show placeholder
  if (!selectedStackName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>请从列表中选择一个堆栈</p>
        <p className="text-sm mt-1">或者创建一个新的</p>
      </div>
    )
  }

  // Show deployment progress
  if (isDeploying) {
    return (
      <DeploymentProgress
        deploymentId={activeDeploymentId}
        stackName={stackName || selectedStackName || ''}
        hostName={deployingHostName}
        action={activeAction}
        onBack={resetDeploymentState}
        onComplete={resetDeploymentState}
      />
    )
  }

  // Loading state
  if (stackLoading && !isCreateMode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载堆栈数据中...
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Stack name header */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          {isEditingName || isCreateMode ? (
            <fieldset disabled={!canEdit} className="flex-1 flex items-center gap-2 disabled:opacity-60">
              <Input
                value={stackName}
                onChange={(e) => setStackName(e.target.value.toLowerCase())}
                placeholder="stack-name"
                className={cn('font-mono', errors.name && 'border-destructive')}
                maxLength={MAX_STACK_NAME_LENGTH}
                autoFocus
              />
              {!isCreateMode && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={confirmNameEdit}
                    title="确认"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEditingName}
                    title="取消"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </fieldset>
          ) : (
            <>
              <h3 className="font-semibold text-lg font-mono">{stackName}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={startEditingName}
                disabled={!canEdit}
                title="重命名"
                className="ml-1"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
            </>
          )}

          {hasChanges && <Badge variant="secondary">修改</Badge>}
        </div>

        {/* Deployed hosts info */}
        {!isCreateMode && deployedTo && deployedTo.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 shrink-0">
            <span>部署于:</span>
            <div className="flex flex-wrap gap-1">
              {deployedTo.map((host) => (
                <Badge key={host.host_id} variant="outline" className="font-normal">
                  {host.host_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {errors.name && (
          <p className="text-sm text-destructive mb-2 shrink-0">{errors.name}</p>
        )}

        {/* File path info (edit mode only) */}
        {!isCreateMode && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground mb-3 shrink-0">
            <FolderOpen className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="font-mono">
              {STACKS_BASE_PATH}/{hasNameChange ? stackName : originalName}/
              {hasNameChange && (
                <span className="text-amber-500 ml-1">(将被重命名)</span>
              )}
            </span>
          </div>
        )}

        {/* Content editor with tabs */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Tab buttons */}
          <div className="flex gap-1 mb-2 shrink-0">
            <Button
              type="button"
              variant={activeTab === 'compose' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('compose')}
            >
              Compose 文件
            </Button>
            {canViewEnv && (
              <Button
                type="button"
                variant={activeTab === 'env' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('env')}
              >
                环境变量
              </Button>
            )}
          </div>

          {/* Tab content */}
          <fieldset disabled={!canEdit} className="flex-1 min-h-0 flex flex-col disabled:opacity-60">
            {activeTab === 'compose' && (
              <ConfigurationEditor
                ref={configEditorRef}
                type="stack"
                value={composeYaml}
                onChange={setComposeYaml}
                error={errors.compose}
                fillHeight
              />
            )}

            {canViewEnv && activeTab === 'env' && (
              <ConfigurationEditor
                type="env"
                value={envContent}
                onChange={setEnvContent}
                fillHeight
              />
            )}
          </fieldset>
        </div>

        {/* Deploy section (only for existing stacks) */}
        {!isCreateMode && (
          <fieldset disabled={!canDeploy} className="pt-3 mt-3 border-t shrink-0 disabled:opacity-60">
            <Label className="text-sm font-medium mb-2 block">部署至主机</Label>
            <div className="flex gap-2">
              <Select value={hostId} onValueChange={setHostId}>
                <SelectTrigger className="min-w-[250px] flex-1">
                  <SelectValue placeholder="Select a host">
                    {hostId && (sortedHosts.find((h) => h.id === hostId)?.name || hostId)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortedHosts.length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">
                      暂无可用的主机
                    </div>
                  ) : (
                    sortedHosts.map((host) => (
                      <SelectItem key={host.id} value={host.id}>
                        {host.name || host.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleDeploy}
                disabled={!hostId || isSubmitting}
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                {isRedeploy ? '重新部署' : '立即部署'}
              </Button>
              {isRedeploy && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('restart')}
                    disabled={!hostId || isSubmitting}
                    className="gap-2"
                    title="重启堆栈 (先停止容器再启动，不会重新拉取镜像)"
                  >
                    <RefreshCw className="h-4 w-4" />
                    重启
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('down')}
                    disabled={!hostId || isSubmitting}
                    className="gap-2"
                    title="停止并删除容器和使用的网络"
                  >
                    <Square className="h-4 w-4" />
                    停止
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('down', true)}
                    disabled={!hostId || isSubmitting}
                    className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                    title="停止并删除容器、网络和卷"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                </>
              )}
            </div>
          </fieldset>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t shrink-0">
          <fieldset disabled={!canEdit} className="flex items-center gap-1 disabled:opacity-60">
            {!isCreateMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCloneDialog}
                  disabled={isSubmitting}
                  title="创建堆栈副本"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  克隆
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveDialog('delete')}
                  disabled={isSubmitting}
                  title="删除堆栈"
                >
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                  删除
                </Button>
              </>
            )}
          </fieldset>

          <fieldset disabled={!canEdit} className="disabled:opacity-60">
            <Button
              onClick={handleSave}
              disabled={isSubmitting || (!isCreateMode && !hasChanges)}
            >
              {getSaveButtonText()}
            </Button>
          </fieldset>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={activeDialog === 'delete'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除堆栈</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除堆栈 "<strong>{selectedStackName}</strong>" 吗?
              这将从文件系统中删除 compose.yaml 和 .env 文件，以及所有的部署记录。
              正在运行的容器不会受到影响。
              该操作将无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <fieldset disabled={!canEdit} className="disabled:opacity-60">
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </fieldset>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy Dialog */}
      <Dialog
        open={activeDialog === 'copy'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>克隆堆栈</DialogTitle>
            <DialogDescription>
              创建一个 "<strong>{selectedStackName}</strong>" 堆栈的副本，使用指定的新名称。
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="copy-dest-name">新堆栈名</Label>
                <Input
                  id="copy-dest-name"
                  value={copyDestName}
                  onChange={(e) => setCopyDestName(e.target.value.toLowerCase())}
                  placeholder="my-stack-copy"
                  className="font-mono"
                  maxLength={MAX_STACK_NAME_LENGTH}
                />
                <p className="text-xs text-muted-foreground">
                  仅允许使用小写字母、数字、连字符和下划线
                </p>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActiveDialog(null)}>
              取消
            </Button>
            <fieldset disabled={!canEdit} className="disabled:opacity-60">
              <Button onClick={handleCopy} disabled={!copyDestName.trim() || isSubmitting}>
                {isSubmitting ? '克隆中...' : '克隆堆栈'}
              </Button>
            </fieldset>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog
        open={activeDialog === 'remove-confirm'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除堆栈</AlertDialogTitle>
            <AlertDialogDescription>
              确定要从 <strong>{sortedHosts.find((h) => h.id === hostId)?.name || hostId}</strong>
              中移除堆栈 "<strong>{selectedStackName}</strong>" 吗?
              这将停止并删除所有的容器、网络以及<strong>卷</strong>。
              存储在卷中的数据将永久删除。该操作将无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setActiveDialog(null)
                executeDeployment(selectedStackName, 'down', true)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Changes Before Deploy */}
      <AlertDialog
        open={activeDialog === 'save-changes'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>在部署前保存修改?</AlertDialogTitle>
            <AlertDialogDescription>
              在此堆栈中存在尚未保存的文本修改。你希望在部署前先保存它们吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <fieldset disabled={!canEdit || !canDeploy} className="disabled:opacity-60">
              <AlertDialogAction onClick={handleSaveAndDeploy}>
                保存 & 部署
              </AlertDialogAction>
            </fieldset>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
