const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Permet au serveur de servir le CSS et les fichiers statiques correctement
app.use(express.static(path.join(__dirname)));

// Connexion à la base de données PostgreSQL sur Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middlewares pour lire les données des formulaires
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route principale : affiche index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour la page nouveau locataire
app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

// Route pour enregistrer un locataire en base de données
app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/');
    } catch (err) {
        console.error("Erreur lors de l'insertion :", err);
        res.status(500).send("Erreur serveur lors de l'enregistrement.");
    }
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Serveur démarré et à l'écoute sur le port ${port}`);
});