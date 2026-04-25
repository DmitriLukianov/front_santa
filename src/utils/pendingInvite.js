const PENDING_INVITE_TOKEN_KEY = 'pendingInviteToken';

export const savePendingInviteToken = (token) => {
  if (!token) return;
  sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
};

export const consumePendingInviteRedirectPath = () => {
  const pendingInviteToken = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
  if (!pendingInviteToken) {
    return null;
  }

  sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  return `/invite/${pendingInviteToken}`;
};
