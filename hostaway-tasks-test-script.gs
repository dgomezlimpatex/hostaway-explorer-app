/**
 * Script de Google Apps Script para probar la API de tareas de Hostaway
 * 
 * INSTRUCCIONES DE USO:
 * 1. Crea una nueva hoja de Google Sheets
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega este código
 * 4. Configura tus credenciales de Hostaway en las variables CLIENT_ID y CLIENT_SECRET
 * 5. Ejecuta la función testHostawayTasksAPI()
 */

// ===== CONFIGURACIÓN =====
const CLIENT_ID = 'TU_CLIENT_ID_DE_HOSTAWAY';
const CLIENT_SECRET = 'TU_CLIENT_SECRET_DE_HOSTAWAY';
const BASE_URL = 'https://api.hostaway.com/v1';

// ===== FUNCIÓN PRINCIPAL =====
function testHostawayTasksAPI() {
  try {
    console.log('🚀 Iniciando prueba de API de tareas de Hostaway...');
    
    // 1. Obtener token de acceso
    const token = getHostawayToken();
    console.log('✅ Token obtenido correctamente');
    
    // 2. Probar diferentes endpoints de tareas
    testTaskEndpoints(token);
    
    console.log('✅ Prueba completada. Revisa las hojas creadas.');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    SpreadsheetApp.getActiveSpreadsheet().toast('Error: ' + error.message, 'Error', 10);
  }
}

// ===== AUTENTICACIÓN =====
function getHostawayToken() {
  const url = `${BASE_URL}/accessTokens`;
  
  const payload = {
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'scope': 'general'
  };
  
  const options = {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-control': 'no-cache'
    },
    'payload': Object.keys(payload).map(key => key + '=' + encodeURIComponent(payload[key])).join('&')
  };
  
  const response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`Error de autenticación: ${response.getContentText()}`);
  }
  
  const data = JSON.parse(response.getContentText());
  return data.access_token;
}

// ===== PRUEBAS DE ENDPOINTS =====
function testTaskEndpoints(token) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Obtener todos los tipos de tareas
  testTaskTypes(token, spreadsheet);
  
  // 2. Obtener todos los estados de tareas
  testTaskStatuses(token, spreadsheet);
  
  // 3. Obtener tareas recientes
  testRecentTasks(token, spreadsheet);
  
  // 4. Probar filtros de tareas
  testTaskFilters(token, spreadsheet);
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
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      console.error(`Error en request: ${response.getResponseCode()} - ${response.getContentText()}`);
      return null;
    }
    
    return JSON.parse(response.getContentText());
    
  } catch (error) {
    console.error('Error en makeAuthenticatedRequest:', error);
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
    '1. Reemplazar CLIENT_ID y CLIENT_SECRET con tus credenciales de Hostaway\n' +
    '2. Asegurarte de que tu cuenta tiene acceso a la API de tareas\n' +
    '3. Ejecutar la función testHostawayTasksAPI()\n\n' +
    'Las credenciales se encuentran en tu panel de Hostaway > Configuración > API',
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