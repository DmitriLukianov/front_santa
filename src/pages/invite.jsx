import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { joinGameByLink, isAuthenticated } from '/src/api/gameApi.jsx';
import { useAppDialog } from '/src/components/app-dialogs.jsx';
import { savePendingInviteToken } from '/src/utils/pendingInvite.js';

function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { alert } = useAppDialog();

  useEffect(() => {
    if (!isAuthenticated()) {
      savePendingInviteToken(token);
      navigate('/registration', { replace: true });
      return;
    }

    const join = async () => {
      try {
        const data = await joinGameByLink(token);
        navigate(`/game/${data.eventId}`, { replace: true });
      } catch {
        await alert({
          title: 'Не удалось подключиться',
          message: 'Не удалось подключиться к игре. Попросите организатора прислать новую ссылку-приглашение.',
          tone: 'danger',
        });
        navigate('/profile', { replace: true });
      }
    };

    join();
  }, [token, navigate]);

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', color: '#757575' }}>
      Подключение к игре...
    </div>
  );
}

export default InvitePage;
