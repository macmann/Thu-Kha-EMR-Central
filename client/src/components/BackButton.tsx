import { useNavigate } from 'react-router-dom';

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <div className="mt-4 flex justify-start">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
      >
        Back
      </button>
    </div>
  );
}

