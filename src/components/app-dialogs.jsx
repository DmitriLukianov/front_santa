import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

const AppDialogContext = createContext(null);

const initialDialogState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Отмена',
  tone: 'default',
  kind: 'alert',
};

export function AppDialogProvider({ children }) {
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState(initialDialogState);

  const closeDialog = (result = false) => {
    setDialogState(initialDialogState);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  const alert = ({ title = 'Сообщение', message, confirmLabel = 'Понятно', tone = 'default' }) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        open: true,
        kind: 'alert',
        title,
        message,
        confirmLabel,
        cancelLabel: 'Отмена',
        tone,
      });
    });

  const confirm = ({
    title = 'Подтверждение',
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    tone = 'default',
  }) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        open: true,
        kind: 'confirm',
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
      });
    });

  const value = useMemo(() => ({ alert, confirm }), []);

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {dialogState.open && (
        <div className="app-dialog-backdrop" role="presentation">
          <div
            className={`app-dialog app-dialog--${dialogState.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-dialog__icon" aria-hidden="true">
              <i
                className={
                  dialogState.tone === 'danger'
                    ? 'ti ti-alert-triangle'
                    : dialogState.kind === 'confirm'
                      ? 'ti ti-help-circle'
                      : 'ti ti-info-circle'
                }
              ></i>
            </div>
            <div className="app-dialog__body">
              <h3 id="app-dialog-title" className="app-dialog__title">{dialogState.title}</h3>
              <p className="app-dialog__message">{dialogState.message}</p>
            </div>
            <div className="app-dialog__actions">
              {dialogState.kind === 'confirm' && (
                <button type="button" className="btn-secondary" onClick={() => closeDialog(false)}>
                  {dialogState.cancelLabel}
                </button>
              )}
              <button
                type="button"
                className={dialogState.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => closeDialog(true)}
              >
                {dialogState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return context;
}
