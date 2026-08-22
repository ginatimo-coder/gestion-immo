const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuration cruciale : permet au serveur de servir le CSS, les images et les scripts statiques
app.use(express.static(path.join(__dirname)));

// Configuration de la connexion à la base de données PostgreSQL sur Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Indispensable pour les connexions cloud sécurisées vers Render
    }
});

// Middlewares pour analyser les données des formulaires et le format JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route principale : affiche le tableau de bord
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Route pour afficher la page de création d'un nouveau locataire
app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

// Route API pour enregistrer un nouveau locataire dans la base de données
app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const values = [nom, prenom, email, telephone, date_naissance];
        await pool.query(query, values);
        
        // Redirection vers le tableau de bord après un enregistrement réussi
        res.redirect('/');
    } catch (err) {
        console.error("Erreur lors de l'insertion du locataire :", err);
        res.status(500).send("Erreur serveur lors de l'enregistrement.");
    }
});

// Démarrage du serveur web
app.listen(port, () => {
    console.log(`Serveur démarré et à l'écoute sur le port ${port}`);
});