const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Usar la variable de entorno PORT
const PORT = process.env.PORT || 3000;

// URL de conexión de MongoDB Atlas con tu usuario y contraseña
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

// Esquema para los horarios
const HorarioSchema = new mongoose.Schema({
    hora: Number,
    minutos: Number,
    cantidad: Number,
    createdAt: { type: Date, default: Date.now }
});

const Horario = mongoose.model('Horario', HorarioSchema);

// Configuración
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

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
        
        const nuevoHorario = new Horario({
            hora,
            minutos,
            cantidad: parseInt(cantidad)
        });
        
        await nuevoHorario.save();
        res.redirect('/');
    } catch (error) {
        console.error('Error al guardar horario:', error);
        res.status(500).send('Error al guardar el horario');
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
        gramos: horario.cantidad
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
    try {
        res.render('estado-plato', {
            error: null,
            cantidad: null,
            ultimaActualizacion: null
        });
    } catch (error) {
        console.error('Error al cargar estado del plato:', error);
        res.status(500).render('error', {
            mensaje: 'Error al cargar la página',
            error: 'Por favor, intenta nuevamente más tarde'
        });
    }
});

http.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
