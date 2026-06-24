let currentSurveyId = null;
let questionCount = 0;

// View Management
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (viewName === 'list') {
        loadSurveys();
    } else if (viewName === 'respond') {
        loadSurveysForRespond();
    }
}

// Umfragen laden und anzeigen
async function loadSurveys() {
    try {
        const response = await fetch('/api/surveys');
        const surveys = await response.json();

        const list = document.getElementById('surveys-list');

        if (surveys.length === 0) {
            list.innerHTML = '<p class="placeholder">Keine Umfragen vorhanden</p>';
            return;
        }

        list.innerHTML = surveys.map(survey => `
            <div class="survey-card">
                <h3>${survey.title}</h3>
                <p>${survey.description || 'Keine Beschreibung'}</p>
                <div class="survey-card-meta">
                    <span>${new Date(survey.created_at).toLocaleDateString('de-DE')}</span>
                </div>
                <div class="survey-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewSurveyResults(${survey.id})">Ergebnisse</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSurvey(${survey.id})">Löschen</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Fehler beim Laden der Umfragen:', error);
    }
}

// Umfragen für Antwort-View laden
async function loadSurveysForRespond() {
    try {
        const response = await fetch('/api/surveys');
        const surveys = await response.json();

        const select = document.getElementById('respond-survey');
        select.innerHTML = '<option value="">-- Umfrage wählen --</option>' +
            surveys.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    } catch (error) {
        console.error('Fehler beim Laden der Umfragen:', error);
    }
}

// Umfrage zum Beantworten laden
async function loadSurveyForResponse() {
    const surveyId = document.getElementById('respond-survey').value;
    if (!surveyId) return;

    try {
        const response = await fetch(`/api/surveys/${surveyId}`);
        const survey = await response.json();

        const container = document.getElementById('response-questions-container');
        container.innerHTML = '';

        survey.questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'response-question';

            let optionsHTML = '';

            if (question.question_type === 'multiple_choice' && question.options.length > 0) {
                optionsHTML = `<div class="response-options">
                    ${question.options.map(option => `
                        <div class="response-option">
                            <input type="radio" id="q${question.id}_o${option.id}"
                                   name="question_${question.id}"
                                   value="${option.id}"
                                   data-option-id="${option.id}">
                            <label for="q${question.id}_o${option.id}">${option.option_text}</label>
                        </div>
                    `).join('')}
                </div>`;
            } else if (question.question_type === 'text') {
                optionsHTML = `<input type="text"
                               name="question_${question.id}"
                               placeholder="Deine Antwort..."
                               class="question-text-input">`;
            }

            questionDiv.innerHTML = `
                <h4>${index + 1}. ${question.question_text}</h4>
                ${optionsHTML}
            `;
            container.appendChild(questionDiv);
        });

        document.getElementById('response-form').style.display = 'flex';
        document.getElementById('respond-select').style.display = 'none';

        document.getElementById('response-form').onsubmit = (e) => submitResponses(e, surveyId);
    } catch (error) {
        console.error('Fehler beim Laden der Umfrage:', error);
    }
}

// Antworten absenden
async function submitResponses(e, surveyId) {
    e.preventDefault();

    const survey = await fetch(`/api/surveys/${surveyId}`).then(r => r.json());
    const answers = [];

    survey.questions.forEach(question => {
        const inputName = `question_${question.id}`;
        const input = document.querySelector(`[name="${inputName}"]`);

        if (input) {
            if (input.type === 'radio') {
                const checked = document.querySelector(`[name="${inputName}"]:checked`);
                if (checked) {
                    answers.push({
                        question_id: question.id,
                        option_id: parseInt(checked.dataset.optionId),
                        answer_text: checked.value
                    });
                }
            } else if (input.type === 'text') {
                answers.push({
                    question_id: question.id,
                    answer_text: input.value
                });
            }
        }
    });

    try {
        const response = await fetch(`/api/surveys/${surveyId}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                respondent_id: 'respondent_' + Date.now(),
                answers: answers
            })
        });

        if (response.ok) {
            alert('Danke für deine Antworten!');
            document.getElementById('response-form').reset();
            document.getElementById('response-form').style.display = 'none';
            document.getElementById('respond-select').style.display = 'flex';
            document.getElementById('respond-survey').value = '';
        }
    } catch (error) {
        console.error('Fehler beim Absenden der Antworten:', error);
        alert('Fehler beim Absenden der Antworten');
    }
}

// Neue Frage hinzufügen
function addQuestionForm() {
    const container = document.getElementById('questions-container');

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-form';
    questionDiv.id = `question_${questionCount}`;
    questionCount++;

    questionDiv.innerHTML = `
        <h4>Frage ${container.children.length + 1}</h4>
        <div class="form-group">
            <label>Frage</label>
            <input type="text" class="question-text" placeholder="Stelle eine Frage...">
        </div>
        <div class="form-group">
            <label>Fragentyp</label>
            <select class="question-type" onchange="toggleOptions(this)">
                <option value="multiple_choice">Mehrfachauswahl</option>
                <option value="text">Freitext</option>
            </select>
        </div>
        <div class="form-group options-section">
            <label>Antwortmöglichkeiten</label>
            <div class="options-list" id="options_${questionCount - 1}">
                <div class="option-input">
                    <input type="text" placeholder="Antwortmöglichkeit 1" class="option-text">
                    <button type="button" class="btn-sm" style="background:#007AFF;color:white;border:none;border-radius:4px;" onclick="addOptionInput(this)">+</button>
                </div>
            </div>
        </div>
        <div class="question-controls">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestion('${questionDiv.id}')">Löschen</button>
        </div>
    `;

    container.appendChild(questionDiv);
}

function toggleOptions(selectElement) {
    const optionsSection = selectElement.closest('.question-form').querySelector('.options-section');
    optionsSection.style.display = selectElement.value === 'multiple_choice' ? 'flex' : 'none';
}

function addOptionInput(button) {
    const optionsList = button.closest('.options-list');
    const newOption = document.createElement('div');
    newOption.className = 'option-input';
    newOption.innerHTML = `
        <input type="text" placeholder="Antwortmöglichkeit ${optionsList.children.length + 1}" class="option-text">
        <button type="button" class="btn-sm" style="background:#ff3b30;color:white;border:none;border-radius:4px;" onclick="removeOption(this)">−</button>
    `;
    optionsList.appendChild(newOption);
}

function removeOption(button) {
    button.closest('.option-input').remove();
}

function removeQuestion(questionId) {
    document.getElementById(questionId).remove();
}

// Umfrage erstellen
document.getElementById('create-survey-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('survey-title').value;
    const description = document.getElementById('survey-desc').value;

    // Fragen sammeln
    const questions = [];
    document.querySelectorAll('.question-form').forEach((qForm, index) => {
        const questionText = qForm.querySelector('.question-text').value;
        const questionType = qForm.querySelector('.question-type').value;

        if (!questionText.trim()) {
            alert('Bitte alle Fragen ausfüllen');
            return;
        }

        const options = [];
        if (questionType === 'multiple_choice') {
            qForm.querySelectorAll('.option-text').forEach(input => {
                if (input.value.trim()) {
                    options.push(input.value.trim());
                }
            });

            if (options.length === 0) {
                alert('Bitte mindestens eine Antwortmöglichkeit hinzufügen');
                return;
            }
        }

        questions.push({
            question_text: questionText,
            question_type: questionType,
            order_num: index,
            options: options
        });
    });

    try {
        // Umfrage erstellen
        const surveyResponse = await fetch('/api/surveys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });

        const survey = await surveyResponse.json();

        // Fragen erstellen
        for (const question of questions) {
            await fetch(`/api/surveys/${survey.id}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(question)
            });
        }

        alert('Umfrage erfolgreich erstellt!');
        document.getElementById('create-survey-form').reset();
        document.getElementById('questions-container').innerHTML = '';
        questionCount = 0;
        showView('list');
    } catch (error) {
        console.error('Fehler:', error);
        alert('Fehler beim Erstellen der Umfrage');
    }
});

// Umfrage löschen
async function deleteSurvey(surveyId) {
    if (confirm('Soll diese Umfrage wirklich gelöscht werden?')) {
        try {
            await fetch(`/api/surveys/${surveyId}`, { method: 'DELETE' });
            loadSurveys();
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
        }
    }
}

// Umfrageergebnisse anzeigen
async function viewSurveyResults(surveyId) {
    try {
        const surveyResponse = await fetch(`/api/surveys/${surveyId}`);
        const survey = await surveyResponse.json();

        const statsResponse = await fetch(`/api/surveys/${surveyId}/statistics`);
        const stats = await statsResponse.json();

        const modal = document.getElementById('results-modal');
        const resultsContainer = document.getElementById('results-container');

        // Header mit Umfragetitel
        document.getElementById('results-title').textContent = survey.title;

        // Stats-Karten
        let html = `
            <div class="results-stats">
                <div class="stat-card">
                    <div class="stat-number">${stats.total_responses}</div>
                    <div class="stat-label">Teilnehmer</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${survey.questions.length}</div>
                    <div class="stat-label">Fragen</div>
                </div>
            </div>
        `;

        // Gruppiere Statistiken nach Frage
        const groupedStats = {};
        stats.statistics.forEach(stat => {
            if (!groupedStats[stat.id]) {
                groupedStats[stat.id] = {
                    question_text: stat.question_text,
                    options: []
                };
            }
            if (stat.option_text) {
                groupedStats[stat.id].options.push({
                    option_text: stat.option_text,
                    answer_count: stat.answer_count
                });
            }
        });

        // Ergebnisse für jede Frage anzeigen
        Object.values(groupedStats).forEach(question => {
            html += `<div class="result-question"><h4>${question.question_text}</h4>`;
            question.options.forEach(option => {
                const percentage = stats.total_responses > 0
                    ? ((option.answer_count / stats.total_responses) * 100).toFixed(1)
                    : 0;
                html += `
                    <div class="result-option">
                        <div class="result-option-label">
                            <span class="result-option-text">${option.option_text}</span>
                            <span class="result-option-stats">${option.answer_count} Stimmen (${percentage}%)</span>
                        </div>
                        <div class="result-bar">
                            <div class="result-bar-fill" style="width: ${percentage}%">${percentage > 5 ? percentage + '%' : ''}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        });

        resultsContainer.innerHTML = html;
        modal.classList.add('active');
    } catch (error) {
        console.error('Fehler beim Laden der Ergebnisse:', error);
        alert('Fehler beim Laden der Ergebnisse');
    }
}

// Modal schließen
function closeResults() {
    document.getElementById('results-modal').classList.remove('active');
}

// Initial load
loadSurveys();
