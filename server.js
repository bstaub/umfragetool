const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(__dirname));

// Datenbankverzeichnis erstellen (für Docker)
const dbDir = process.env.DB_PATH || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// SQLite Datenbank initialisieren
const db = new sqlite3.Database(path.join(dbDir, 'umfragen.db'), (err) => {
    if (err) {
        console.error('Fehler beim Öffnen der Datenbank:', err);
    } else {
        console.log('SQLite Datenbank verbunden');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Umfragen-Tabelle
        db.run(`
            CREATE TABLE IF NOT EXISTS surveys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active'
            )
        `);

        // Fragen-Tabelle
        db.run(`
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                survey_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                question_type TEXT DEFAULT 'multiple_choice',
                order_num INTEGER,
                FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
            )
        `);

        // Antwort-Optionen-Tabelle
        db.run(`
            CREATE TABLE IF NOT EXISTS options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                option_text TEXT NOT NULL,
                order_num INTEGER,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
            )
        `);

        // Antworten-Tabelle
        db.run(`
            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                survey_id INTEGER NOT NULL,
                respondent_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
            )
        `);

        // Einzelne Antworten-Tabelle
        db.run(`
            CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                response_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                answer_text TEXT,
                option_id INTEGER,
                FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
                FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE
            )
        `);
    });
}

// API Endpoints

// GET: Alle Umfragen
app.get('/api/surveys', (req, res) => {
    db.all('SELECT * FROM surveys ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// GET: Umfrage mit Fragen und Optionen
app.get('/api/surveys/:id', (req, res) => {
    const surveyId = req.params.id;

    db.get('SELECT * FROM surveys WHERE id = ?', [surveyId], (err, survey) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        db.all('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_num', [surveyId], (err, questions) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const questionsWithOptions = questions.map(q => ({
                ...q,
                options: []
            }));

            let completed = 0;
            questionsWithOptions.forEach(question => {
                db.all('SELECT * FROM options WHERE question_id = ? ORDER BY order_num', [question.id], (err, options) => {
                    if (!err) {
                        question.options = options;
                    }
                    completed++;

                    if (completed === questionsWithOptions.length) {
                        res.json({ ...survey, questions: questionsWithOptions });
                    }
                });
            });

            if (questionsWithOptions.length === 0) {
                res.json({ ...survey, questions: [] });
            }
        });
    });
});

// POST: Neue Umfrage erstellen
app.post('/api/surveys', (req, res) => {
    const { title, description } = req.body;

    db.run('INSERT INTO surveys (title, description) VALUES (?, ?)',
        [title, description],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, title, description, created_at: new Date() });
        }
    );
});

// POST: Neue Frage
app.post('/api/surveys/:surveyId/questions', (req, res) => {
    const { surveyId } = req.params;
    const { question_text, question_type, order_num, options } = req.body;

    db.run('INSERT INTO questions (survey_id, question_text, question_type, order_num) VALUES (?, ?, ?, ?)',
        [surveyId, question_text, question_type, order_num],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const questionId = this.lastID;
            let completed = 0;

            if (options && options.length > 0) {
                options.forEach((optionText, index) => {
                    db.run('INSERT INTO options (question_id, option_text, order_num) VALUES (?, ?, ?)',
                        [questionId, optionText, index],
                        (err) => {
                            completed++;
                            if (completed === options.length) {
                                res.json({ id: questionId, survey_id: surveyId, question_text, question_type, order_num });
                            }
                        }
                    );
                });
            } else {
                res.json({ id: questionId, survey_id: surveyId, question_text, question_type, order_num });
            }
        }
    );
});

// POST: Antworten speichern
app.post('/api/surveys/:surveyId/responses', (req, res) => {
    const { surveyId } = req.params;
    const { respondent_id, answers } = req.body;

    db.run('INSERT INTO responses (survey_id, respondent_id) VALUES (?, ?)',
        [surveyId, respondent_id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const responseId = this.lastID;
            let completed = 0;

            answers.forEach((answer) => {
                db.run('INSERT INTO answers (response_id, question_id, answer_text, option_id) VALUES (?, ?, ?, ?)',
                    [responseId, answer.question_id, answer.answer_text, answer.option_id],
                    (err) => {
                        completed++;
                        if (completed === answers.length) {
                            res.json({ id: responseId, survey_id: surveyId });
                        }
                    }
                );
            });

            if (answers.length === 0) {
                res.json({ id: responseId, survey_id: surveyId });
            }
        }
    );
});

// GET: Umfrage Statistiken
app.get('/api/surveys/:surveyId/statistics', (req, res) => {
    const { surveyId } = req.params;

    db.get('SELECT COUNT(*) as total FROM responses WHERE survey_id = ?', [surveyId], (err, countRow) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        db.all(`
            SELECT
                q.id,
                q.question_text,
                o.id as option_id,
                o.option_text,
                COUNT(a.id) as answer_count
            FROM questions q
            LEFT JOIN options o ON q.id = o.question_id
            LEFT JOIN answers a ON o.id = a.option_id
            WHERE q.survey_id = ?
            GROUP BY o.id
        `, [surveyId], (err, stats) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({
                total_responses: countRow.total,
                statistics: stats
            });
        });
    });
});

// DELETE: Umfrage löschen
app.delete('/api/surveys/:id', (req, res) => {
    db.run('DELETE FROM surveys WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Umfrage-Tool läuft auf http://localhost:${PORT}`);
});
