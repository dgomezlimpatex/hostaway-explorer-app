/**
 * Utilidad para probar el sistema de errores móviles
 * Usar desde la consola del navegador en móvil
 */

interface TestError {
  type: 'upload' | 'incident' | 'save' | 'network' | 'general';
  title: string;
  message: string;
  context?: any;
}

const testErrors: TestError[] = [
  {
    type: 'upload',
    title: 'Error de Subida de Foto',
    message: 'No se pudo subir la foto. Archivo muy grande.',
    context: {
      fileName: 'foto_cocina.jpg',
      fileSize: 15728640, // 15MB
      reportId: 'test-report-123'
    }
  },
  {
    type: 'incident',
    title: 'Error al Guardar Incidencia',
    message: 'No se pudo guardar la incidencia. Faltan campos obligatorios.',
    context: {
      incidentType: 'damage',
      reportId: 'test-report-123',
      missingFields: ['description']
    }
  },
  {
    type: 'save',
    title: 'Error al Guardar Reporte',
    message: 'No se pudo guardar el reporte. Problema de conexión.',
    context: {
      reportId: 'test-report-123',
      taskId: 'test-task-456',
      completionPercentage: 85
    }
  },
  {
    type: 'network',
    title: 'Error de Conexión',
    message: 'Sin conexión a internet. Algunos datos se guardarán offline.',
    context: {
      isOnline: false,
      lastSync: '2024-12-17T10:30:00Z'
    }
  }
];

class MobileErrorTester {
  private static instance: MobileErrorTester;
  private errorHandler: any = null;

  static getInstance(): MobileErrorTester {
    if (!MobileErrorTester.instance) {
      MobileErrorTester.instance = new MobileErrorTester();
    }
    return MobileErrorTester.instance;
  }

  setErrorHandler(handler: any) {
    this.errorHandler = handler;
  }

  /**
   * Prueba un error específico por tipo
   */
  testErrorByType(type: 'upload' | 'incident' | 'save' | 'network') {
    const error = testErrors.find(e => e.type === type);
    if (!error) {
      console.log(`❌ No hay error de prueba definido para tipo: ${type}`);
      return;
    }

    this.triggerError(error);
  }

  /**
   * Prueba todos los tipos de error secuencialmente
   */
  testAllErrors() {
    console.log('🧪 Iniciando prueba de todos los errores móviles...');
    
    testErrors.forEach((error, index) => {
      setTimeout(() => {
        console.log(`🧪 Probando error ${index + 1}/${testErrors.length}: ${error.type}`);
        this.triggerError(error);
      }, index * 2000); // 2 segundos entre cada error
    });
  }

  /**
   * Prueba un error de upload específico
   */
  testUploadError(fileName: string = 'test-photo.jpg', fileSize: number = 10485760) {
    this.triggerError({
      type: 'upload',
      title: 'Prueba: Error de Subida',
      message: 'Simulación de error al subir archivo',
      context: {
        fileName,
        fileSize,
        reportId: 'test-' + Date.now(),
        errorType: 'FileTooBigError'
      }
    });
  }

  /**
   * Prueba múltiples errores de forma rápida
   */
  testErrorStorm() {
    console.log('⚡ Iniciando tormenta de errores para prueba de rendimiento...');
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const randomError = testErrors[Math.floor(Math.random() * testErrors.length)];
        this.triggerError({
          ...randomError,
          title: `${randomError.title} #${i + 1}`,
          context: {
            ...randomError.context,
            testId: `storm-${i + 1}`,
            timestamp: new Date().toISOString()
          }
        });
      }, i * 500); // 500ms entre cada error
    }
  }

  private triggerError(error: TestError) {
    if (!this.errorHandler) {
      console.log('❌ Error handler no configurado. Asegúrate de estar en móvil y que la app esté cargada.');
      return;
    }

    const methodName = `add${error.type.charAt(0).toUpperCase() + error.type.slice(1)}Error`;
    const method = this.errorHandler[methodName];
    
    if (typeof method === 'function') {
      method(
        error.title,
        error.message,
        error.context,
        'Prueba desde consola de desarrollador'
      );
      console.log(`✅ Error de prueba disparado: ${error.title}`);
    } else {
      console.log(`❌ Método ${methodName} no encontrado en error handler`);
    }
  }

  /**
   * Limpia todos los errores
   */
  clearAllErrors() {
    if (this.errorHandler && typeof this.errorHandler.clearErrors === 'function') {
      this.errorHandler.clearErrors();
      console.log('🧹 Todos los errores han sido limpiados');
    } else {
      console.log('❌ No se pudo limpiar errores - handler no disponible');
    }
  }

  /**
   * Muestra estadísticas de errores
   */
  showStats() {
    if (this.errorHandler) {
      console.log('📊 Estadísticas de errores:', {
        errorCount: this.errorHandler.errorCount,
        available: 'Errores disponibles para prueba',
        types: testErrors.map(e => e.type)
      });
    } else {
      console.log('❌ Error handler no disponible');
    }
  }

  /**
   * Muestra ayuda de comandos disponibles
   */
  showHelp() {
    console.log(`
🧪 SISTEMA DE PRUEBAS DE ERRORES MÓVILES
═══════════════════════════════════════

📱 Solo funciona en dispositivos móviles

🔥 Comandos disponibles:
━━━━━━━━━━━━━━━━━━━━━━

mobileErrorTester.testUploadError()     - Prueba error de subida
mobileErrorTester.testErrorByType('incident') - Prueba error específico
mobileErrorTester.testAllErrors()       - Prueba todos los errores
mobileErrorTester.testErrorStorm()      - Tormenta de errores
mobileErrorTester.clearAllErrors()      - Limpia errores
mobileErrorTester.showStats()          - Muestra estadísticas
mobileErrorTester.showHelp()           - Muestra esta ayuda

📝 Tipos disponibles: upload, incident, save, network

🎯 Ejemplo de uso:
mobileErrorTester.testErrorByType('upload')
mobileErrorTester.testUploadError('mi_foto.jpg', 5000000)
    `);
  }
}

export const mobileErrorTester = MobileErrorTester.getInstance();

// Hacer disponible globalmente en consola
(window as any).mobileErrorTester = mobileErrorTester;

// Auto-mostrar ayuda cuando se carga
if (typeof window !== 'undefined') {
  console.log('🧪 Sistema de pruebas de errores móviles cargado. Ejecuta mobileErrorTester.showHelp() para ver comandos.');
}