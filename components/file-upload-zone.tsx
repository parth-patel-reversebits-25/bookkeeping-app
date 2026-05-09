'use client'

import { useCallback, useState } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type FileUploadZoneProps = {
  onFilesAccepted: (files: File[]) => void
  accept?: Accept
  maxFiles?: number
  maxSizeMB?: number
  uploading?: boolean
  progress?: number
  label?: string
  description?: string
  className?: string
}

export function FileUploadZone({
  onFilesAccepted,
  accept = { 'application/pdf': ['.pdf'] },
  maxFiles = 1,
  maxSizeMB = 20,
  uploading = false,
  progress = 0,
  label = 'Upload PDF',
  description = 'Drag and drop your PDF here, or click to select',
  className,
}: FileUploadZoneProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setPendingFiles(acceptedFiles)
      onFilesAccepted(acceptedFiles)
    },
    [onFilesAccepted]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize: maxSizeMB * 1024 * 1024,
    disabled: uploading,
  })

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/25',
          uploading && 'cursor-not-allowed opacity-60'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-1 text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max {maxSizeMB}MB {Object.values(accept).flat().join(', ')}
        </p>
      </div>

      {fileRejections.length > 0 && (
        <div className="rounded-md bg-red-50 px-3 py-2">
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-xs text-red-700">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}

      {pendingFiles.length > 0 && !uploading && (
        <div className="space-y-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
            >
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  )
}
