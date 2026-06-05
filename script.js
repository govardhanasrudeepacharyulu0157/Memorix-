/* =====================
   MEMORIX — script.js
   ===================== */

// ── STATE ──
let currentCards = [];
let reviewedCards = new Set();
let selectedDifficulty = 'easy';

// ── ON PAGE LOAD ──
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  setupCharCounter();
});

// ── THEME ──
function loadTheme() {
  const saved = localStorage.getItem('memorix-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '🌙' : '☀️';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('memorix-theme', next);
});

// ── CHAR COUNTER ──
function setupCharCounter() {
  const textarea = document.getElementById('notesInput');
  const counter = document.getElementById('charCount');
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} characters`;
  });
}

// ── CLEAR INPUT ──
function clearInput() {
  document.getElementById('notesInput').value = '';
  document.getElementById('charCount').textContent = '0 characters';
}

// ── DIFFICULTY ──
function setDifficulty(level) {
  selectedDifficulty = level;
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === level);
  });
}

// ── BUILD PROMPT ──
function buildPrompt(notes, type, count, difficulty) {
  const diffMap = {
    easy: 'simple and straightforward',
    medium: 'moderately challenging',
    hard: 'challenging and detailed',
    mixed: 'a mix of easy, medium and hard'
  };

  const diffText = diffMap[difficulty] || 'moderate';

  const prompts = {
    qa: `You are an expert study assistant. Create exactly ${count} high-quality Q&A flashcards from the content below.
Difficulty: ${diffText}.
Return ONLY a valid JSON array, no other text:
[{"type":"qa","question":"...","answer":"..."}]
Content: ${notes}`,

    mcq: `You are an expert study assistant. Create exactly ${count} multiple choice flashcards from the content below.
Difficulty: ${diffText}.
Each card must have exactly 4 options (A, B, C, D) with one correct answer.
Return ONLY a valid JSON array, no other text:
[{"type":"mcq","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":"A. ..."}]
Content: ${notes}`,

    truefalse: `You are an expert study assistant. Create exactly ${count} True/False flashcards from the content below.
Difficulty: ${diffText}.
Return ONLY a valid JSON array, no other text:
[{"type":"truefalse","statement":"...","answer":"True","explanation":"..."}]
Content: ${notes}`,

    fillinblank: `You are an expert study assistant. Create exactly ${count} Fill-in-the-blank flashcards from the content below.
Difficulty: ${diffText}.
Replace the key word/phrase with _____.
Return ONLY a valid JSON array, no other text:
[{"type":"fillinblank","sentence":"The _____ is responsible for photosynthesis.","answer":"chloroplast","hint":"Found in plant cells"}]
Content: ${notes}`
  };

  return prompts[type] || prompts.qa;
}

// ── GENERATE FLASHCARDS ──
async function generateFlashcards() {
  const apiKey = " ;
  const notes = document.getElementById('notesInput').value.trim();
  const cardType = document.getElementById('cardType').value;
  const cardCount = parseInt(document.getElementById('cardCount').value);
  const btn = document.getElementById('generateBtn');
  const btnText = document.getElementById('btnText');
  const resultsSection = document.getElementById('resultsSection');

  // Validations
  if (!apiKey) { showToast('⚠️ Please enter your Groq API key'); return; }
  if (!notes) { showToast('⚠️ Please enter some notes or a topic'); return; }
  if (notes.length < 5) { showToast('⚠️ Please enter more content'); return; }

  // Loading state
  btn.disabled = true;
  btnText.textContent = '⏳ Generating...';
  resultsSection.style.display = 'block';
  document.getElementById('cardsGrid').innerHTML = loadingHTML();
  document.getElementById('completionMsg').style.display = 'none';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const prompt = buildPrompt(notes, cardType, cardCount, selectedDifficulty);

    const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: prompt })
});

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API request failed');
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content;

    // Parse JSON safely
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse flashcards from response');

    const cards = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(cards) || cards.length === 0) throw new Error('No flashcards generated');

    currentCards = cards;
    reviewedCards = new Set();
    renderCards(cards);
    updateProgress();
    document.getElementById('resultsCount').textContent = `${cards.length} cards`;
    showToast(`✅ ${cards.length} flashcards generated!`);

  } catch (err) {
    document.getElementById('cardsGrid').innerHTML = errorHTML(err.message);
    showToast('❌ Something went wrong. Check your API key.');
  } finally {
    btn.disabled = false;
    btnText.textContent = '⚡ Generate Flashcards';
  }
}

// ── RENDER CARDS ──
function renderCards(cards) {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';
  cards.forEach((card, index) => {
    const el = createCardElement(card, index);
    grid.appendChild(el);
  });
}

// ── CREATE CARD ELEMENT ──
function createCardElement(card, index) {
  const wrapper = document.createElement('div');
  wrapper.style.animationDelay = `${index * 0.06}s`;

  if (card.type === 'mcq') {
    wrapper.innerHTML = mcqCardHTML(card, index);
    wrapper.className = 'mcq-card-wrapper';
  } else if (card.type === 'truefalse') {
    wrapper.innerHTML = tfCardHTML(card, index);
    wrapper.className = 'tf-card-wrapper';
  } else if (card.type === 'fillinblank') {
    wrapper.innerHTML = fillCardHTML(card, index);
    wrapper.className = 'fill-card-wrapper';
  } else {
    wrapper.innerHTML = qaCardHTML(card, index);
    wrapper.className = 'flashcard';
    wrapper.style.animationDelay = `${index * 0.06}s`;
    wrapper.onclick = () => flipCard(wrapper, index);
  }

  return wrapper;
}

// ── Q&A CARD HTML ──
function qaCardHTML(card, index) {
  const isReviewed = reviewedCards.has(index);
  return `
    <div class="flashcard-inner">
      <div class="flashcard-front">
        <div>
          <div class="card-type-badge">Question</div>
          <div class="card-question">${card.question}</div>
        </div>
        <div class="card-footer">
          <span class="card-number">Card ${index + 1}</span>
          <span class="card-hint">Click to reveal ✨</span>
        </div>
      </div>
      <div class="flashcard-back">
        <div>
          <div class="card-type-badge" style="color:#86efac">Answer</div>
          <div class="card-answer">${card.answer}</div>
        </div>
        <div class="card-footer">
          <span class="card-number">Card ${index + 1}</span>
          ${isReviewed ? '<span class="card-reviewed-badge">✓ Reviewed</span>' : '<span class="card-hint">Click to flip back</span>'}
        </div>
      </div>
    </div>
  `;
}

// ── MCQ CARD HTML ──
function mcqCardHTML(card, index) {
  const optionsHTML = card.options.map(opt => `
    <button class="mcq-option" onclick="checkMCQ(this, '${escapeStr(opt)}', '${escapeStr(card.correct)}', ${index})">${opt}</button>
  `).join('');

  return `
    <div class="flashcard" style="height:auto; min-height:220px; animation-delay:${index * 0.06}s">
      <div class="flashcard-inner" style="transform:none; position:relative; height:auto;">
        <div class="flashcard-front" style="position:relative; height:auto; transform:none; backface-visibility:visible;">
          <div>
            <div class="card-type-badge">Multiple Choice</div>
            <div class="card-question" style="font-size:14px; margin-bottom:4px">${card.question}</div>
            <div class="mcq-options">${optionsHTML}</div>
          </div>
          <div class="card-footer" style="margin-top:12px">
            <span class="card-number">Card ${index + 1}</span>
            <span id="mcq-result-${index}" class="card-hint"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── TRUE/FALSE CARD HTML ──
function tfCardHTML(card, index) {
  return `
    <div class="flashcard" style="height:auto; min-height:180px; animation-delay:${index * 0.06}s">
      <div class="flashcard-inner" style="transform:none; position:relative; height:auto;">
        <div class="flashcard-front" style="position:relative; height:auto; transform:none; backface-visibility:visible;">
          <div>
            <div class="card-type-badge">True or False</div>
            <div class="card-question" style="font-size:14px">${card.statement}</div>
            <div class="tf-options">
              <button class="tf-btn" onclick="checkTF(this, 'True', '${escapeStr(card.answer)}', ${index}, '${escapeStr(card.explanation)}')">✅ True</button>
              <button class="tf-btn" onclick="checkTF(this, 'False', '${escapeStr(card.answer)}', ${index}, '${escapeStr(card.explanation)}')">❌ False</button>
            </div>
            <div id="tf-explanation-${index}" style="font-size:12px; color:var(--text-muted); margin-top:8px; display:none;"></div>
          </div>
          <div class="card-footer" style="margin-top:8px">
            <span class="card-number">Card ${index + 1}</span>
            <span id="tf-result-${index}" class="card-hint"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── FILL IN BLANK CARD HTML ──
function fillCardHTML(card, index) {
  return `
    <div class="flashcard" style="height:auto; min-height:200px; animation-delay:${index * 0.06}s">
      <div class="flashcard-inner" style="transform:none; position:relative; height:auto;">
        <div class="flashcard-front" style="position:relative; height:auto; transform:none; backface-visibility:visible;">
          <div>
            <div class="card-type-badge">Fill in the Blank</div>
            <div class="card-question" style="font-size:14px">${card.sentence}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:6px">💡 Hint: ${card.hint || 'Think carefully!'}</div>
            <input class="blank-input" id="blank-${index}" placeholder="Type your answer..." />
            <button class="check-blank-btn" onclick="checkBlank(${index}, '${escapeStr(card.answer)}')">Check ✓</button>
            <div id="blank-result-${index}" style="font-size:13px; margin-top:8px;"></div>
          </div>
          <div class="card-footer" style="margin-top:8px">
            <span class="card-number">Card ${index + 1}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── FLIP Q&A CARD ──
function flipCard(el, index) {
  el.classList.toggle('flipped');
  if (el.classList.contains('flipped')) {
    reviewedCards.add(index);
    updateProgress();
    // Update reviewed badge
    const backFooter = el.querySelector('.flashcard-back .card-hint');
    if (backFooter) {
      backFooter.className = 'card-reviewed-badge';
      backFooter.textContent = '✓ Reviewed';
    }
    if (reviewedCards.size === currentCards.length) {
      setTimeout(showCompletion, 600);
    }
  }
}

// ── CHECK MCQ ──
function checkMCQ(btn, selected, correct, index) {
  const parent = btn.closest('.mcq-options');
  const allBtns = parent.querySelectorAll('.mcq-option');
  const resultEl = document.getElementById(`mcq-result-${index}`);

  allBtns.forEach(b => b.disabled = true);

  if (selected === correct) {
    btn.classList.add('correct');
    resultEl.textContent = '✅ Correct!';
    resultEl.style.color = 'var(--success)';
  } else {
    btn.classList.add('wrong');
    allBtns.forEach(b => { if (b.textContent.trim() === correct) b.classList.add('correct'); });
    resultEl.textContent = '❌ Wrong';
    resultEl.style.color = 'var(--danger)';
  }

  reviewedCards.add(index);
  updateProgress();
  if (reviewedCards.size === currentCards.length) setTimeout(showCompletion, 600);
}

// ── CHECK TRUE/FALSE ──
function checkTF(btn, selected, correct, index, explanation) {
  const parent = btn.closest('.tf-options');
  const allBtns = parent.querySelectorAll('.tf-btn');
  const resultEl = document.getElementById(`tf-result-${index}`);
  const explEl = document.getElementById(`tf-explanation-${index}`);

  allBtns.forEach(b => b.disabled = true);

  if (selected === correct) {
    btn.classList.add('correct');
    resultEl.textContent = '✅ Correct!';
    resultEl.style.color = 'var(--success)';
  } else {
    btn.classList.add('wrong');
    allBtns.forEach(b => { if (b.textContent.includes(correct)) b.classList.add('correct'); });
    resultEl.textContent = '❌ Wrong';
    resultEl.style.color = 'var(--danger)';
  }

  if (explanation && explEl) {
    explEl.style.display = 'block';
    explEl.textContent = `💡 ${explanation}`;
  }

  reviewedCards.add(index);
  updateProgress();
  if (reviewedCards.size === currentCards.length) setTimeout(showCompletion, 600);
}

// ── CHECK BLANK ──
function checkBlank(index, correctAnswer) {
  const input = document.getElementById(`blank-${index}`);
  const resultEl = document.getElementById(`blank-result-${index}`);
  const userAnswer = input.value.trim().toLowerCase();
  const correct = correctAnswer.toLowerCase();

  if (!userAnswer) { showToast('⚠️ Please type an answer first'); return; }

  if (userAnswer === correct || correct.includes(userAnswer) || userAnswer.includes(correct)) {
    resultEl.textContent = '✅ Correct! Answer: ' + correctAnswer;
    resultEl.style.color = 'var(--success)';
    input.style.borderColor = 'var(--success)';
  } else {
    resultEl.textContent = `❌ Wrong. Correct answer: ${correctAnswer}`;
    resultEl.style.color = 'var(--danger)';
    input.style.borderColor = 'var(--danger)';
  }

  input.disabled = true;
  reviewedCards.add(index);
  updateProgress();
  if (reviewedCards.size === currentCards.length) setTimeout(showCompletion, 600);
}

// ── UPDATE PROGRESS ──
function updateProgress() {
  const total = currentCards.length;
  const reviewed = reviewedCards.size;
  const percent = total > 0 ? (reviewed / total) * 100 : 0;

  document.getElementById('progressBar').style.setProperty('--progress', `${percent}%`);
  document.getElementById('progressText').textContent = `${reviewed} / ${total} reviewed`;
}

// ── SHOW COMPLETION ──
function showCompletion() {
  if (reviewedCards.size === currentCards.length) {
    document.getElementById('completionMsg').style.display = 'block';
    document.getElementById('completionMsg').scrollIntoView({ behavior: 'smooth' });
  }
}

// ── SHUFFLE ──
function shuffleCards() {
  if (currentCards.length === 0) return;
  currentCards = [...currentCards].sort(() => Math.random() - 0.5);
  reviewedCards = new Set();
  renderCards(currentCards);
  updateProgress();
  document.getElementById('completionMsg').style.display = 'none';
  showToast('🔀 Cards shuffled!');
}

// ── RESET ──
function resetCards() {
  if (currentCards.length === 0) return;
  reviewedCards = new Set();
  renderCards(currentCards);
  updateProgress();
  document.getElementById('completionMsg').style.display = 'none';
  window.scrollTo({ top: document.getElementById('resultsSection').offsetTop, behavior: 'smooth' });
  showToast('🔄 Cards reset!');
}

// ── COPY ALL ──
function copyAllCards() {
  if (currentCards.length === 0) return;
  const text = currentCards.map((card, i) => {
    if (card.type === 'qa') return `Card ${i + 1}\nQ: ${card.question}\nA: ${card.answer}`;
    if (card.type === 'mcq') return `Card ${i + 1}\nQ: ${card.question}\n${card.options.join('\n')}\nCorrect: ${card.correct}`;
    if (card.type === 'truefalse') return `Card ${i + 1}\n${card.statement}\nAnswer: ${card.answer}`;
    if (card.type === 'fillinblank') return `Card ${i + 1}\n${card.sentence}\nAnswer: ${card.answer}`;
    return '';
  }).join('\n\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 All cards copied to clipboard!');
  }).catch(() => {
    showToast('❌ Could not copy — try a different browser');
  });
}

// ── TOAST ──
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── LOADING HTML ──
function loadingHTML() {
  return `
    <div class="loading-state" style="grid-column:1/-1">
      <div class="loading-spinner"></div>
      <h3>Generating your flashcards...</h3>
      <p>AI is reading your notes and creating smart cards ⚡</p>
    </div>
  `;
}

// ── ERROR HTML ──
function errorHTML(msg) {
  return `
    <div class="error-state" style="grid-column:1/-1">
      <strong>❌ Error:</strong> ${msg}<br/><br/>
      <span style="font-size:12px">Check your API key and try again. Make sure you're connected to the internet.</span>
    </div>
  `;
}

// ── ESCAPE STRING (for HTML attributes) ──
function escapeStr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) generateFlashcards();
  if (e.key === 's' && e.ctrlKey) { e.preventDefault(); shuffleCards(); }
});
