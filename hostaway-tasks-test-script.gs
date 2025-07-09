// ===== CONFIGURACIÓN =====
const CLIENT_ID = '1e07f5f07bbd52575d7c160ce1914c578ef52f1105e1d585e7b498a78591ba0e';
const CLIENT_SECRET = 'af86224c17972de17f65d5336352f3749d647ff9116a670606d95339d9eded08';
const BASE_URL = 'https://api.hostaway.com/v1';

// ===== FUNCIÓN PRINCIPAL =====
function testHostawayTasksAPI() {
  try {
    console.log('🚀 Iniciando prueba de API de tareas de Hostaway...');
    
    // 1. Verificar formato de credenciales
    verifyCredentials();
    
    // 2. Probar diferentes scopes
    testDifferentScopes();
    
    // 3. Intentar autenticación en diferentes entornos
    const token = getHostawayTokenBothEnvironments();
    
    if (token) {
      console.log('✅ Token obtenido correctamente');
      testTaskEndpoints(token);
      console.log('✅ Prueba completada. Revisa las hojas creadas.');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    SpreadsheetApp.getActiveSpreadsheet().toast('Error: ' + error.message, 'Error', 10);
  }
}

// ===== VERIFICACIÓN DE CREDENCIALES =====
function verifyCredentials() {
  console.log('🔍 Verificando formato de credenciales...');
  
  // Verificar que las credenciales no estén vacías
  if (!CLIENT_ID || CLIENT_ID.length < 10) {
    throw new Error('CLIENT_ID parece inválido o muy corto');
  }
  
  if (!CLIENT_SECRET || CLIENT_SECRET.length < 10) {
    throw new Error('CLIENT_SECRET parece inválido o muy corto');
  }
  
  // Verificar formato hexadecimal típico de Hostaway
  const hexPattern = /^[a-f0-9]+$/i;
  if (!hexPattern.test(CLIENT_ID)) {
    console.log('⚠️ CLIENT_ID no parece estar en formato hexadecimal estándar');
  }
  
  if (!hexPattern.test(CLIENT_SECRET)) {
    console.log('⚠️ CLIENT_SECRET no parece estar en formato hexadecimal estándar');
  }
  
  console.log('✅ Credenciales verificadas');
  console.log('📋 CLIENT_ID longitud:', CLIENT_ID.length);
  console.log('📋 CLIENT_SECRET longitud:', CLIENT_SECRET.length);
}

// ===== PRUEBA DE DIFERENTES SCOPES =====
function testDifferentScopes() {
  console.log('🎯 Probando diferentes scopes...');
  
  const scopes = [
    'general',
    'tasks',
    'tasks:read',
    'listings',
    'reservations',
    'general tasks',
    'general tasks:read'
  ];
  
  for (const scope of scopes) {
    console.log(`🔍 Probando scope: "${scope}"`);
    
    try {
      const result = testSingleScope(scope);
      if (result) {
        console.log(`✅ Scope "${scope}" funcionó!`);
        return scope; // Retornar el primer scope que funcione
      }
    } catch (error) {
      console.log(`❌ Scope "${scope}" falló: ${error.message}`);
    }
  }
  
  console.log('⚠️ Ningún scope funcionó individualmente');
}

function testSingleScope(scope) {
  const authUrl = 'https://api.hostaway.com/v1/oauth/token';
  
  const options = {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-control': 'no-cache'
    },
    'payload': `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=${encodeURIComponent(scope)}`,
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(authUrl, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode === 200) {
    const data = JSON.parse(response.getContentText());
    return data.access_token;
  }
  
  return null;
}

// ===== AUTENTICACIÓN EN MÚLTIPLES ENTORNOS =====
function getHostawayTokenBothEnvironments() {
  console.log('🌍 Probando autenticación en múltiples entornos...');
  
  const environments = [
    {
      name: 'Producción',
      baseUrl: 'https://api.hostaway.com/v1',
      authUrl: 'https://api.hostaway.com/v1/oauth/token'
    },
    {
      name: 'Producción alternativo',
      baseUrl: 'https://api.hostaway.com/v1',
      authUrl: 'https://api.hostaway.com/oauth/token'
    },
    {
      name: 'Sandbox',
      baseUrl: 'https://api-sandbox.hostaway.com/v1',
      authUrl: 'https://api-sandbox.hostaway.com/v1/oauth/token'
    },
    {
      name: 'Sandbox alternativo',
      baseUrl: 'https://api-sandbox.hostaway.com/v1',
      authUrl: 'https://api-sandbox.hostaway.com/oauth/token'
    },
    {
      name: 'Staging',
      baseUrl: 'https://api-staging.hostaway.com/v1',
      authUrl: 'https://api-staging.hostaway.com/v1/oauth/token'
    }
  ];
  
  const scopes = ['general', 'tasks', 'general tasks'];
  
  for (const env of environments) {
    console.log(`🏗️ Probando entorno: ${env.name}`);
    
    for (const scope of scopes) {
      try {
        const token = attemptAuthentication(env.authUrl, scope);
        if (token) {
          console.log(`✅ Éxito en ${env.name} con scope "${scope}"`);
          
          // Actualizar BASE_URL global si es diferente
          if (env.baseUrl !== BASE_URL) {
            console.log(`🔄 Actualizando BASE_URL a: ${env.baseUrl}`);
            // No podemos cambiar const, pero lo registramos
          }
          
          return token;
        }
      } catch (error) {
        console.log(`❌ ${env.name} con "${scope}": ${error.message}`);
      }
    }
  }
  
  // Si nada funciona, intentar autenticación básica
  console.log('🔐 Intentando autenticación básica como último recurso...');
  try {
    return getHostawayTokenBasicAuth();
  } catch (error) {
    console.log(`❌ Autenticación básica también falló: ${error.message}`);
  }
  
  throw new Error('No se pudo autenticar en ningún entorno con ningún método');
}

function attemptAuthentication(authUrl, scope) {
  const options = {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-control': 'no-cache'
    },
    'payload': `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=${encodeURIComponent(scope)}`,
    'muteHttpExceptions': true
  };
  
  console.log(`🔑 Intentando: ${authUrl} con scope "${scope}"`);
  
  const response = UrlFetchApp.fetch(authUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log(`📡 Código: ${responseCode}`);
  
  if (responseCode === 200) {
    const data = JSON.parse(responseText);
    if (data.access_token) {
      return data.access_token;
    }
  }
  
  console.log(`📄 Respuesta: ${responseText}`);
  throw new Error(`HTTP ${responseCode}: ${responseText}`);
}

// ===== AUTENTICACIÓN BÁSICA (FALLBACK) =====
function getHostawayTokenBasicAuth() {
  const authUrls = [
    'https://api.hostaway.com/v1/accessTokens',
    'https://api.hostaway.com/v1/access_tokens',
    'https://api-sandbox.hostaway.com/v1/accessTokens'
  ];
  
  const credentials = Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET);
  
  for (const authUrl of authUrls) {
    try {
      const options = {
        'method': 'POST',
        'headers': {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-control': 'no-cache'
        },
        'payload': 'grant_type=client_credentials&scope=general',
        'muteHttpExceptions': true
      };
      
      console.log(`🔑 Probando autenticación básica en: ${authUrl}`);
      
      const response = UrlFetchApp.fetch(authUrl, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      console.log(`📡 Código: ${responseCode}`);
      
      if (responseCode === 200) {
        const data = JSON.parse(responseText);
        if (data.access_token) {
          return data.access_token;
        }
      }
      
      console.log(`📄 Respuesta: ${responseText}`);
      
    } catch (error) {
      console.log(`❌ Error en ${authUrl}: ${error.message}`);
    }
  }
  
  throw new Error('Autenticación básica falló en todas las URLs');
}

// ===== PRUEBAS DE ENDPOINTS =====
function testTaskEndpoints(token) {
  console.log('🔍 Token recibido:', token ? 'SÍ' : 'NO');
  console.log('🔍 Longitud del token:', token ? token.length : 0);
  
  if (!token) {
    console.error('❌ No hay token disponible');
    return;
  }
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Probar endpoints en orden de importancia
  console.log('🧪 Iniciando pruebas de endpoints...');
  
  try {
    testTaskTypes(token, spreadsheet);
  } catch (error) {
    console.log('⚠️ Error en tipos de tareas:', error.message);
  }
  
  try {
    testTaskStatuses(token, spreadsheet);
  } catch (error) {
    console.log('⚠️ Error en estados de tareas:', error.message);
  }
  
  try {
    testRecentTasks(token, spreadsheet);
  } catch (error) {
    console.log('⚠️ Error en tareas recientes:', error.message);
  }
  
  try {
    testTaskFilters(token, spreadsheet);
  } catch (error) {
    console.log('⚠️ Error en filtros de tareas:', error.message);
  }
}

// ===== TIPOS DE TAREAS =====
function testTaskTypes(token, spreadsheet) {
  console.log('📋 Probando endpoint de tipos de tareas...');
  
  const url = `${BASE_URL}/taskTypes`;
  const response = makeAuthenticatedRequest(url, token);
  
  if (response && response.result) {
    const sheet = createOrGetSheet(spreadsheet, 'Tipos de Tareas');
    
    // Headers
    const headers = ['ID', 'Nombre', 'Descripción', 'Color', 'Activo'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Data
    const data = response.result.map(taskType => [
      taskType.id || '',
      taskType.name || '',
      taskType.description || '',
      taskType.color || '',
      taskType.isActive || false
    ]);
    
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, headers.length).setValues(data);
    }
    
    console.log(`✅ ${data.length} tipos de tareas encontrados`);
  }
}

// ===== ESTADOS DE TAREAS =====
function testTaskStatuses(token, spreadsheet) {
  console.log('📊 Probando endpoint de estados de tareas...');
  
  const url = `${BASE_URL}/taskStatuses`;
  const response = makeAuthenticatedRequest(url, token);
  
  if (response && response.result) {
    const sheet = createOrGetSheet(spreadsheet, 'Estados de Tareas');
    
    // Headers
    const headers = ['ID', 'Nombre', 'Descripción', 'Color', 'Orden', 'Activo'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Data
    const data = response.result.map(status => [
      status.id || '',
      status.name || '',
      status.description || '',
      status.color || '',
      status.sortOrder || 0,
      status.isActive || false
    ]);
    
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, headers.length).setValues(data);
    }
    
    console.log(`✅ ${data.length} estados de tareas encontrados`);
  }
}

// ===== TAREAS RECIENTES =====
function testRecentTasks(token, spreadsheet) {
  console.log('📅 Probando endpoint de tareas recientes...');
  
  // Obtener tareas de los últimos 30 días
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const url = `${BASE_URL}/tasks?limit=50&offset=0&dueDateStart=${formatDate(startDate)}&dueDateEnd=${formatDate(endDate)}`;
  const response = makeAuthenticatedRequest(url, token);
  
  if (response && response.result) {
    const sheet = createOrGetSheet(spreadsheet, 'Tareas Recientes');
    
    // Headers
    const headers = [
      'ID', 'Título', 'Descripción', 'Tipo', 'Estado', 'Prioridad',
      'Fecha Vencimiento', 'Propiedad ID', 'Reserva ID', 'Asignado A',
      'Fecha Creación', 'Fecha Actualización'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Data
    const data = response.result.map(task => [
      task.id || '',
      task.title || '',
      task.description || '',
      task.taskTypeId || '',
      task.taskStatusId || '',
      task.priority || '',
      task.dueDate ? new Date(task.dueDate) : '',
      task.listingId || '',
      task.reservationId || '',
      task.assignedToUserId || '',
      task.createdAt ? new Date(task.createdAt) : '',
      task.updatedAt ? new Date(task.updatedAt) : ''
    ]);
    
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, headers.length).setValues(data);
      
      // Formatear fechas
      const dateColumns = [7, 11, 12]; // Fecha Vencimiento, Creación, Actualización
      dateColumns.forEach(col => {
        sheet.getRange(2, col, data.length, 1).setNumberFormat('dd/mm/yyyy hh:mm');
      });
    }
    
    console.log(`✅ ${data.length} tareas encontradas`);
    
    // Agregar resumen
    addTasksSummary(sheet, data, data.length + 3);
  }
}

// ===== PRUEBAS CON FILTROS =====
function testTaskFilters(token, spreadsheet) {
  console.log('🔍 Probando filtros de tareas...');
  
  const sheet = createOrGetSheet(spreadsheet, 'Pruebas de Filtros');
  
  let row = 1;
  
  // Headers de resumen
  const summaryHeaders = ['Filtro Aplicado', 'URL', 'Tareas Encontradas', 'Estado'];
  sheet.getRange(row, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
  sheet.getRange(row, 1, 1, summaryHeaders.length).setFontWeight('bold');
  row += 2;
  
  const filters = [
    {
      name: 'Tareas de hoy',
      params: `dueDateStart=${formatDate(new Date())}&dueDateEnd=${formatDate(new Date())}`
    },
    {
      name: 'Tareas pendientes',
      params: 'taskStatusId=1' // Asumiendo que 1 es "pendiente"
    },
    {
      name: 'Tareas de alta prioridad',
      params: 'priority=high'
    },
    {
      name: 'Últimas 10 tareas',
      params: 'limit=10&sortBy=createdAt&sortOrder=desc'
    }
  ];
  
  filters.forEach(filter => {
    try {
      const url = `${BASE_URL}/tasks?${filter.params}`;
      const response = makeAuthenticatedRequest(url, token);
      
      const tasksFound = response && response.result ? response.result.length : 0;
      const status = response ? '✅ OK' : '❌ Error';
      
      sheet.getRange(row, 1, 1, 4).setValues([[filter.name, url, tasksFound, status]]);
      row++;
      
      console.log(`${filter.name}: ${tasksFound} tareas`);
      
    } catch (error) {
      sheet.getRange(row, 1, 1, 4).setValues([[filter.name, `Error: ${error.message}`, 0, '❌ Error']]);
      row++;
    }
  });
}

// ===== FUNCIONES AUXILIARES =====
function makeAuthenticatedRequest(url, token) {
  const options = {
    'method': 'GET',
    'headers': {
      'Authorization': `Bearer ${token}`,
      'Cache-control': 'no-cache'
    },
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    console.log(`📡 ${url} - Código: ${responseCode}`);
    
    if (responseCode === 200) {
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.log(`⚠️ Error parsing JSON: ${parseError}`);
        return { error: 'Invalid JSON', responseText: responseText };
      }
    } else {
      console.log(`❌ Error ${responseCode}: ${responseText}`);
      return null;
    }
    
  } catch (error) {
    console.error(`💥 Error de red en ${url}:`, error);
    return null;
  }
}

function createOrGetSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  return sheet;
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function addTasksSummary(sheet, data, startRow) {
  // Agregar estadísticas básicas
  sheet.getRange(startRow, 1).setValue('RESUMEN:').setFontWeight('bold');
  sheet.getRange(startRow + 1, 1, 1, 2).setValues([['Total de tareas:', data.length]]);
  
  // Contar por estado (columna 5)
  const statusCounts = {};
  data.forEach(row => {
    const status = row[4] || 'Sin estado';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  let summaryRow = startRow + 3;
  sheet.getRange(summaryRow, 1).setValue('Por estado:').setFontWeight('bold');
  summaryRow++;
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    sheet.getRange(summaryRow, 1, 1, 2).setValues([[status, count]]);
    summaryRow++;
  });
}

// ===== FUNCIÓN DE CONFIGURACIÓN =====
function setupCredentials() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert(
    'Configuración necesaria',
    'Antes de ejecutar el script, necesitas:\n\n' +
    '1. Verificar que CLIENT_ID y CLIENT_SECRET sean correctos\n' +
    '2. Confirmar que tu cuenta Hostaway tiene acceso a la API de tareas\n' +
    '3. Verificar que las credenciales son de PRODUCCIÓN (no sandbox)\n' +
    '4. Comprobar que la integración API está activa\n\n' +
    'Las credenciales se encuentran en:\n' +
    'Hostaway Panel > Apps & Integrations > API Credentials',
    ui.ButtonSet.OK
  );
}

// ===== MENÚ PERSONALIZADO =====
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Hostaway Tasks Test')
    .addItem('📋 Configurar Credenciales', 'setupCredentials')
    .addItem('🚀 Probar API de Tareas', 'testHostawayTasksAPI')
    .addItem('🔄 Limpiar Hojas', 'clearAllSheets')
    .addToUi();
}

function clearAllSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ['Tipos de Tareas', 'Estados de Tareas', 'Tareas Recientes', 'Pruebas de Filtros'];
  
  sheets.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
    }
  });
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Hojas limpiadas correctamente', 'Éxito', 3);
}