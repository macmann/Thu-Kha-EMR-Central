import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

interface Props {
  className?: string;
}

export default function LogoutButton({
  className = 'rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300',
}: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleClick() {
    logout();
    navigate('/login');
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      Logout
    </button>
  );
}
