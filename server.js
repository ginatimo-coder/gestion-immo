const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CONFIGURATION ROBUSTE DE LA SESSION
app.use(session({
    secret: process.env.SESSION_SECRET || 'cle_secrete_immogerer_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Mettre à false pour éviter les blocages de cookies sur Render sans HTTPS strict forcé
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // Session valide 24 heures
    }
}));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- MIDDLEWARE DE SÉCURITÉ ---
function verifierAuth(req, res, next) {
    if (req.session && req.session.connecte) {
        return next();
    }
    // Si c'est une requête API qui échoue, on renvoie un statut 401 (Non autorisé)
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ erreur: "Non authentifié" });
    }
    // Sinon, on redirige vers le login
    res.redirect('/login');
}

// --- ROUTES D'AUTHENTIFICATION ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.connecte = true;
        // Sauvegarde explicite de la session avant redirection
        req.session.save(() => {
            res.redirect('/');
        });
    } else {
        res.redirect('/login?erreur=1');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// --- ROUTES PAGES PROTÉGÉES ---
app.get('/', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/biens', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));
app.get('/comptabilite', verifierAuth, (req, res) => res.sendFile(path.join(__dirname, 'comptabilite.html')));
