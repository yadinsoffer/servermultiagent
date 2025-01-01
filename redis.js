require('dotenv').config();
const { createClient } = require('redis');

// Create Redis client with the cloud URL
const client = createClient({
    url: process.env.REDIS_URL
});

client.on('error', err => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('Connected to Redis Cloud'));

// Connect to Redis
const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }
};

// Helper functions for configuration management
const CONFIG_KEY = 'agent_config';

const getConfig = async () => {
    try {
        const config = await client.get(CONFIG_KEY);
        return config ? JSON.parse(config) : null;
    } catch (error) {
        console.error('Error getting config from Redis:', error);
        return null;
    }
};

const setConfig = async (config) => {
    try {
        await client.set(CONFIG_KEY, JSON.stringify(config));
        return true;
    } catch (error) {
        console.error('Error setting config in Redis:', error);
        return false;
    }
};

const updatePartialConfig = async (updates) => {
    try {
        const currentConfig = await getConfig();
        const newConfig = {
            ...currentConfig,
            ...updates
        };
        await setConfig(newConfig);
        return newConfig;
    } catch (error) {
        console.error('Error updating config in Redis:', error);
        return null;
    }
};

// Backup management
const createBackup = async () => {
    try {
        const config = await getConfig();
        if (!config) return null;
        
        const backupKey = `backup:${new Date().toISOString()}`;
        await client.set(backupKey, JSON.stringify(config));
        return backupKey;
    } catch (error) {
        console.error('Error creating backup:', error);
        return null;
    }
};

const getBackups = async () => {
    try {
        const keys = await client.keys('backup:*');
        const backups = [];
        
        for (const key of keys) {
            const backup = await client.get(key);
            backups.push({
                id: key,
                data: JSON.parse(backup),
                timestamp: key.split(':')[1]
            });
        }
        
        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error getting backups:', error);
        return [];
    }
};

const restoreBackup = async (backupId) => {
    try {
        const backup = await client.get(backupId);
        if (!backup) return false;
        
        await setConfig(JSON.parse(backup));
        return true;
    } catch (error) {
        console.error('Error restoring backup:', error);
        return false;
    }
};

module.exports = {
    client,
    connectRedis,
    getConfig,
    setConfig,
    updatePartialConfig,
    createBackup,
    getBackups,
    restoreBackup
}; 