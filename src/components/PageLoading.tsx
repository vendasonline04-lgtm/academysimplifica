export function PageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <div className="h-6 w-6 rounded-full gradient-primary shadow-glow" />
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Carregando a página...
      </p>
    </div>
  );
}
