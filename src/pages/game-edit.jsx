import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// Импортируем нужные методы API
import { fetchGameById, updateGame, fetchParticipants, removeParticipant, generateInviteLink, isAuthenticated, fetchMe } from '/src/api/gameApi.jsx';
import { addParticipant } from '/src/api/participantsApi.jsx';
import { useAppDialog } from '/src/components/app-dialogs.jsx';
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

const validateOrganizerNotes = (notes) => {
  const errors = [];
  if (notes && notes.length > 500) {
    errors.push('Максимальная длина — 500 символов');
  }
  return errors;
};

const validateBudget = (value) => {
  const errors = [];
  if (!value) return errors;
  const num = Number(value);
  if (isNaN(num)) errors.push('Бюджет должен быть числом');
  else if (num <= 0) errors.push('Бюджет должен быть больше 0');
  else if (num > 100000) errors.push('Бюджет слишком большой (макс. 100 000)');
  return errors;
};

function Game_edit() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { alert, confirm } = useAppDialog();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/registration', { replace: true });
    }
  }, [navigate]);

  // Состояния для данных формы
  const [formData, setFormData] = useState({
    teamName: '',
    drawDate: '',
    drawTime: '12:00',
  });

  const [organizerNotes, setOrganizerNotes] = useState('');
  const [giftBudget, setGiftBudget] = useState('');
  const [organizerId, setOrganizerId] = useState(null);
  const [gameStatus, setGameStatus] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  // Состояния загрузки и ошибок
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const MIN_DATE = getLocalDateInputValue();
  const currentTeamNameErrors = validateTeamName(formData.teamName);
  const currentDrawDateErrors = validateDrawDate(formData.drawDate, formData.drawTime);
  const currentOrganizerNotesErrors = validateOrganizerNotes(organizerNotes);
  const currentBudgetErrors = validateBudget(giftBudget);

  const [errors, setErrors] = useState({ teamName: [], drawDate: [], organizerNotes: [], giftBudget: [] });
  const [touched, setTouched] = useState({ teamName: false, drawDate: false, organizerNotes: false, giftBudget: false });

  // ← НОВОЕ: Загрузка данных игры при монтировании
  useEffect(() => {
    const loadData = async () => {
      if (!eventId) return;

      try {
        setIsLoading(true);

        // 1. Получаем данные игры и текущего пользователя параллельно
        const [game, me] = await Promise.all([fetchGameById(eventId), fetchMe()]);

        if (game.organizerId !== me.id) {
          navigate(`/game/${eventId}`, { replace: true });
          return;
        }

        // 2. Заполняем форму данными с сервера
        const existingDate = game.drawDate ? new Date(game.drawDate) : null;
        setFormData({
          teamName: game.title || '',
          drawDate: existingDate ? existingDate.toISOString().split('T')[0] : '',
          drawTime: existingDate
            ? existingDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '12:00',
        });

        setOrganizerNotes(game.organizerNotes || '');
        setGiftBudget(game.budget ? String(game.budget) : '');
        setOrganizerId(game.organizerId || null);
        setGameStatus(game.status || null);

        // 2. Получаем ссылку-приглашение
        try {
          const inviteData = await generateInviteLink(eventId);
          // Адаптируйте под структуру ответа (может быть ссылка или код)
          const link = inviteData.inviteUrl || (inviteData.token ? `${window.location.origin}/invite/${inviteData.token}` : null);
          if (link) setInviteLink(link);
        } catch (err) {
          console.warn('Не удалось получить ссылку-приглашение', err);
          console.warn('Ссылка-приглашение недоступна');
        }

        // 3. Получаем список участников (может вернуть 403 если организатор не участник)
        try {
          const participantsList = await fetchParticipants(eventId);
          const list = Array.isArray(participantsList) ? participantsList : (participantsList.items || []);
          setParticipants(list);
        } catch (err) {
          console.warn('Не удалось загрузить участников:', err);
        }

      } catch (error) {
        console.error('Ошибка загрузки данных игры:', error);
        navigate(`/game/${eventId}`, { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [eventId, navigate]);

  // Валидация даты/времени при любом изменении любого из двух полей
  React.useEffect(() => {
    if (touched.drawDate) {
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(formData.drawDate, formData.drawTime) }));
    }
  }, [formData.drawDate, formData.drawTime, touched.drawDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'drawDate') {
      setTouched(prev => ({ ...prev, drawDate: true }));
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(value, formData.drawTime) }));
    } else if (name === 'drawTime') {
      if (touched.drawDate) {
        setErrors(prev => ({ ...prev, drawDate: validateDrawDate(formData.drawDate, value) }));
      }
    } else if (touched[name]) {
      if (name === 'teamName') {
        setErrors(prev => ({ ...prev, teamName: validateTeamName(value) }));
      }
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
      setErrors(prev => ({ ...prev, drawDate: validateDrawDate(value, formData.drawTime) }));
    } else if (name === 'organizerNotes') {
      setErrors(prev => ({ ...prev, organizerNotes: validateOrganizerNotes(value) }));
    } else if (name === 'giftBudget') {
      setErrors(prev => ({ ...prev, giftBudget: validateBudget(value) }));
    }
  };

  const isFormValid = () => {
    const nameErrors = validateTeamName(formData.teamName);
    const dateErrors = validateDrawDate(formData.drawDate, formData.drawTime);
    const notesErrors = validateOrganizerNotes(organizerNotes);
    const budgetErrors = validateBudget(giftBudget);
    setErrors({ teamName: nameErrors, drawDate: dateErrors, organizerNotes: notesErrors, giftBudget: budgetErrors });
    return nameErrors.length === 0 && dateErrors.length === 0 && notesErrors.length === 0 && budgetErrors.length === 0;
  };

  // ← НОВОЕ: Удаление участника через API
  const handleRemoveParticipant = async (id) => {
    const confirmed = await confirm({
      title: 'Удалить участника?',
      message: 'Удалить этого участника из игры?',
      confirmLabel: 'Удалить',
      tone: 'danger',
    });
    if (confirmed) {
      try {
        await removeParticipant(id);
        // Обновляем список локально
        setParticipants(prev => prev.filter(p => p.id !== id));
      } catch (error) {
        console.error('Ошибка удаления участника:', error);
        await alert({
          title: 'Ошибка удаления',
          message: 'Не удалось удалить участника. Попробуйте позже.',
          tone: 'danger',
        });
      }
    }
  };

  const handleJoinAsParticipant = async () => {
    try {
      await addParticipant(eventId, {});
      // Перезагружаем список чтобы получить имя и email участника
      const updated = await fetchParticipants(eventId);
      const list = Array.isArray(updated) ? updated : (updated.items || []);
      setParticipants(list);
    } catch (error) {
      await alert({
        title: 'Ошибка подключения',
        message: error.message || 'Не удалось присоединиться к игре.',
        tone: 'danger',
      });
    }
  };

  const isOrganizerParticipant = participants.some(p => p.userId === organizerId);

  // ← НОВОЕ: Сохранение изменений через API
  const handleSave = async () => {
    if (!isFormValid()) {
      setTouched({ teamName: true, drawDate: true, organizerNotes: true });
      return;
    }
    
    try {
      setIsSaving(true);

      const updatedData = {
        title: formData.teamName,
        organizerNotes: organizerNotes || undefined,
        budget: giftBudget ? parseInt(giftBudget, 10) : undefined,
        ...(formData.drawDate
          ? { drawDate: new Date(`${formData.drawDate}T${formData.drawTime}`).toISOString() }
          : { clearDrawDate: true }),
      };

      await updateGame(eventId, updatedData);
      
      navigate(`/game/${eventId}`);
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setSaveError(error.message || 'Не удалось сохранить изменения. Попробуйте позже.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/game/${eventId}`);
  };

  // Модальное окно
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleAddParticipant = () => {
    setIsModalOpen(true);
    setIsCopied(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsCopied(false);
  };

  const copyFallback = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch(() => copyFallback(inviteLink));
    } else {
      copyFallback(inviteLink);
    }
  };

  // Рендер состояния загрузки
  if (isLoading) {
    return (
      <div className="overlay_game">
        <div className="card_game card_game-edit">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <i className="ti ti-loader" style={{ fontSize: '48px', color: '#44E858', animation: 'spin 1s linear infinite' }}></i>
            <p style={{ marginTop: '20px', color: '#757575' }}>Загрузка настроек игры...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay_game">
      <div className="card_game card_game-edit">
        <h2 className="game-title">Редактирование игры</h2>
        <h1 className="team-name">{formData.teamName}</h1>

        <div className="edit-content-grid">
          <div className="edit-column edit-settings">
            <h3>Настройки игры</h3>
            
            {/* Поле названия команды */}
            <div className="form-group">
              <label>Название команды *</label>
              <input
                type="text"
                name="teamName"
                value={formData.teamName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Введите название"
                disabled={isSaving}
                className={currentTeamNameErrors.length > 0 && touched.teamName ? 'input-error' : ''}
              />
              {currentTeamNameErrors.length > 0 && touched.teamName && (
                <ul className="error-list">
                  {currentTeamNameErrors.map((err, i) => (
                    <li key={i} className="error-item">• {err}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Поле даты и времени жеребьёвки */}
            <div className="form-group">
              <label>Дата и время жеребьёвки</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="date"
                  name="drawDate"
                  value={formData.drawDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isSaving}
                  className={currentDrawDateErrors.length > 0 && touched.drawDate ? 'input-error' : ''}
                  style={{ flex: 2 }}
                  min={MIN_DATE}
                />
                <input
                  type="time"
                  name="drawTime"
                  value={formData.drawTime}
                  onChange={handleChange}
                  disabled={isSaving || !formData.drawDate}
                  style={{ flex: 1, opacity: formData.drawDate ? 1 : 0.6 }}
                />
              </div>
              <div className="form-hint">
                Поле необязательно. Если дату не указывать, жеребьёвку можно провести вручную на странице игры.
              </div>
              {currentDrawDateErrors.length > 0 && touched.drawDate && (
                <ul className="error-list">
                  {currentDrawDateErrors.map((err, i) => (
                    <li key={i} className="error-item">• {err}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-group">
              <label>Пожелания от организатора <br /> (отобразится в письмах участников после жеребьевки)</label>
              <textarea
                name="organizerNotes"
                placeholder="Например: Сбор подарков в офисе на 3 этаже, обмен — в конференц-зале... "
                value={organizerNotes}
                onChange={handleNotesChange}
                onBlur={handleBlur}
                disabled={isSaving}
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
            </div>

            {/* Поле бюджета */}
            <div className="form-group">
              <label>Бюджет на подарок (руб.)</label>
              <input
                type="number"
                name="giftBudget"
                placeholder="Например: 1500"
                value={giftBudget}
                onChange={(e) => {
                  setGiftBudget(e.target.value);
                  if (touched.giftBudget) {
                    setErrors(prev => ({ ...prev, giftBudget: validateBudget(e.target.value) }));
                  }
                }}
                onBlur={handleBlur}
                disabled={isSaving}
                min="1"
                step="100"
                className={currentBudgetErrors.length > 0 && touched.giftBudget ? 'input-error' : ''}
              />
              {currentBudgetErrors.length > 0 && touched.giftBudget && (
                <ul className="error-list">
                  {currentBudgetErrors.map((err, i) => (
                    <li key={i} className="error-item">• {err}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddParticipant}
              disabled={isSaving}
            >
              + Добавить участников
            </button>
          </div>

          {/* ПРАВАЯ КОЛОНКА: Список участников */}
          <div className="edit-column edit-participants">
            <div className="participants-header">
              <h3>Участники ({participants.length})</h3>
              <span className="participants-hint">Нажмите ✕ для удаления</span>
            </div>
            
            <div className="participants-scroll">
              {participants.length === 0 ? (
                <p className="empty-participants">Пока нет участников</p>
              ) : (
                participants.map((participant) => (
                  <div key={participant.id} className="participant-item">
                    <div className="participant-info">
                      <span className="participant-name">{participant.userName || participant.userId}</span>
                      <span className="participant-email">{participant.userEmail}</span>
                    </div>
                    {gameStatus === 'registration' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleRemoveParticipant(participant.id)}
                        title=""
                        disabled={isSaving}
                        style={{ border: 'none' }}
                      >
                        <i className="ti ti-x" style={{ fontSize: '16px', color: 'black'}}></i>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {!isOrganizerParticipant && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleJoinAsParticipant}
                disabled={isSaving}
                style={{ marginTop: '10px' }}
              >
                Присоединиться к игре
              </button>
            )}
          </div>
        </div>

        <div className="edit-footer">
          {saveError && <p style={{ color: '#e74c3c', marginBottom: '8px', textAlign: 'center' }}>{saveError}</p>}
          <button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel} disabled={isSaving}>
            Отмена
          </button>
        </div>
      </div>

      {/* Модальное окно со ссылкой */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-small" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>×</button>
            <p className="modal-label">Ссылка для приглашения:</p>
            <div className="link-row">
              <input type="text" className="link-input" value={inviteLink} readOnly />
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleCopyLink}
                disabled={isCopied}
              >
                {isCopied ? '✓ Скопировано!' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Game_edit;
