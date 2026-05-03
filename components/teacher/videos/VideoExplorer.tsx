"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Folder, 
  FileVideo, 
  ChevronRight, 
  Search, 
  Loader2, 
  ArrowLeft,
  RefreshCw,
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FolderItem {
  name: string;
  prefix: string;
  type: "FOLDER";
}

interface FileItem {
  name: string;
  key: string;
  url: string;
  size: number;
  type: "FILE";
}

interface VideoExplorerProps {
  onSelect?: (file: FileItem) => void;
  className?: string;
}

export function VideoExplorer({ onSelect, className }: VideoExplorerProps) {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async (prefix: string) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`/api/videos/explorer?prefix=${prefix}`);
      setFolders(res.data.folders);
      setFiles(res.data.files);
      setCurrentPrefix(prefix);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải danh sách file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData("");
  }, [fetchData]);

  const handleFolderClick = (prefix: string) => {
    fetchData(prefix);
  };

  const handleBack = () => {
    if (!currentPrefix) return;
    const parts = currentPrefix.split("/").filter(Boolean);
    parts.pop();
    const parentPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
    fetchData(parentPrefix);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const breadcrumbs = currentPrefix.split("/").filter(Boolean);

  return (
    <div className={cn("flex flex-col h-full bg-white border rounded-xl overflow-hidden shadow-sm", className)}>
      {/* Header / Toolbar */}
      <div className="p-4 border-b bg-gray-50/50 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleBack} 
              disabled={!currentPrefix || isLoading}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 text-sm font-medium text-gray-600 overflow-hidden">
              <button 
                onClick={() => fetchData("")}
                className="hover:text-orange-600 transition-colors flex items-center gap-1 shrink-0"
              >
                <HardDrive className="h-4 w-4" />
                Root
              </button>
              {breadcrumbs.map((part, index) => (
                <div key={index} className="flex items-center gap-1 overflow-hidden">
                  <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                  <button 
                    onClick={() => fetchData(breadcrumbs.slice(0, index + 1).join("/") + "/")}
                    className="hover:text-orange-600 transition-colors truncate max-w-[120px]"
                  >
                    {part}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => fetchData(currentPrefix)} 
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Tìm kiếm thư mục hoặc video..." 
            className="pl-10 h-9 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Explorer List */}
      <div className="flex-1 overflow-y-auto min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p>Đang tải dữ liệu từ Cloud...</p>
          </div>
        ) : (filteredFolders.length === 0 && filteredFiles.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
            <Folder className="h-12 w-12 mb-4 opacity-20" />
            <p>Thư mục này trống</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Folders */}
            {filteredFolders.map((folder) => (
              <div 
                key={folder.prefix}
                onClick={() => handleFolderClick(folder.prefix)}
                className="group flex items-center gap-3 p-3 hover:bg-orange-50 cursor-pointer transition-colors"
              >
                <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <Folder className="h-5 w-5 text-orange-600 fill-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                  <p className="text-xs text-gray-500">Thư mục</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-orange-400" />
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div 
                key={file.key}
                onClick={() => onSelect?.(file)}
                className="group flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <FileVideo className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatSize(file.size)}</span>
                    <span>•</span>
                    <span className="truncate">{file.key}</span>
                  </div>
                </div>
                {onSelect && (
                  <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white hover:bg-blue-700 hover:text-white shrink-0">
                    Chọn
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-50 border-t text-[10px] text-gray-400 flex justify-between">
        <span>{filteredFolders.length} thư mục, {filteredFiles.length} video</span>
        <span>Backblaze B2 S3 API</span>
      </div>
    </div>
  );
}
