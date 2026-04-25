import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { consumePendingInviteRedirectPath } from '/src/utils/pendingInvite.js';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      const pendingInviteRedirectPath = consumePendingInviteRedirectPath();
      if (pendingInviteRedirectPath) {
        navigate(pendingInviteRedirectPath, { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    } else {
      navigate('/registration', { replace: true });
    }
  }, [searchParams, navigate]);

  return <div style={{ textAlign: 'center', marginTop: '100px' }}>Авторизация...</div>;
}

export default AuthCallback;
