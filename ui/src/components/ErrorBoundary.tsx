/**
 * Error Boundary - Global Error Handling
 *
 * FEATURES:
 * - Catches React rendering errors
 * - Shows user-friendly error UI
 * - Logs errors to console
 * - Provides reset functionality
 *
 * USAGE:
 * Wrap the entire app or specific sections
 */

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10">
                  <AlertCircle className="h-6 w-6 text-danger" />
                </div>
                <div>
                  <CardTitle className="text-danger">
                    我们遇到了一些问题
                  </CardTitle>
                  <CardDescription className="mt-1">
                    发生了意外的错误。请尝试重新加载页面。
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="rounded-lg border border-danger/20 bg-danger/5 p-3">
                  <p className="mb-1 text-sm font-semibold text-danger">
                    错误详情:
                  </p>
                  <pre className="overflow-auto text-xs text-muted-foreground">
                    {this.state.error.message}
                  </pre>
                  {this.state.error.stack && (
                    <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                      {this.state.error.stack.slice(0, 500)}
                    </pre>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  重试
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  刷新
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
