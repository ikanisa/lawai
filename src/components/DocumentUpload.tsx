import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "completed" | "error";
  progress: number;
}

interface DocumentUploadProps {
  onUpload?: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  className?: string;
}

export function DocumentUpload({ 
  onUpload, 
  acceptedTypes = [".pdf", ".docx", ".txt"], 
  maxFiles = 5,
  className 
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    simulateUpload(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    simulateUpload(selectedFiles);
  }, []);

  const simulateUpload = (newFiles: File[]) => {
    const uploadFiles: UploadedFile[] = newFiles.slice(0, maxFiles - files.length).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading" as const,
      progress: 0
    }));

    setFiles(prev => [...prev, ...uploadFiles]);

    // Simulate upload progress
    uploadFiles.forEach(file => {
      const interval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === file.id) {
            const newProgress = Math.min(f.progress + Math.random() * 30, 100);
            const newStatus = newProgress === 100 ? "completed" : "uploading";
            return { ...f, progress: newProgress, status: newStatus };
          }
          return f;
        }));
      }, 200);

      setTimeout(() => clearInterval(interval), 3000);
    });

    onUpload?.(newFiles);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <Card 
        className={cn(
          "glass-surface border-2 border-dashed transition-all duration-200",
          isDragging ? "border-primary bg-primary/5" : "border-glass-border"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
      >
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className={cn(
              "mx-auto rounded-full p-4 transition-colors",
              isDragging ? "bg-primary/10" : "bg-muted/50"
            )}>
              <Upload className={cn(
                "h-8 w-8",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Déposez vos documents ici
              </h3>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner des fichiers
              </p>
              <p className="text-xs text-muted-foreground">
                Formats acceptés: {acceptedTypes.join(", ")} • Max {maxFiles} fichiers
              </p>
            </div>

            <input
              type="file"
              multiple
              accept={acceptedTypes.join(",")}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileText className="h-4 w-4" />
                Sélectionner des fichiers
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id} className="glass-surface">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {file.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : file.status === "error" ? (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      {file.status === "uploading" && (
                        <>
                          <div className="flex-1">
                            <Progress value={file.progress} className="h-1" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(file.progress)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}