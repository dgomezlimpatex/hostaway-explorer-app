/**
 * Utilidad para limpiar memory leaks de MediaCapture en móviles
 */

class MediaCleanupService {
  private static instance: MediaCleanupService;
  private urlReferences = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  static getInstance(): MediaCleanupService {
    if (!MediaCleanupService.instance) {
      MediaCleanupService.instance = new MediaCleanupService();
    }
    return MediaCleanupService.instance;
  }

  /**
   * Registra una URL creada con createObjectURL para limpieza automática
   */
  registerUrl(url: string, autoCleanupMs = 300000): void { // 5 min por defecto
    this.urlReferences.add(url);
    
    // Auto-limpieza después del tiempo especificado
    const timer = setTimeout(() => {
      this.revokeUrl(url);
    }, autoCleanupMs);
    
    this.timers.set(url, timer);
    
    console.log('📱 MediaCleanup: URL registered:', url);
  }

  /**
   * Revoca una URL específica
   */
  revokeUrl(url: string): boolean {
    if (!this.urlReferences.has(url)) return false;

    try {
      URL.revokeObjectURL(url);
      this.urlReferences.delete(url);
      
      // Limpiar timer si existe
      const timer = this.timers.get(url);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(url);
      }
      
      console.log('🧹 MediaCleanup: URL revoked successfully:', url);
      return true;
    } catch (error) {
      console.warn('⚠️ MediaCleanup: Error revoking URL:', url, error);
      return false;
    }
  }

  /**
   * Limpia todas las URLs registradas
   */
  revokeAllUrls(): void {
    const urls = Array.from(this.urlReferences);
    console.log(`🧹 MediaCleanup: Revoking ${urls.length} URLs`);
    
    urls.forEach(url => this.revokeUrl(url));
    
    // Limpiar todos los timers restantes
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * Obtiene estadísticas de memoria
   */
  getStats(): { activeUrls: number; activeTimers: number } {
    return {
      activeUrls: this.urlReferences.size,
      activeTimers: this.timers.size
    };
  }
}

// Hook para usar en componentes React
export const useMediaCleanup = () => {
  const cleanup = MediaCleanupService.getInstance();
  
  return {
    registerUrl: (url: string, autoCleanupMs?: number) => cleanup.registerUrl(url, autoCleanupMs),
    revokeUrl: (url: string) => cleanup.revokeUrl(url),
    revokeAll: () => cleanup.revokeAllUrls(),
    getStats: () => cleanup.getStats()
  };
};

export const mediaCleanupService = MediaCleanupService.getInstance();