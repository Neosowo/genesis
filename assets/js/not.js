const express = require('express');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'tu_usuario_real',
    password: 'tu_contraseña_real',
    database: 'tu_base_de_datos_real'
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
    console.log('Cliente conectado');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe') {
            // Configurar monitor de cambios para la columna
            setupColumnMonitor(data.columnName, ws);
        }
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});

// Función para monitorear cambios en una columna
async function setupColumnMonitor(columnName, ws) {
    try {
        // Consulta inicial
        const [rows] = await pool.execute(
            `SELECT ${columnName} FROM tu_tabla WHERE 1`
        );

        // Enviar datos iniciales
        ws.send(JSON.stringify({
            columnName,
            value: rows[0][columnName]
        }));

        // Configurar trigger en la base de datos para detectar cambios
        await pool.execute(`
            CREATE TRIGGER IF NOT EXISTS ${columnName}_trigger
            AFTER UPDATE ON tu_tabla
            FOR EACH ROW
            BEGIN
                IF NEW.${columnName} != OLD.${columnName} THEN
                    -- Aquí podrías insertar en una tabla de eventos
                    -- o usar otro mecanismo para notificar cambios
                END IF;
            END
        `);

    } catch (error) {
        console.error('Error al configurar monitor:', error);
    }
}

// Ruta API para obtener datos
app.get('/api/data/:columnName', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT ${req.params.columnName} FROM tu_tabla WHERE 1`
        );
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Servidor HTTP iniciado en puerto 3000');
});