// Express server setup
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/views'));

// SQLite DB setup
const db = new sqlite3.Database('./contacts.db', (err) => {
  if (err) console.error('DB error:', err);
  else console.log('SQLite DB connected');
});

// Create table if not exists
const createTable = `CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  adresse TEXT,
  tag TEXT
);`;
db.run(createTable);

// ...API routes will be added here...
// Ajouter un contact
app.post('/contacts', (req, res) => {
  const { nom, prenom, telephone, adresse, tag } = req.body;
  db.run(
    'INSERT INTO contacts (nom, prenom, telephone, adresse, tag) VALUES (?, ?, ?, ?, ?)',
    [nom, prenom, telephone, adresse, tag],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Récupérer tous les contacts
app.get('/contacts', (req, res) => {
  db.all('SELECT * FROM contacts', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Vue mobile-friendly pour afficher les contacts
app.get('/', (req, res) => {
  db.all('SELECT * FROM contacts', [], (err, contacts) => {
    if (err) return res.status(500).send('Erreur DB');
    res.render('index', { contacts, error: null });
  });
});

// Ajout de contact via le formulaire EJS
app.post('/add', (req, res) => {
  const { nom, prenom, telephone, adresse, tag } = req.body;
  db.get('SELECT * FROM contacts WHERE telephone = ?', [telephone], (err, row) => {
    if (err) return res.status(500).send('Erreur DB');
    if (row) {
      // Numéro déjà enregistré
      db.all('SELECT * FROM contacts', [], (err, contacts) => {
        if (err) return res.status(500).send('Erreur DB');
        res.render('index', { contacts, error: 'Numéro déjà enregistré !' });
      });
    } else {
      db.run(
        'INSERT INTO contacts (nom, prenom, telephone, adresse, tag) VALUES (?, ?, ?, ?, ?)',
        [nom, prenom, telephone, adresse, tag],
        function (err) {
          if (err) return res.status(500).send('Erreur DB');
          res.redirect('/');
        }
      );
    }
  });
});

// Route pour modifier le statut d'un contact existant
app.post('/update-status', (req, res) => {
  const { telephone, newtag } = req.body;
  db.run('UPDATE contacts SET tag = ? WHERE telephone = ?', [newtag, telephone], function (err) {
    if (err) return res.status(500).send('Erreur DB');
    res.redirect('/');
  });
});

// Mettre à jour un contact
app.put('/contacts/:id', (req, res) => {
  const { nom, prenom, telephone, adresse, tag } = req.body;
  db.run(
    'UPDATE contacts SET nom = ?, prenom = ?, telephone = ?, adresse = ?, tag = ? WHERE id = ?',
    [nom, prenom, telephone, adresse, tag, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

// Supprimer un contact
app.delete('/contacts/:id', (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Route pour l'autocomplétion d'adresse
const fetch = require('node-fetch');
app.get('/search-adresse', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  try {
    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    const suggestions = data.features.map(f => f.properties.label);
    res.json(suggestions);
  } catch (e) {
    res.status(500).json({ error: 'Erreur API adresse' });
  }
});
