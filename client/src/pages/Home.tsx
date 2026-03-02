import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Download, Music, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { getLoginUrl, isAuthConfigured } from "@/const";
import { toast } from "sonner";

type ConversionState = "idle" | "validating" | "downloading" | "converting" | "success" | "error";

const stateMessages: Record<ConversionState, string> = {
  idle: "Listo para convertir",
  validating: "Analizando...",
  downloading: "Descargando...",
  converting: "Convirtiendo...",
  success: "¡Conversión completada!",
  error: "Error en la conversión",
};

const stateProgress: Record<ConversionState, number> = {
  idle: 0,
  validating: 25,
  downloading: 50,
  converting: 75,
  success: 100,
  error: 0,
};

function getDownloadFilename(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/i);
  return match?.[1] || `youtube_audio_${Date.now()}.mp3`;
}

async function downloadMp3(url: string): Promise<void> {
  const response = await fetch(`/api/download-mp3?url=${encodeURIComponent(url)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = "Error durante la conversión a MP3";

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        errorMessage = payload.error;
      }
    } catch {
      // Ignore malformed error bodies and keep the generic message.
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = getDownloadFilename(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export default function Home() {
  const authEnabled = isAuthConfigured();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [url, setUrl] = useState("");
  const [conversionState, setConversionState] = useState<ConversionState>("idle");
  const [urlError, setUrlError] = useState<string | null>(null);

  const validateUrlMutation = trpc.converter.validateUrl.useMutation();
  const historyQuery = trpc.converter.history.useQuery(undefined, {
    enabled: authEnabled && isAuthenticated,
  });

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError(null);
  };

  const handleValidateAndConvert = async () => {
    if (!url.trim()) {
      setUrlError("Por favor ingresa una URL de YouTube");
      return;
    }

    try {
      setConversionState("validating");

      // Validate URL
      const validationResult = await validateUrlMutation.mutateAsync({ url });

      if (!validationResult.valid) {
        setUrlError(validationResult.error || "URL inválida");
        setConversionState("error");
        toast.error(validationResult.error || "URL inválida");
        setTimeout(() => setConversionState("idle"), 2000);
        return;
      }

      // Start conversion
      setConversionState("downloading");
      const convertingTimer = window.setTimeout(() => {
        setConversionState((current) =>
          current === "downloading" ? "converting" : current
        );
      }, 600);

      try {
        await downloadMp3(url);
      } finally {
        window.clearTimeout(convertingTimer);
      }

      setConversionState("success");
      toast.success("¡Conversión completada exitosamente!");
      setUrl("");
      historyQuery.refetch();
      setTimeout(() => setConversionState("idle"), 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setUrlError(errorMessage);
      setConversionState("error");
      toast.error(errorMessage);
      setTimeout(() => setConversionState("idle"), 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && conversionState === "idle") {
      handleValidateAndConvert();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin">
          <Music className="w-12 h-12 text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">YouTube to MP3</h1>
          </div>
          <div>
            {!authEnabled ? (
              <span className="text-sm text-slate-600">Modo local</span>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{user?.name}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => (window.location.href = "/api/auth/logout")}
                >
                  Salir
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => (window.location.href = getLoginUrl())}>
                Iniciar sesión
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-slate-900 mb-4 leading-tight">
            Convierte tus videos de YouTube a MP3
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Descarga la música de tus videos favoritos en alta calidad. Rápido,
            seguro y completamente gratis.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Main Converter Card */}
          <div className="lg:col-span-2">
            <Card className="p-8 shadow-lg border-0 bg-white">
              <div className="space-y-6">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">
                    URL de YouTube
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={conversionState !== "idle"}
                        className={`h-12 text-base ${
                          urlError ? "border-red-500 focus:ring-red-500" : ""
                        }`}
                      />
                    </div>
                    <Button
                      onClick={handleValidateAndConvert}
                      disabled={
                        conversionState !== "idle" ||
                        !url.trim() ||
                        validateUrlMutation.isPending
                      }
                      size="lg"
                      className="px-8 bg-blue-600 hover:bg-blue-700"
                    >
                      {conversionState === "idle" ? "Convertir" : "Procesando..."}
                    </Button>
                  </div>
                  {urlError && (
                    <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {urlError}
                    </div>
                  )}
                </div>

                {/* Progress Section */}
                {conversionState !== "idle" && (
                  <div className="space-y-4 pt-6 border-t border-slate-200">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-900">
                          {stateMessages[conversionState]}
                        </span>
                        <span className="text-sm font-semibold text-blue-600">
                          {stateProgress[conversionState]}%
                        </span>
                      </div>
                      <Progress
                        value={stateProgress[conversionState]}
                        className="h-2"
                      />
                    </div>

                    {/* Status Icon */}
                    <div className="flex justify-center pt-4">
                      {conversionState === "success" && (
                        <div className="flex flex-col items-center gap-3">
                          <CheckCircle2 className="w-12 h-12 text-green-500" />
                          <p className="text-green-600 font-semibold">
                            ¡Listo para descargar!
                          </p>
                        </div>
                      )}
                      {conversionState === "error" && (
                        <div className="flex flex-col items-center gap-3">
                          <AlertCircle className="w-12 h-12 text-red-500" />
                          <p className="text-red-600 font-semibold">
                            Error en la conversión
                          </p>
                        </div>
                      )}
                      {["validating", "downloading", "converting"].includes(
                        conversionState
                      ) && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Info Cards */}
          <div className="space-y-4">
            <Card className="p-6 border-0 bg-white shadow-lg">
              <div className="flex items-start gap-4">
                <Download className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Rápido</h3>
                  <p className="text-sm text-slate-600">
                    Conversión instantánea sin esperas
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 border-0 bg-white shadow-lg">
              <div className="flex items-start gap-4">
                <Music className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Alta Calidad</h3>
                  <p className="text-sm text-slate-600">
                    MP3 a 192 kbps para mejor sonido
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 border-0 bg-white shadow-lg">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Seguro</h3>
                  <p className="text-sm text-slate-600">
                    Sin anuncios ni software malicioso
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* History Section */}
        {isAuthenticated && historyQuery.data && historyQuery.data.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Conversiones Recientes
            </h3>
            <div className="grid gap-4">
              {historyQuery.data.slice(0, 5).map((conversion) => (
                <Card
                  key={conversion.id}
                  className="p-4 border-0 bg-white shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">
                        {conversion.videoTitle || "Video sin título"}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {new Date(conversion.createdAt).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {conversion.status === "success" && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {conversion.status === "failed" && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      {conversion.status === "pending" && (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
