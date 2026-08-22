const { Pool } = require('pg');

// Mettez ici votre External Database URL de Render entre guillemets
const pool = new Pool({
    connectionString: 'VOTRE_EXTERNAL_DATABASE_URL_ICI',
    ssl: {
        rejectUnauthorized: false // Indispensable pour Render
    }
});

const scriptSQL = `
CREATE TABLE IF NOT EXISTS batiments (
    id_batiment SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    adresse VARCHAR(255) NOT NULL,
    ville VARCHAR(100) NOT NULL,
    code_postal VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS biens (
    id_bien SERIAL PRIMARY KEY,
    id_batiment INT NOT NULL,
    numero_porte VARCHAR(20) NOT NULL,
    surface_m2 DECIMAL(10, 2) CHECK (surface_m2 > 0),
    nombre_pieces INT CHECK (nombre_pieces > 0),
    loyer_de_base DECIMAL(10, 2) NOT NULL CHECK (loyer_de_base >= 0),
    CONSTRAINT fk_batiment FOREIGN KEY (id_batiment) REFERENCES batiments(id_batiment) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locataires (
    id_locataire SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telephone VARCHAR(30),
    date_naissance DATE
);

CREATE TABLE IF NOT EXISTS baux (
    id_bail SERIAL PRIMARY KEY,
    id_bien INT NOT NULL,
    id_locataire INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE,
    montant_loyer_mensuel DECIMAL(10, 2) NOT NULL CHECK (montant_loyer_mensuel >= 0),
    depot_garantie DECIMAL(10, 2) DEFAULT 0 CHECK (depot_garantie >= 0),
    CONSTRAINT fk_bien FOREIGN KEY (id_bien) REFERENCES biens(id_bien) ON DELETE RESTRICT,
    CONSTRAINT fk_locataire FOREIGN KEY (id_locataire) REFERENCES locataires(id_locataire) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS paiements (
    id_paiement SERIAL PRIMARY KEY,
    id_bail INT NOT NULL,
    montant_paye DECIMAL(10, 2) NOT NULL CHECK (montant_paye > 0),
    date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
    statut_paiement VARCHAR(50) NOT NULL DEFAULT 'Payé',
    mode_paiement VARCHAR(50) NOT NULL,
    CONSTRAINT fk_bail_paiement FOREIGN KEY (id_bail) REFERENCES baux(id_bail) ON DELETE CASCADE
);
`;

async function executerScript() {
    try {
        console.log("Connexion à la base de données sur Render...");
        await pool.query(scriptSQL);
        console.log("Succès ! Toutes les tables ont été créées dans le cloud.");
        process.exit(0);
    } catch (erreur) {
        console.error("Erreur lors de la création des tables :", erreur);
        process.exit(1);
    }
}

executerScript();