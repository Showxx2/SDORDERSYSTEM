const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Path for our local database file
const dbPath = path.join(app.getPath('userData'), 'ordersystem_db.json');

// Initialize database with default data if it doesn't exist
function initDatabase() {
  if (!fs.existsSync(dbPath)) {
    const defaultData = {
      users: [
        { id: 1, username: 'admin', password: 'admin', role: 'admin', name: 'Rendszergazda' },
        { id: 2, username: 'user', password: 'user', role: 'staff', name: 'Kiszolgáló Péter' }
      ],
      categories: [
        { id: 1, name: 'Pizzák' },
        { id: 2, name: 'Tészták' },
        { id: 3, name: 'Frissensültek' },
        { id: 4, name: 'Saláták' },
        { id: 5, name: 'Italok' },
        { id: 6, name: 'Desszertek' }
      ],
      items: [
        { id: 1, category_id: 1, name: 'Margherita Pizza', price: 1890, packaging_fee: 150 },
        { id: 2, category_id: 1, name: 'Sonkás Pizza', price: 2190, packaging_fee: 150 },
        { id: 3, category_id: 1, name: 'Magyaros Pizza', price: 2490, packaging_fee: 150 },
        { id: 4, category_id: 1, name: 'Négysajtos Pizza', price: 2390, packaging_fee: 150 },
        
        { id: 5, category_id: 2, name: 'Bolognai Spagetti', price: 2290, packaging_fee: 200 },
        { id: 6, category_id: 2, name: 'Carbonara Penne', price: 2390, packaging_fee: 200 },
        
        { id: 7, category_id: 3, name: 'Rántott Csirkemell', price: 2490, packaging_fee: 200 },
        { id: 8, category_id: 3, name: 'Rántott Sajt tartárral', price: 2390, packaging_fee: 200 },
        { id: 9, category_id: 3, name: 'Cigánypecsenye', price: 2690, packaging_fee: 200 },
        
        { id: 10, category_id: 4, name: 'Görög Saláta', price: 1490, packaging_fee: 100 },
        { id: 11, category_id: 4, name: 'Cézár Saláta', price: 1790, packaging_fee: 100 },
        
        { id: 12, category_id: 5, name: 'Coca-Cola 0.5l', price: 590, packaging_fee: 0 },
        { id: 13, category_id: 5, name: 'Fanta Narancs 0.5l', price: 590, packaging_fee: 0 },
        { id: 14, category_id: 5, name: 'Ásványvíz szénsavas 0.5l', price: 390, packaging_fee: 0 },
        { id: 15, category_id: 5, name: 'Ásványvíz szénsavmentes 0.5l', price: 390, packaging_fee: 0 },
        
        { id: 16, category_id: 6, name: 'Somlói Galuska', price: 1290, packaging_fee: 100 },
        { id: 17, category_id: 6, name: 'Tiramisu', price: 1190, packaging_fee: 100 }
      ],
      inventory: [
        { id: 1, name: 'Pizzatészta (golyó)', quantity: 150, unit: 'db', warning_limit: 30 },
        { id: 2, name: 'Paradicsomszósz', quantity: 20, unit: 'kg', warning_limit: 5 },
        { id: 3, name: 'Trappista sajt', quantity: 15, unit: 'kg', warning_limit: 4 },
        { id: 4, name: 'Sonka', quantity: 8, unit: 'kg', warning_limit: 2 },
        { id: 5, name: 'Csirkemell', quantity: 25, unit: 'kg', warning_limit: 5 },
        { id: 6, name: 'Spagetti tészta', quantity: 10, unit: 'kg', warning_limit: 3 },
        { id: 7, name: 'Tejföl', quantity: 15, unit: 'kg', warning_limit: 3 }
      ],
      customers: [
        { id: 'CUST-1001', name: 'Kovács János', phone_prefix: '+36', phone_number: '301234567', zip: '8900', city: 'Zalaegerszeg', street: 'Kossuth Lajos utca', house_number: '12', details: 'Csengő a kapun balra', points: 120, is_problematic: false },
        { id: 'CUST-1002', name: 'Németh Mária', phone_prefix: '+36', phone_number: '209876543', zip: '8800', city: 'Nagykanizsa', street: 'Fő út', house_number: '4', details: 'Problémás kiszállítás múltkor', points: 45, is_problematic: true },
        { id: 'CUST-1003', name: 'Szabó Péter', phone_prefix: '+36', phone_number: '705553322', zip: '8360', city: 'Keszthely', street: 'Balaton utca', house_number: '15/A', details: '', points: 310, is_problematic: false },
        { id: 'CUST-1004', name: 'Zala Imre', phone_prefix: '+36', phone_number: '306678989', zip: '8960', city: 'Lenti', street: 'Petőfi Sándor utca', house_number: '42', details: 'Mindig jattol', points: 85, is_problematic: false },
        { id: 'CUST-1005', name: 'Horváth László', phone_prefix: '+36', phone_number: '305551122', zip: '8900', city: 'Zalaegerszeg', street: 'Zrínyi Miklós utca', house_number: '8', details: 'Második emelet', points: 60, is_problematic: false },
        { id: 'CUST-1006', name: 'Kiss Erzsébet', phone_prefix: '+36', phone_number: '204443355', zip: '8800', city: 'Nagykanizsa', street: 'Kinizsi Pál utca', house_number: '23', details: '', points: 95, is_problematic: false },
        { id: 'CUST-1007', name: 'Tóth Gábor', phone_prefix: '+36', phone_number: '708889900', zip: '8360', city: 'Keszthely', street: 'Helikon utca', house_number: '1', details: 'Kertesház', points: 150, is_problematic: false },
        { id: 'CUST-1008', name: 'Varga Judit', phone_prefix: '+36', phone_number: '302229988', zip: '8790', city: 'Zalaszentgrót', street: 'Batthyány utca', house_number: '34', details: 'Kutya van az udvarban', points: 40, is_problematic: true },
        { id: 'CUST-1009', name: 'Nagy Zoltán', phone_prefix: '+36', phone_number: '203337766', zip: '8960', city: 'Lenti', street: 'Táncsics Mihály utca', house_number: '7', details: '', points: 220, is_problematic: false },
        { id: 'CUST-1010', name: 'Farkas Anikó', phone_prefix: '+36', phone_number: '304448811', zip: '8868', city: 'Letenye', street: 'Szabadság tér', house_number: '12', details: 'Kapucsengő 3', points: 30, is_problematic: false },
        { id: 'CUST-1011', name: 'Balogh Attila', phone_prefix: '+36', phone_number: '709995544', zip: '8749', city: 'Zalakaros', street: 'Gyógyfürdő tér', house_number: '2', details: 'Hotel recepció', points: 180, is_problematic: false },
        { id: 'CUST-1012', name: 'Fehér Katalin', phone_prefix: '+36', phone_number: '201112233', zip: '8756', city: 'Zalakomár', street: 'Árpád utca', house_number: '56', details: '', points: 70, is_problematic: false },
        { id: 'CUST-1013', name: 'Molnár Tamás', phone_prefix: '+36', phone_number: '308881122', zip: '8991', city: 'Teskánd', street: 'Rákóczi utca', house_number: '18', details: '', points: 135, is_problematic: false },
        { id: 'CUST-1014', name: 'Rácz Andrea', phone_prefix: '+36', phone_number: '309998877', zip: '8900', city: 'Zalaegerszeg', street: 'Ady Endre utca', house_number: '9', details: 'A kapukód 9999', points: 90, is_problematic: false },
        { id: 'CUST-1015', name: 'Simon József', phone_prefix: '+36', phone_number: '706662233', zip: '8800', city: 'Nagykanizsa', street: 'Deák Ferenc tér', house_number: '14', details: 'Problémás cím', points: 15, is_problematic: true },
        { id: 'CUST-1016', name: 'Takács Krisztina', phone_prefix: '+36', phone_number: '205559988', zip: '8360', city: 'Keszthely', street: 'Vár utca', house_number: '3', details: '', points: 200, is_problematic: false },
        { id: 'CUST-1017', name: 'Fekete Sándor', phone_prefix: '+36', phone_number: '307774411', zip: '8960', city: 'Lenti', street: 'Akácfa utca', house_number: '22', details: 'Kapucsengő nem működik', points: 110, is_problematic: false },
        { id: 'CUST-1018', name: 'Szilágyi Gabriella', phone_prefix: '+36', phone_number: '202224466', zip: '8790', city: 'Zalaszentgrót', street: 'Táncsics utca', house_number: '11', details: '', points: 55, is_problematic: false },
        { id: 'CUST-1019', name: 'Gulyás Miklós', phone_prefix: '+36', phone_number: '703335599', zip: '8868', city: 'Letenye', street: 'Kossuth utca', house_number: '67', details: '', points: 125, is_problematic: false },
        { id: 'CUST-1020', name: 'Mészáros Éva', phone_prefix: '+36', phone_number: '309990011', zip: '8749', city: 'Zalakaros', street: 'Petőfi utca', house_number: '14', details: 'Mindig korán kéri', points: 160, is_problematic: false }
      ],
      orders: [],
      orderItems: [],
      packagingFees: {
        pizza: 150,
        box: 200,
        cup: 0
      },
      deliveryFees: {
        baseFee: 500,
        perKmFee: 100
      }
    };
    fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// Load database from file
function loadDatabase() {
  initDatabase();
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Schema migration: add default customers if missing or outdated (< 20 items)
    if (!parsed.customers || parsed.customers.length < 20) {
      parsed.customers = [
        { id: 'CUST-1001', name: 'Kovács János', phone_prefix: '+36', phone_number: '301234567', zip: '8900', city: 'Zalaegerszeg', street: 'Kossuth Lajos utca', house_number: '12', details: 'Csengő a kapun balra', points: 120, is_problematic: false },
        { id: 'CUST-1002', name: 'Németh Mária', phone_prefix: '+36', phone_number: '209876543', zip: '8800', city: 'Nagykanizsa', street: 'Fő út', house_number: '4', details: 'Problémás kiszállítás múltkor', points: 45, is_problematic: true },
        { id: 'CUST-1003', name: 'Szabó Péter', phone_prefix: '+36', phone_number: '705553322', zip: '8360', city: 'Keszthely', street: 'Balaton utca', house_number: '15/A', details: '', points: 310, is_problematic: false },
        { id: 'CUST-1004', name: 'Zala Imre', phone_prefix: '+36', phone_number: '306678989', zip: '8960', city: 'Lenti', street: 'Petőfi Sándor utca', house_number: '42', details: 'Mindig jattol', points: 85, is_problematic: false },
        { id: 'CUST-1005', name: 'Horváth László', phone_prefix: '+36', phone_number: '305551122', zip: '8900', city: 'Zalaegerszeg', street: 'Zrínyi Miklós utca', house_number: '8', details: 'Második emelet', points: 60, is_problematic: false },
        { id: 'CUST-1006', name: 'Kiss Erzsébet', phone_prefix: '+36', phone_number: '204443355', zip: '8800', city: 'Nagykanizsa', street: 'Kinizsi Pál utca', house_number: '23', details: '', points: 95, is_problematic: false },
        { id: 'CUST-1007', name: 'Tóth Gábor', phone_prefix: '+36', phone_number: '708889900', zip: '8360', city: 'Keszthely', street: 'Helikon utca', house_number: '1', details: 'Kertesház', points: 150, is_problematic: false },
        { id: 'CUST-1008', name: 'Varga Judit', phone_prefix: '+36', phone_number: '302229988', zip: '8790', city: 'Zalaszentgrót', street: 'Batthyány utca', house_number: '34', details: 'Kutya van az udvarban', points: 40, is_problematic: true },
        { id: 'CUST-1009', name: 'Nagy Zoltán', phone_prefix: '+36', phone_number: '203337766', zip: '8960', city: 'Lenti', street: 'Táncsics Mihály utca', house_number: '7', details: '', points: 220, is_problematic: false },
        { id: 'CUST-1010', name: 'Farkas Anikó', phone_prefix: '+36', phone_number: '304448811', zip: '8868', city: 'Letenye', street: 'Szabadság tér', house_number: '12', details: 'Kapucsengő 3', points: 30, is_problematic: false },
        { id: 'CUST-1011', name: 'Balogh Attila', phone_prefix: '+36', phone_number: '709995544', zip: '8749', city: 'Zalakaros', street: 'Gyógyfürdő tér', house_number: '2', details: 'Hotel recepció', points: 180, is_problematic: false },
        { id: 'CUST-1012', name: 'Fehér Katalin', phone_prefix: '+36', phone_number: '201112233', zip: '8756', city: 'Zalakomár', street: 'Árpád utca', house_number: '56', details: '', points: 70, is_problematic: false },
        { id: 'CUST-1013', name: 'Molnár Tamás', phone_prefix: '+36', phone_number: '308881122', zip: '8991', city: 'Teskánd', street: 'Rákóczi utca', house_number: '18', details: '', points: 135, is_problematic: false },
        { id: 'CUST-1014', name: 'Rácz Andrea', phone_prefix: '+36', phone_number: '309998877', zip: '8900', city: 'Zalaegerszeg', street: 'Ady Endre utca', house_number: '9', details: 'A kapukód 9999', points: 90, is_problematic: false },
        { id: 'CUST-1015', name: 'Simon József', phone_prefix: '+36', phone_number: '706662233', zip: '8800', city: 'Nagykanizsa', street: 'Deák Ferenc tér', house_number: '14', details: 'Problémás cím', points: 15, is_problematic: true },
        { id: 'CUST-1016', name: 'Takács Krisztina', phone_prefix: '+36', phone_number: '205559988', zip: '8360', city: 'Keszthely', street: 'Vár utca', house_number: '3', details: '', points: 200, is_problematic: false },
        { id: 'CUST-1017', name: 'Fekete Sándor', phone_prefix: '+36', phone_number: '307774411', zip: '8960', city: 'Lenti', street: 'Akácfa utca', house_number: '22', details: 'Kapucsengő nem működik', points: 110, is_problematic: false },
        { id: 'CUST-1018', name: 'Szilágyi Gabriella', phone_prefix: '+36', phone_number: '202224466', zip: '8790', city: 'Zalaszentgrót', street: 'Táncsics utca', house_number: '11', details: '', points: 55, is_problematic: false },
        { id: 'CUST-1019', name: 'Gulyás Miklós', phone_prefix: '+36', phone_number: '703335599', zip: '8868', city: 'Letenye', street: 'Kossuth utca', house_number: '67', details: '', points: 125, is_problematic: false },
        { id: 'CUST-1020', name: 'Mészáros Éva', phone_prefix: '+36', phone_number: '309990011', zip: '8749', city: 'Zalakaros', street: 'Petőfi utca', house_number: '14', details: 'Mindig korán kéri', points: 160, is_problematic: false }
      ];
      fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    
    return parsed;
  } catch (error) {
    console.error('Error loading database:', error);
    return {};
  }
}

let sseClients = [];

function broadcastToClients(data) {
  const payload = 'data: ' + JSON.stringify(data) + '\n\n';
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      console.error("SSE write error:", e);
    }
  });
}

// Save database to file
function saveDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    broadcastToClients(data);
    return { success: true };
  } catch (error) {
    console.error('Error saving database:', error);
    return { success: false, error: error.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Ételrendelő Program',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC Handlers
ipcMain.handle('db-load', async () => {
  return loadDatabase();
});

ipcMain.handle('db-save', async (event, data) => {
  return saveDatabase(data);
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Spin up a simple HTTP server to allow external web browsers to fetch/save the DB
const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Push the current database state immediately upon connection
    res.write('data: ' + JSON.stringify(loadDatabase()) + '\n\n');
    
    sseClients.push(res);
    
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  if (req.url === '/api/db' && req.method === 'GET') {
    const dbData = loadDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dbData));
    return;
  }

  if (req.url === '/api/db' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        saveDatabase(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Database HTTP Sync server listening on http://localhost:3001');
});
