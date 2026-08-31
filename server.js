const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création automatique des tables et mise à jour des colonnes si nécessaire
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

    ALTER TABLE baux ADD COLUMN IF NOT EXISTS contrat_url TEXT;

    CREATE TABLE IF NOT EXISTS paiements (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_paiement DATE,
        montant NUMERIC,
        statut VARCHAR(50) DEFAULT 'Payé'
    );

    CREATE TABLE IF NOT EXISTS factures (
        id SERIAL PRIMARY KEY,
        numero_ref VARCHAR(50),
        type VARCHAR(30),
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        montant NUMERIC(12, 2),
        date_emission DATE,
        date_validite DATE,
        statut VARCHAR(30) DEFAULT 'Impayée'
    );

    ALTER TABLE factures ADD COLUMN IF NOT EXISTS numero_ref VARCHAR(50);
    ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_validite DATE;

    CREATE TABLE IF NOT EXISTS facture_lignes (
        id SERIAL PRIMARY KEY,
        facture_id INT REFERENCES factures(id) ON DELETE CASCADE,
        designation TEXT,
        montant NUMERIC(12, 2)
    );

    CREATE TABLE IF NOT EXISTS journal_comptable (
        id SERIAL PRIMARY KEY,
        date_operation DATE,
        libelle TEXT,
        compte_debit VARCHAR(50),
        compte_credit VARCHAR(50),
        montant NUMERIC,
        type_flux VARCHAR(50)
    );

    -- TABLES RESSOURCES HUMAINES (RH) --
    CREATE TABLE IF NOT EXISTS employes (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        telephone VARCHAR(50),
        adresse TEXT,
        lieu_naissance VARCHAR(100),
        date_naissance DATE,
        enfants_charges INTEGER DEFAULT 0,
        poste VARCHAR(100),
        departement VARCHAR(100),
        date_embauche DATE,
        type_contrat VARCHAR(50),
        salaire_base NUMERIC(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE employes ADD COLUMN IF NOT EXISTS adresse TEXT;
    ALTER TABLE employes ADD COLUMN IF NOT EXISTS lieu_naissance VARCHAR(100);
    ALTER TABLE employes ADD COLUMN IF NOT EXISTS date_naissance DATE;
    ALTER TABLE employes ADD COLUMN IF NOT EXISTS enfants_charges INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS paie (
        id SERIAL PRIMARY KEY,
        employe_id INTEGER REFERENCES employes(id) ON DELETE CASCADE,
        mois VARCHAR(20),
        annee INTEGER,
        primes NUMERIC(12, 2) DEFAULT 0,
        heures_sup NUMERIC(12, 2) DEFAULT 0,
        charges_sociales NUMERIC(12, 2) DEFAULT 0,
        salaire_net NUMERIC(12, 2) DEFAULT 0,
        date_paiement DATE DEFAULT CURRENT_DATE
    );
`).catch(err => console.error("Erreur tables:", err));

// --- ROUTES D'AUTHENTIFICATION ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie('auth', 'true', { maxAge: 86400000, httpOnly: false });
        res.redirect('/');
    } else {
        res.redirect('/login?erreur=1');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/login');
});

// --- ROUTES PAGES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/biens', (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));
app.get('/factures', (req, res) => res.sendFile(path.join(__dirname, 'factures.html')));
app.get('/comptabilite', (req, res) => res.sendFile(path.join(__dirname, 'comptabilite.html')));
app.get('/rh', (req, res) => res.sendFile(path.join(__dirname, 'rh.html')));

// --- API LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/locataires', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, date_naissance } = req.body;
        await pool.query(
            'INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) VALUES ($1, $2, $3, $4, $5)',
            [nom, prenom, email, telephone, date_naissance || null]
        );
        res.redirect('/locataires');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/locataires/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM locataires WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API BIENS ---
app.get('/api/biens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM biens ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/biens', async (req, res) => {
    try {
        const { nom_bien, type, loyer, statut } = req.body;
        await pool.query(
            'INSERT INTO biens (nom_bien, type, loyer, statut) VALUES ($1, $2, $3, $4)',
            [nom_bien, type, loyer, statut || 'Libre']
        );
        res.redirect('/biens');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/biens/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM biens WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API BAUX ---
app.get('/api/baux', async (req, res) => {
    try {
        const query = `
            SELECT baux.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM baux 
            JOIN locataires ON baux.locataire_id = locataires.id 
            JOIN biens ON baux.bien_id = biens.id 
            ORDER BY baux.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/baux', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_debut, date_fin, contrat_url } = req.body;
        if (!date_debut || date_debut.trim() === '') date_debut = null;
        if (!date_fin || date_fin.trim() === '') date_fin = null;

        await pool.query(
            'INSERT INTO baux (locataire_id, bien_id, date_debut, date_fin, contrat_url) VALUES ($1, $2, $3, $4, $5)',
            [locataire_id, bien_id, date_debut, date_fin, contrat_url || null]
        );
        await pool.query("UPDATE biens SET statut = 'Loué' WHERE id = $1", [bien_id]);
        res.redirect('/baux');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/baux/:id', async (req, res) => {
    try {
        const bail = await pool.query('SELECT bien_id FROM baux WHERE id = $1', [req.params.id]);
        if (bail.rows.length > 0) {
            await pool.query("UPDATE biens SET statut = 'Libre' WHERE id = $1", [bail.rows[0].bien_id]);
        }
        await pool.query('DELETE FROM baux WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API PAIEMENTS ---
app.get('/api/paiements', async (req, res) => {
    try {
        const query = `
            SELECT paiements.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM paiements 
            JOIN locataires ON paiements.locataire_id = locataires.id 
            JOIN biens ON paiements.bien_id = biens.id 
            ORDER BY paiements.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/paiements', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_paiement, montant, statut } = req.body;
        if (!date_paiement || date_paiement.trim() === '') date_paiement = null;

        await pool.query(
            'INSERT INTO paiements (locataire_id, bien_id, date_paiement, montant, statut) VALUES ($1, $2, $3, $4, $5)',
            [locataire_id, bien_id, date_paiement, montant, statut || 'Payé']
        );
        if ((statut || 'Payé') === 'Payé') {
            await pool.query(
                `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
                 VALUES ($1, $2, '531 - Caisse', '706 - Location de biens', $3, 'Encaissement')`,
                [date_paiement, `Encaissement loyer - Locataire ID ${locataire_id}`, montant]
            );
        }
        res.redirect('/paiements');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/paiements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM paiements WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API FACTURES, PROFORMAS & BL ---
app.get('/api/factures/prochain-numero/:type', async (req, res) => {
    try {
        const typeDoc = req.params.type;
        const prefix = typeDoc === 'Facture' ? 'FAC' : typeDoc === 'Proforma' ? 'PRO' : 'BL';
        const annee = new Date().getFullYear();
        
        const result = await pool.query('SELECT COUNT(*) as total FROM factures WHERE type = $1', [typeDoc]);
        const nextNum = parseInt(result.rows[0].total) + 1;
        const numeroRef = `${prefix}-${annee}-${String(nextNum).padStart(3, '0')}`;
        
        res.json({ numero_ref: numeroRef });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/factures', async (req, res) => {
    try {
        const query = `
            SELECT factures.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM factures 
            LEFT JOIN locataires ON factures.locataire_id = locataires.id 
            LEFT JOIN biens ON factures.bien_id = biens.id 
            ORDER BY factures.id DESC;
        `;
        const result = await pool.query(query);
        let factures = result.rows;

        for (let f of factures) {
            const lignesRes = await pool.query('SELECT * FROM facture_lignes WHERE facture_id = $1', [f.id]);
            f.lignes = lignesRes.rows;
        }

        res.json(factures);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/factures', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let { numero_ref, type, locataire_id, bien_id, date_emission, date_validite, statut, lignes } = req.body;
        
        let montantTotal = 0;
        if (lignes && Array.isArray(lignes)) {
            lignes.forEach(l => montantTotal += parseFloat(l.montant) || 0);
        }

        const facResult = await client.query(
            'INSERT INTO factures (numero_ref, type, locataire_id, bien_id, montant, date_emission, date_validite, statut) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [numero_ref, type, locataire_id || null, bien_id || null, montantTotal, date_emission || null, date_validite || null, statut || 'Impayée']
        );
        
        const factureId = facResult.rows[0].id;

        if (lignes && Array.isArray(lignes)) {
            for (let l of lignes) {
                if (l.designation && l.montant) {
                    await client.query(
                        'INSERT INTO facture_lignes (facture_id, designation, montant) VALUES ($1, $2, $3)',
                        [factureId, l.designation, l.montant]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).send(err.message);
    } finally {
        client.release();
    }
});

app.delete('/api/factures/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM factures WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API RESSOURCES HUMAINES (RH) ---
app.get('/api/employes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employes ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/employes', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, adresse, lieu_naissance, date_naissance, enfants_charges, poste, departement, date_embauche, type_contrat, salaire_base } = req.body;
        await pool.query(
            `INSERT INTO employes (nom, prenom, email, telephone, adresse, lieu_naissance, date_naissance, enfants_charges, poste, departement, date_embauche, type_contrat, salaire_base) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [nom, prenom, email, telephone, adresse, lieu_naissance, date_naissance || null, enfants_charges || 0, poste, departement, date_embauche || null, type_contrat, salaire_base || 0]
        );
        res.redirect('/rh');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put('/api/employes/:id', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, adresse, lieu_naissance, date_naissance, enfants_charges, poste, departement, type_contrat, salaire_base } = req.body;
        await pool.query(
            `UPDATE employes SET nom = $1, prenom = $2, email = $3, telephone = $4, adresse = $5, lieu_naissance = $6, date_naissance = $7, enfants_charges = $8, poste = $9, departement = $10, type_contrat = $11, salaire_base = $12 WHERE id = $13`,
            [nom, prenom, email, telephone, adresse, lieu_naissance, date_naissance || null, enfants_charges || 0, poste, departement, type_contrat, salaire_base, req.params.id]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/employes/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employes WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/paie', async (req, res) => {
    try {
        const query = `
            SELECT paie.*, employes.nom, employes.prenom, employes.poste 
            FROM paie 
            JOIN employes ON paie.employe_id = employes.id 
            ORDER BY paie.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/paie', async (req, res) => {
    try {
        const { employe_id, mois, annee, primes, heures_sup, charges_sociales, salaire_net } = req.body;
        await pool.query(
            `INSERT INTO paie (employe_id, mois, annee, primes, heures_sup, charges_sociales, salaire_net) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [employe_id, mois, annee, primes || 0, heures_sup || 0, charges_sociales || 0, salaire_net]
        );
        await pool.query(
            `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
             VALUES (CURRENT_DATE, $1, '641 - Rémunérations du personnel', '531 - Caisse', $2, 'Décaissement')`,
            [`Paie - Employé ID ${employe_id} (${mois} ${annee})`, salaire_net]
        );
        res.redirect('/rh');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API COMPTABILITÉ ---
app.get('/api/comptabilite/journal', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM journal_comptable ORDER BY date_operation DESC, id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/comptabilite/ecriture', async (req, res) => {
    try {
        let { date_operation, libelle, compte_debit, compte_credit, montant, type_flux } = req.body;
        if (!date_operation || date_operation.trim() === '') date_operation = null;

        await pool.query(
            `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [date_operation, libelle, compte_debit, compte_credit, montant, type_flux]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/comptabilite/synthese', async (req, res) => {
    try {
        const ecritures = await pool.query('SELECT * FROM journal_comptable');
        let totalProduits = 0;
        let totalCharges = 0;
        let comptesMap = {};

        ecritures.rows.forEach(e => {
            const m = parseFloat(e.montant);
            if(!comptesMap[e.compte_debit]) comptesMap[e.compte_debit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_debit].debit += m;
            if(!comptesMap[e.compte_credit]) comptesMap[e.compte_credit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_credit].credit += m;
            if(e.compte_credit.startsWith('7')) totalProduits += m;
            if(e.compte_debit.startsWith('6')) totalCharges += m;
        });

        res.json({
            comptes: comptesMap,
            totalProduits,
            totalCharges,
            resultatNet: totalProduits - totalCharges
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
