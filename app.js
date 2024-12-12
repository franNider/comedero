const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Variables globales para el estado
let ultimaCantidadPlato = 0;
let ultimaCantidadDispensador = 0;
let ultimaActualizacion = null;

// Usar la variable de entorno PORT
const PORT = process.env.PORT || 3000;

// URL de conexión de MongoDB Atlas
const MONGODB_URI = "mongodb+srv://fran:tribyte@cluster0.g2lev.mongodb.net/dispensador?retryWrites=true&w=majority&appName=Cluster0";

// Conexión a MongoDB Atlas
mongoose.connect(MONGODB_URI, {
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    }
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
    console.error('❌ Error conectando a MongoDB Atlas:', err);
    process.exit(1);
});

// Esquema para los horarios con soporte para uint16_t en gramos
const HorarioSchema = new mongoose.Schema({
    hora: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    minutos: {
        type: Number,
        required: true,
        min: 0,
        max: 59
    },
    cantidad: {
        type: Number,
        required: true,
        min: 0,
        max: 65535  // Máximo valor para uint16_t
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Horario = mongoose.model('Horario', HorarioSchema);

// Configuración
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Rutas
app.get('/', async (req, res) => {
    try {
        const horarios = await Horario.find().sort({ hora: 1, minutos: 1 });
        res.render('index', { horarios: horarios, error: null });
    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.render('index', { 
            horarios: [],
            error: 'Error al cargar los horarios'
        });
    }
});

app.get('/nuevo-horario', (req, res) => {
    res.render('nuevo-horario');
});

app.post('/agregar-horario', async (req, res) => {
    try {
        const { horario, cantidad } = req.body;
        const [hora, minutos] = horario.split(':').map(num => parseInt(num));
        
        // Validar que la cantidad no exceda el máximo de uint16_t
        const cantidadNum = parseInt(cantidad);
        if (cantidadNum < 0 || cantidadNum > 65535) {
            throw new Error('Cantidad fuera de rango (0-65535)');
        }
        
        const nuevoHorario = new Horario({
            hora,
            minutos,
            cantidad: cantidadNum
        });
        
        await nuevoHorario.save();
        res.redirect('/');
    } catch (error) {
        console.error('Error al guardar horario:', error);
        res.status(500).send('Error al guardar el horario: ' + error.message);
    }
});

app.post('/eliminar-horario/:id', async (req, res) => {
    try {
        await Horario.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } catch (error) {
        console.error('Error al eliminar horario:', error);
        res.status(500).send('Error al eliminar el horario');
    }
});

app.get('/api/datos', async (req, res) => {
    try {
        const horarios = await Horario.find().sort({ hora: 1, minutos: 1 });
        
        if (horarios.length > 0) {
            const datosFormateados = horarios.map(horario => ({
                hora: horario.hora,
                minuto: horario.minutos,
                gramos: horario.cantidad  // Ya soporta uint16_t
            }));
            res.json(datosFormateados);
        } else {
            res.json({
                mensaje: "No hay horarios programados"
            });
        }
    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
});

app.get('/estado-plato', (req, res) => {
    res.render('estado-plato', {
        cantidadPlato: ultimaCantidadPlato,
        cantidadDispensador: ultimaCantidadDispensador,
        ultimaActualizacion: ultimaActualizacion
    });
});

// Endpoint para recibir datos del ESP32
app.post('/api/actualizar-estado', (req, res) => {
    try {
        const { cantidadPlato, cantidadDispensador } = req.body;
        
        // Validar y convertir a números
        ultimaCantidadPlato = parseInt(cantidadPlato);
        ultimaCantidadDispensador = parseInt(cantidadDispensador);
        ultimaActualizacion = new Date();
        
        // Validar rangos
        if (ultimaCantidadPlato < 0 || ultimaCantidadPlato > 65535 ||
            ultimaCantidadDispensador < 0 || ultimaCantidadDispensador > 65535) {
            throw new Error('Valores fuera de rango (0-65535)');
        }
        
        // Emitir los datos a todos los clientes conectados
        io.emit('actualizacionEstado', {
            cantidadPlato: ultimaCantidadPlato,
            cantidadDispensador: ultimaCantidadDispensador,
            timestamp: ultimaActualizacion.toISOString()
        });
        
        res.json({ 
            success: true,
            message: 'Estado actualizado correctamente',
            datos: {
                cantidadPlato: ultimaCantidadPlato,
                cantidadDispensador: ultimaCantidadDispensador,
                timestamp: ultimaActualizacion
            }
        });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Endpoint para obtener el último estado
app.get('/api/estado', (req, res) => {
    res.json({
        success: true,
        cantidadPlato: ultimaCantidadPlato,
        cantidadDispensador: ultimaCantidadDispensador,
        ultimaActualizacion: ultimaActualizacion
    });
});

http.listen(PORT, () => {
    console.log('Servidor corriendo en puerto ${PORT}');
});
