const express = require('express');
const cors = require('cors');
const path = require('path');
const initialConfig = require('./initialConfig');
const { 
    connectRedis, 
    getConfig, 
    setConfig, 
    updatePartialConfig,
    createBackup,
    getBackups,
    restoreBackup 
} = require('./redis');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Redis connection
connectRedis().catch(console.error);

// Initialize config in Redis if not exists
async function initializeRedisConfig() {
    try {
        const config = await getConfig();
        if (!config) {
            await setConfig(initialConfig);
            console.log('Initialized Redis with default config');
        }
    } catch (error) {
        console.error('Error initializing Redis config:', error);
    }
}

initializeRedisConfig();

// API Routes
app.get('/api/config/agents', async (req, res) => {
    try {
        const config = await getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

app.put('/api/config/agents', async (req, res) => {
    try {
        await setConfig(req.body);
        await createBackup();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

app.patch('/api/config/agents', async (req, res) => {
    try {
        const updatedConfig = await updatePartialConfig(req.body);
        await createBackup();
        res.json(updatedConfig);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

app.get('/api/config/agents/backups', async (req, res) => {
    try {
        const backups = await getBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch backups' });
    }
});

app.post('/api/config/agents/restore/:backupId', async (req, res) => {
    try {
        const success = await restoreBackup(req.params.backupId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Backup not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 