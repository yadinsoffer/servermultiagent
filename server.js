require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const path = require('path');
const { requireAuth, login } = require('./auth');
const initialConfig = require('./initialConfig');

const app = express();

// Redis client setup
const redis = new Redis(process.env.STORAGE_URL);

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Auth endpoint
app.post('/api/auth/login', login);

// Helper functions
async function readConfig() {
    try {
        const data = await redis.get('config');
        if (!data) {
            return process.env.NODE_ENV === 'production' ? initialConfig : null;
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading config:', error);
        return null;
    }
}

async function writeConfig(config) {
    try {
        await redis.set('config', JSON.stringify(config));
        return true;
    } catch (error) {
        console.error('Error writing config:', error);
        return false;
    }
}

async function createBackup(config) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `backup:${timestamp}`;
        await redis.set(backupKey, JSON.stringify(config));
        return backupKey;
    } catch (error) {
        console.error('Error creating backup:', error);
        return null;
    }
}

// Protected API routes with authentication
app.get('/api/config/agents', requireAuth, async (req, res) => {
    try {
        const config = await readConfig();
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read configuration' });
    }
});

app.put('/api/config/agents', requireAuth, async (req, res) => {
    try {
        const currentConfig = await readConfig();
        if (currentConfig) {
            await createBackup(currentConfig);
        }
        await writeConfig(req.body);
        res.json({ message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

app.patch('/api/config/agents', requireAuth, async (req, res) => {
    try {
        const currentConfig = await readConfig() || {};
        await createBackup(currentConfig);

        const updatedConfig = {
            ...currentConfig,
            ...req.body,
            roleNames: {
                ...(currentConfig.roleNames || {}),
                ...(req.body.roleNames || {})
            },
            messages: {
                ...(currentConfig.messages || {}),
                ...(req.body.messages || {})
            },
            listingTasks: {
                ...(currentConfig.listingTasks || {}),
                ...(req.body.listingTasks || {})
            }
        };

        await writeConfig(updatedConfig);
        res.json({ message: 'Configuration updated successfully', config: updatedConfig });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

app.get('/api/config/agents/backups', requireAuth, async (req, res) => {
    try {
        const backups = await redis.keys('backup:*');
        res.json(backups.map(key => key.replace('backup:', '')));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch backups' });
    }
});

app.post('/api/config/agents/restore/:timestamp', requireAuth, async (req, res) => {
    try {
        const backupKey = `backup:${req.params.timestamp}`;
        const backupData = await redis.get(backupKey);
        if (!backupData) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backupConfig = JSON.parse(backupData);
        const currentConfig = await readConfig();
        if (currentConfig) {
            await createBackup(currentConfig);
        }

        await writeConfig(backupConfig);
        res.json({ message: 'Configuration restored successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

// Initialize config if needed
async function initializeConfig() {
    try {
        const exists = await redis.exists('config');
        if (!exists) {
            await writeConfig(initialConfig);
        }
    } catch (error) {
        console.error('Error initializing config:', error);
    }
}

initializeConfig();

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app; 