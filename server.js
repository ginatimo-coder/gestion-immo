const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création automatique de toutes les tables, incluant la comptabilité générale
pool.query(`
    CREATE TABLE IF NOT EXISTS locataires (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100),
        prenom VARCHAR(100),
        email VARCHAR(100),
        telephone VARCHAR(50),
        date_naissance DATE
    );

    CREATE TABLE IF NOT EXISTS biens (
        id SERIAL PRIMARY KEY,
        nom_bien VARCHAR(150),
        type VARCHAR(50),
        loyer NUMERIC,
        statut VARCHAR(50) DEFAULT 'Libre'
    );

    CREATE TABLE IF NOT EXISTS baux (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_debut DATE,
        date_fin DATE,
        contrat_url TEXT
    );

    CREATE TABLE IF NOT EXISTS paiements (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_paiement DATE,
        montant NUMERIC,
        statut VARCHAR(50) DEFAULT 'Payé'
    );

    CREATE TABLE IF NOT EXISTS journal_comptable (
        id SERIAL PRIMARY KEY,
        date_operation DATE,
        libelle TEXT,
        compte_debit VARCHAR(50),
        compte_credit VARCHAR(50),
        montant NUMERIC,
        type_flux VARCHAR(50) -- 'Encaissement', 'Decaissement'
    );
`).then(() => {
    console.log("Base de données et module de comptabilité prêts.");
}).catch(err => console.error("Erreur tables:", err));

// --- ROUTES PAGES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/biens', (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));
app.get('/comptabilite', (req, res) => res.sendFile(path.join(__dirname, 'comptabilite.html')));

// --- API : LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
    res.json(result.rows);
});
app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    await pool.query('INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) VALUES ($1, $2, $3, $4, $5)', [nom, prenom, email, telephone, date_naissance]);
    res.redirect('/locataires');
});
app.delete('/api/locataires/:id', async (req, res) => {
    await pool.query('DELETE FROM locataires WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
});

// --- API : BIENS ---
app.get('/api/biens', async (req, res) => {
    const result = await pool.query('SELECT * FROM biens ORDER BY id DESC');
    res.json(result.rows);
});
app.post('/api/biens', async (req, res) => {
    const { nom_bien, type, loyer, statut } = req.body;
    await pool.query('INSERT INTO biens (nom_bien, type, loyer, statut) VALUES ($1, $2, $3, $4)', [nom_bien, type, loyer, statut || 'Libre']);
    res.redirect('/biens');
});
app.delete('/api/biens/:id', async (req, res) => {
    await pool.query('DELETE FROM biens WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
});

// --- API : BAUX ---
app.get('/api/baux', async (req, res) => {
    const query = `
        SELECT baux.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
        FROM baux 
        JOIN locataires ON baux.locataire_id = locataires.id 
        JOIN biens ON baux.bien_id = biens.id 
        ORDER BY baux.id DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
});
app.post('/api/baux', async (req, res) => {
    const { locataire_id, bien_id, date_debut, date_fin, contrat_url } = req.body;
    await pool.query('INSERT INTO baux (locataire_id, bien_id, date_debut, date_fin, contrat_url) VALUES ($1, $2, $3, $4, $5)', [locataire_id, bien_id, date_debut, date_fin || null, contrat_url || null]);
    await pool.query("UPDATE biens SET statut = 'Loué' WHERE id = $1", [bien_id]);
    res.redirect('/baux');
});
app.delete('/api/baux/:id', async (req, res) => {
    const bail = await pool.query('SELECT bien_id FROM baux WHERE id = $1', [req.params.id]);
    if (bail.rows.length > 0) {
        await pool.query("UPDATE biens SET statut = 'Libre' WHERE id = $1", [bail.rows[0].bien_id]);
    }
    await pool.query('DELETE FROM baux WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
});

// --- API : PAIEMENTS & COMPTABILITE AUTOMATIQUE ---
app.get('/api/paiements', async (req, res) => {
    const query = `
        SELECT paiements.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
        FROM paiements 
        JOIN locataires ON paiements.locataire_id = locataires.id 
        JOIN biens ON paiements.bien_id = biens.id 
        ORDER BY paiements.id DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
});

app.post('/api/paiements', async (req, res) => {
    const { locataire_id, bien_id, date_paiement, montant, statut } = req.body;
    try {
        // 1. Enregistrer le paiement
        const payRes = await pool.query(
            'INSERT INTO paiements (locataire_id, bien_id, date_paiement, montant, statut) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [locataire_id, bien_id, date_paiement, montant, statut || 'Payé']
        );

        // 2. Générer automatiquement l'écriture dans le journal comptable général (Débit Caisse / Crédit Location)
        if ((statut || 'Payé') === 'Payé') {
            await pool.query(
                `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
                 VALUES ($1, $2, '531 - Caisse', '706 - Location de biens', $3, 'Encaissement')`,
                [date_paiement, `Encaissement loyer - Locataire ID ${locataire_id}`, montant]
            );
        }
        res.redirect('/paiements');
    } catch (err) {
        console.error("Erreur paiement:", err);
        res.status(500).send("Erreur serveur");
    }
});

app.delete('/api/paiements/:id', async (req, res) => {
    await pool.query('DELETE FROM paiements WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
});

// --- API : COMPTABILITE GENERALE (Journal, Grand Livre, Balance, Compte de Résultat) ---
app.get('/api/comptabilite/journal', async (req, res) => {
    const result = await pool.query('SELECT * FROM journal_comptable ORDER BY date_operation DESC, id DESC');
    res.json(result.rows);
});

app.get('/api/comptabilite/synthese', async (req, res) => {
    try {
        // Calcul du total des produits (classe 7) et charges (classe 6) pour le Compte de Résultat et la Balance
        const ecritures = await pool.query('SELECT * FROM journal_comptable');
        
        let totalProduits = 0;
        let totalCharges = 0;
        let totalCaisse = 0;
        let comptesMap = {};

        ecritures.rows.forEach(e => {
            const m = parseFloat(e.montant);
            
            // Traitement Débit / Crédit basique pour balance
            if(!comptesMap[e.compte_debit]) comptesMap[e.compte_debit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_debit].debit += m;

            if(!comptesMap[e.compte_credit]) comptesMap[e.compte_credit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_credit].credit += m;

            if(e.compte_credit.startsWith('7')) totalProduits += m;
            if(e.compte_debit.startsWith('6')) totalCharges += m;
            if(e.compte_debit.startsWith('531')) totalCaisse += m;
        });

        res.json({
            comptes: comptesMap,
            totalProduits,
            totalCharges,
            resultatNet: totalProduits - totalCharges,
            totalCaisse
        });
    } catch (err) {
        res.status(500).send("Erreur calcul comptable");
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
