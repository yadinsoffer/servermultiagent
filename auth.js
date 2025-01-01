const jwt = require('jsonwebtoken');
const { expressjwt: expressJwt } = require('express-jwt');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to protect routes
const requireAuth = expressJwt({
    secret: JWT_SECRET,
    algorithms: ['HS256']
});

// Generate token for a user
const generateToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: '24h'
    });
};

// Login handler
const login = async (req, res) => {
    const { email, password } = req.body;
    
    // For demo purposes, hardcoded credentials
    // In production, you should validate against a database
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = generateToken({ id: 1, email });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
};

module.exports = {
    requireAuth,
    generateToken,
    login
}; 