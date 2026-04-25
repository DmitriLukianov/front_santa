import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Импортируем метод создания игры
import { createGame, isAuthenticated } from '/src/api/gameApi.jsx';
import './main.css';

// === ФУНКЦИИ ВАЛИДАЦИИ (без изменений) ===

const validateTeamName = (name) => {
  const errors = [];
  const trimmed = name.trim();
  
  if (!trimmed) {
    errors.push('Название команды обязательно');
    return errors;
  }
  
  const validPattern = /^[а-яА-ЯёЁa-zA-Z0-9\s\-\,\.\(\)\/]+$/;
  if (!validPattern.test(trimmed)) {
    errors.push('Разрешены только буквы, цифры, пробел и символы: - , . ( ) /');
  }
  
  if (trimmed.length < 3) {
    errors.push('Минимальная длина названия — 3 символа');
  }
  if (trimmed.length > 150) {
    errors.push('Максимальная длина названия — 150 символов');
  }
  
  if (trimmed.startsWith(' ') || trimmed.endsWith(' ')) {
    errors.push('Название не должно начинаться или заканчиваться пробелом');
  }
  
  return errors;
};

const validateDrawDate = (dateString, timeString = '00:00') => {
  const errors = [];

  if (!dateString) {
    return errors;
  }

  const date = new Date(`${dateString}T${timeString}`);
  if (isNaN(date.getTime())) {
    errors.push('Введите корректную дату');
    return errors;
  }

  const now = new Date();
  now.setSeconds(0, 0);
  if (date < now) {
    errors.push('Дата и время жеребьёвки не могут быть в прошлом');
  }

  return errors;
};

const getLocalDateInputValue = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().split('T')[0];
};

const validateBudget = (value) => {
  const errors = [];
  const num = Number(value);

  if (!value) {
    errors.push('Укажите бюджет подарка');
    return errors;
  }

  if (isNaN(num)) {
    errors.push('Бюджет должен быть числом');
    return errors;
  }

  if (num <= 0) {
    errors.push('Бюджет должен быть больше 0');
  }

  if (num > 100000) {
    errors.push('Бюджет слишком большой (макс. 100 000)');
  }

  return errors;
};

const validateOrganizerNotes = (notes) => {
  const errors = [];
  if (notes && notes.length > 500) {
    errors.push('Максимальная длина — 500 символов');
  }
  return errors;
};

function Game_add() {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/registration', { replace: true });
    }
  }, [navigate]);
  
  // Состояния формы
  const [teamName, setTeamName] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [drawTime, setDrawTime] = useState('12:00');
  const [giftBudget, setGiftBudget] = useState('');
  const [wantParticipate, setWantParticipate] = useState(false);
  const [organizerNotes, setOrganizerNotes] = useState('');
  
  // Состояния ошибок и касаний
  const [errors, setErrors] = useState({ 
    teamName: [], 
    drawDate: [], 
    giftBudget: [], 
    organizerNotes: [] 
  });
  
  const [touched, setTouched] = useState({ 
    teamName: false, 
    drawDate: false, 
    giftBudget: false, 
    organizerNotes: false 
  });

  // ← НОВОЕ: Состояния загрузки и ошибки сервера
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const MIN_DATE = getLocalDateInputValue();
  const currentTeamNameErrors = validateTeamName(teamName);
  const currentDrawDateErrors = validateDrawDate(drawDate, drawTime);
  const currentGiftBudgetErrors = validateBudget(giftBudget);
  const currentOrganizerNotesErrors = validateOrganizerNotes(organizerNotes);

  // --- Обработчики изменений (без изменений) ---

  const handleTeamNameChange = (e) => {
    const value = e.target.value;
    setTeamName(value);
    if (touched.teamName) {
      setErrors(prev => ({ ...prev, teamName: validateTeamName(value) }));
    }
  };

  // Валидация даты/времени при любом изменении любого из двух полей
  React.useEffect(() => {
    if (touched.drawDate) {
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(drawDate, drawTime) }));
    }
  }, [drawDate, drawTime, touched.drawDate]);

  const handleDateChange = (e) => {
    const value = e.target.value;
    setDrawDate(value);
    setTouched(prev => ({ ...prev, drawDate: true }));
    setErrors(prev => ({ ...prev, drawDate: validateDrawDate(value, drawTime) }));
  };

  const handleTimeChange = (e) => {
    const value = e.target.value;
    setDrawTime(value);
    if (touched.drawDate) {
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(drawDate, value) }));
    }
  };

  const handleBudgetChange = (e) => {
    const value = e.target.value;
    setGiftBudget(value);
    if (touched.giftBudget) {
      setErrors(prev => ({ ...prev, giftBudget: validateBudget(value) }));
    }
  };

  const handleNotesChange = (e) => {
    const value = e.target.value.slice(0, 500);
    setOrganizerNotes(value);
    if (touched.organizerNotes) {
      setErrors(prev => ({ ...prev, organizerNotes: validateOrganizerNotes(value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (name === 'teamName') {
      setErrors(prev => ({ ...prev, teamName: validateTeamName(value) }));
    } else if (name === 'drawDate') {
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(value, drawTime) }));
    } else if (name === 'giftBudget') {
      setErrors(prev => ({ ...prev, giftBudget: validateBudget(value) }));
    } else if (name === 'organizerNotes') {
      setErrors(prev => ({ ...prev, organizerNotes: validateOrganizerNotes(value) }));
    }
  };

  const isFormValid = () => {
    const nameErrors = validateTeamName(teamName);
    const dateErrors = validateDrawDate(drawDate, drawTime);
    const budgetErrors = validateBudget(giftBudget);
    const notesErrors = validateOrganizerNotes(organizerNotes);
    
    setErrors({ 
      teamName: nameErrors, 
      drawDate: dateErrors, 
      giftBudget: budgetErrors, 
      organizerNotes: notesErrors 
    });
    
    return nameErrors.length === 0 && 
           dateErrors.length === 0 && 
           budgetErrors.length === 0 && 
           notesErrors.length === 0;
  };

  // ← НОВОЕ: Отправка данных на сервер
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!isFormValid()) {
      setTouched({ 
        teamName: true, 
        drawDate: true, 
        giftBudget: true, 
        organizerNotes: true 
      });
      return;
    }
    
    try {
      setIsSubmitting(true);

      // Подготовка данных для API
      const gameData = {
        title: teamName.trim(),
        drawDate: drawDate ? new Date(`${drawDate}T${drawTime}`).toISOString() : null,
        organizerNotes: organizerNotes.trim() || null,
        budget: giftBudget ? parseInt(giftBudget, 10) : null,
        wantParticipate: wantParticipate,
      };

      // Вызов API создания игры
      const createdGame = await createGame(gameData);
      
      // Переход на страницу созданной игры
      // Предполагаем, что API возвращает объект с id: { id: '123', ... }
      const gameId = createdGame.id || createdGame.eventId;
      
      if (gameId) {
        navigate('/game/add/link', { state: { eventId: gameId } });
      } else {
        throw new Error('Не удалось получить ID созданной игры');
      }
      
    } catch (error) {
      console.error('Ошибка создания игры:', error);
      setSubmitError(error.message || 'Не удалось создать игру. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Кнопка активна, если нет ошибок и форма не отправляется
  const canSubmit = teamName.trim() && 
                    giftBudget && 
                    currentTeamNameErrors.length === 0 && 
                    currentDrawDateErrors.length === 0 &&
                    currentGiftBudgetErrors.length === 0 &&
                    currentOrganizerNotesErrors.length === 0 &&
                    !isSubmitting;

  return (
    <div className="overlay_game_add"> 
      <div className="card_game_add"> 
        <h1>Создание игры</h1>

        <form onSubmit={handleSubmit} className="game-add-form" noValidate>                     
          
          {/* 1. Поле названия команды */}
          <div className="form-group">
            <label>Название команды <span className="required">*</span></label>
            <input 
              type="text"
              name="teamName"
              placeholder="Введите название команды"
              value={teamName}
              onChange={handleTeamNameChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className={`input-field ${currentTeamNameErrors.length > 0 && touched.teamName ? 'input-error' : ''}`}
              required
            />
            {currentTeamNameErrors.length > 0 && touched.teamName && (
              <ul className="error-list">
                {currentTeamNameErrors.map((err, i) => (
                  <li key={i} className="error-item">• {err}</li>
                ))}
              </ul>
            )}
          </div>

          {/* 2. Поле выбора даты и времени */}
          <div className="form-group date-group">
            <label>Дата и время жеребьёвки</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="date"
                name="drawDate"
                value={drawDate}
                onChange={handleDateChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                min={MIN_DATE}
                className={`input-field date-input ${currentDrawDateErrors.length > 0 && touched.drawDate ? 'input-error' : ''}`}
                style={{ flex: 2 }}
              />
              <input
                type="time"
                value={drawTime}
                onChange={handleTimeChange}
                disabled={isSubmitting || !drawDate}
                className="input-field"
                style={{ flex: 1, opacity: drawDate ? 1 : 0.6 }}
              />
            </div>
            <div className="form-hint">
              Поле необязательно. Если не указывать дату, жеребьёвку можно будет провести вручную на странице игры.
            </div>
            {currentDrawDateErrors.length > 0 && touched.drawDate && (
              <ul className="error-list">
                {currentDrawDateErrors.map((err, i) => (
                  <li key={i} className="error-item">• {err}</li>
                ))}
              </ul>
            )}
          </div>

          {/* 3. ПОЛЕ ЦЕНЫ (БЮДЖЕТА) */}
          <div className="form-group">
            <label>Бюджет на подарок (руб.) <span className="required">*</span></label>
            <input 
              type="number"
              name="giftBudget"
              placeholder="Например: 1500"
              value={giftBudget}
              onChange={handleBudgetChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              min="1"
              step="100"
              className={`input-field ${currentGiftBudgetErrors.length > 0 && touched.giftBudget ? 'input-error' : ''}`}
              required
            />
            {currentGiftBudgetErrors.length > 0 && touched.giftBudget && (
              <ul className="error-list">
                {currentGiftBudgetErrors.map((err, i) => (
                  <li key={i} className="error-item">• {err}</li>
                ))}
              </ul>
            )}
          </div>

          {/* 4. Пожелания организатора */}
          <div className="form-group">
            <label>Пожелания от организатора <br /> <span style={{fontWeight: 'normal', fontSize: '12px', color: '#757575'}}>(отобразится в письмах участников после жеребьевки)</span></label>
            <textarea
              name="organizerNotes"
              placeholder="Например: Сбор подарков в офисе на 3 этаже 28.12..."
              value={organizerNotes}
              onChange={handleNotesChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className={`input-field input-notes ${currentOrganizerNotesErrors.length > 0 && touched.organizerNotes ? 'input-error' : ''}`}
              rows={4}
              maxLength={500}
            />
            {currentOrganizerNotesErrors.length > 0 && touched.organizerNotes && (
              <ul className="error-list">
                {currentOrganizerNotesErrors.map((err, i) => (
                  <li key={i} className="error-item">• {err}</li>
                ))}
              </ul>
            )}
            <div className="notes-hint">{organizerNotes.length} / 500</div>
          </div>

          {/* Чекбокс участия */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={wantParticipate}
                onChange={(e) => setWantParticipate(e.target.checked)}
                className="checkbox"
                disabled={isSubmitting}
              />
              <span className="checkbox-text">Хочу участвовать в жеребьевке как игрок</span>
            </label>
          </div>

          {/* Ошибка сервера */}
          {submitError && (
            <div style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '15px', textAlign: 'center' }}>
              ⚠️ {submitError}
            </div>
          )}

          {/* Кнопки */}
          <div className="game-add-buttons">
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!canSubmit}
              title={!canSubmit ? 'Заполните все обязательные поля корректно' : ''}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Создание...' : 'Создать игру'}
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleGoBack}
              disabled={isSubmitting}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Game_add;
