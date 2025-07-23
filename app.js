const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Initialisation SQLite
const db = new sqlite3.Database('./contacts.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT,
    prenom TEXT,
    num_tel TEXT,
    adresse TEXT,
    contact_statut TEXT,
    reponse_statut TEXT,
    commentaire TEXT
  )`);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Status options
const contactStatus = ['En attente', 'GMS', 'Porte à porte', 'Téléphone'];
const responseStatus = ['En attente', 'Possibilité', 'Accepté', 'Refus', 'À recontacter'];

// List contacts
app.get('/', (req, res) => {
  const q = req.query.q ? req.query.q.trim().toLowerCase() : '';
  let sql = 'SELECT * FROM contacts';
  let params = [];
  if (q) {
    sql += ` WHERE 
      LOWER(nom) LIKE ? OR
      LOWER(prenom) LIKE ? OR
      LOWER(num_tel) LIKE ? OR
      LOWER(adresse) LIKE ? OR
      LOWER(contact_statut) LIKE ? OR
      LOWER(reponse_statut) LIKE ? OR
      LOWER(commentaire) LIKE ?`;
    params = Array(7).fill(`%${q}%`);
  }
  db.all(sql, params, (err, rows) => {
    res.render('index', { contacts: rows, q });
  });
});

// Add contact form
app.get('/add', (req, res) => {
  res.render('form', { contact: {}, contactStatus, responseStatus, action: '/add', method: 'POST' });
});

// Add contact
app.post('/add', (req, res) => {
  const { nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire } = req.body;
  db.get('SELECT * FROM contacts WHERE num_tel = ? OR adresse = ?', [num_tel, adresse], (err, duplicate) => {
    if (duplicate) {
      return res.render('form', {
        contact: {},
        contactStatus,
        responseStatus,
        action: '/add',
        method: 'POST',
        notif: `Ce contact existe déjà (numéro ou adresse). <a href=\"/edit/${duplicate.id}\">Modifier ?</a>`,
        duplicateContact: duplicate
      });
    }
    db.run('INSERT INTO contacts (nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire],
      function(err) {
        res.redirect('/');
      }
    );
  });
});

// Edit contact form
app.get('/edit/:id', (req, res) => {
  db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, contact) => {
    if (!contact) return res.redirect('/');
    res.render('form', { contact, contactStatus, responseStatus, action: `/edit/${contact.id}`, method: 'POST' });
  });
});

// Edit contact
app.post('/edit/:id', (req, res) => {
  const { nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire } = req.body;
  db.run('UPDATE contacts SET nom = ?, prenom = ?, num_tel = ?, adresse = ?, contact_statut = ?, reponse_statut = ?, commentaire = ? WHERE id = ?',
    [nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire, req.params.id],
    function(err) {
      res.redirect('/');
    }
  );
});

// Delete contact
app.post('/delete/:id', (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function(err) {
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
