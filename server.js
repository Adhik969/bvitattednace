import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configure CORS based on environment
const corsOptions = {
    origin: config.NODE_ENV === 'production' 
        ? ['https://bharati-edu.com', 'https://www.bharati-edu.com'] // Replace with your actual domain
        : '*',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Detailed request logging middleware only in development
if (config.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const start = Date.now();
        console.log(`\n=== ${new Date().toISOString()} ===`);
        console.log(`${req.method} ${req.url}`);
        console.log('Headers:', req.headers);
        if (req.body && Object.keys(req.body).length > 0) {
            console.log('Body:', JSON.stringify(req.body, null, 2));
        }

        // Log route parameters
        if (Object.keys(req.params).length > 0) {
            console.log('Route params:', req.params);
        }

        // Log query parameters
        if (Object.keys(req.query).length > 0) {
            console.log('Query params:', req.query);
        }

        // Capture response
        const oldSend = res.send;
        res.send = function(data) {
            console.log(`Response Status: ${res.statusCode}`);
            if (data) {
                console.log('Response Data:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
            }
            console.log(`Request took ${Date.now() - start}ms\n`);
            return oldSend.apply(res, arguments);
        };

        next();
    });
}

// Basic request logging for production
if (config.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const start = Date.now();
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        
        res.on('finish', () => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${Date.now() - start}ms`);
        });
        
        next();
    });
}

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// API routes - Order matters for route matching
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes); // Teacher routes before admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));

// Serve index.html for root path
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(join(__dirname, 'index.html'));
});

// Add a route for the password reset page
app.get('/reset.html', (req, res) => {
    console.log('Serving reset.html');
    res.sendFile(join(__dirname, 'reset.html'));
});

// Handle HTML routes with logging
const htmlFiles = [
    '/login.html',
    '/admin-dashboard.html',
    '/teacher-panel.html',
    '/student-management.html',
    '/teacher-management.html',
    '/take-attendance.html',
    '/view-reports.html',
    '/notifications.html',
    '/settings.html',
    '/schedule.html'
];

htmlFiles.forEach(file => {
    app.get(file, (req, res) => {
        console.log(`Serving ${file}`);
        res.sendFile(join(__dirname, file.substring(1)));
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: config.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Handle 404s with minimal logging in production
app.use((req, res) => {
    if (config.NODE_ENV === 'production') {
        console.log(`404 - ${req.method} ${req.url}`);
    } else {
        console.log(`\n=== 404 Not Found ===`);
        console.log(`Method: ${req.method}`);
        console.log(`URL: ${req.url}`);
        console.log(`Headers:`, req.headers);
        console.log(`Query:`, req.query);
        console.log(`Body:`, req.body);
        console.log(`Params:`, req.params);
    }
    
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
            message: 'API endpoint not found',
            path: req.path,
            method: req.method
        });
    } else {
        res.status(404).sendFile(join(__dirname, 'index.html'));
    }
});

// Connect to MongoDB with connection options
console.log(`Connecting to MongoDB (${config.NODE_ENV} mode)...`);
mongoose.connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
    .then(() => {
        console.log('Connected to MongoDB successfully');
        
        // Start server
        const port = config.PORT;
        app.listen(port, () => {
            console.log(`Server is running on port ${port} in ${config.NODE_ENV} mode`);
            console.log('\nAvailable routes:');
            console.log('- GET  /                  - Home page');
            console.log('- GET  /login.html        - Login page');
            console.log('- GET  /teacher-panel.html - Teacher Panel');
            console.log('- POST /api/auth/login    - Login endpoint');
            console.log('- GET  /api/auth/verify   - Token verification');
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }); 