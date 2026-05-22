import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CoverUploadProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
}

export function CoverUpload({ value, onChange, folder = "covers" }: CoverUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPEG, PNG ou WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("covers").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-border/60">
          <img src={value} alt="Capa" className="aspect-[9/16] w-full max-w-[140px] object-cover" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute right-1 top-1 h-6 w-6"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          {uploading ? "Enviando..." : value ? "Trocar imagem" : "Enviar JPEG/PNG(1080x1920)"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
