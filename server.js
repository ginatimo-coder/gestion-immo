const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Fichiers statiques
app.use(express.static(path.join(__dirname)));

// Connexion PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- ROUTES PAGES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

app.get('/locataires', (req, res) => {
    res.sendFile(path.join(__dirname, 'locataires.html'));
});

// --- API : LISTER LES LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture locataires :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : AJOUTER UN LOCATAIRE ---
app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/locataires');
    } catch (err) {
        console.error("Erreur insertion :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : MODIFIER UN LOCATAIRE ---
app.put('/api/locataires/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            UPDATE locataires 
            SET nom = $1, prenom = $2, email = $3, telephone = $4, date_naissance = $5 
            WHERE id = $6;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance, id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur modification :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : SUPPRIMER UN LOCATAIRE ---
app.delete('/api/locataires/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM locataires WHERE id = $1;', [id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
